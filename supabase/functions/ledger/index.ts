import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Constants
const PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID = "ACC_FREIGHT_INCOME"
const PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID = "ACC_REBATE_EXPENSE"
const PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID = "ACC_DISCOUNT_EXPENSE"

// Types
interface UserData {
  id?: string
  uid: string
  status?: "active" | "disabled"
  role?: string
  email?: string
  displayName?: string
  assignedBranchIds?: string[]
}

interface DaybookData {
  id?: string
  status?: "Draft" | "Pending Approval" | "Approved" | "Rejected"
  nepaliMiti: string
  englishMiti: Date
  branchId: string
  transactions: DaybookTransaction[]
  openingBalance: number
  totalCashIn: number
  totalCashOut: number
  closingBalance: number
  processedByFunction?: boolean
  approvedBy?: string
  createdBy?: string
  createdAt?: Date
  updatedBy?: string
  updatedAt?: Date
  submittedBy?: string
  submittedAt?: Date
  approvalRemarks?: string
}

interface DaybookTransaction {
  id: string
  transactionType: string
  amount: number
  description: string
  ledgerAccountId?: string
  partyId?: string
  referenceId?: string
  nepaliMiti?: string
  createdAt: Date
}

interface LedgerEntryData {
  id?: string
  accountId: string
  miti: Date
  nepaliMiti?: string
  description: string
  debit: number
  credit: number
  referenceNo?: string
  transactionType: string
  status: "Pending" | "Approved" | "Rejected"
  sourceModule?: string
  branchId?: string
  createdAt: Date
  createdBy?: string
  approvedBy?: string
  approvedAt?: Date
  approvalRemarks?: string
}

interface FunctionsBiltiData {
  id: string
  ledgerProcessed: boolean
  miti: Date
  nepaliMiti?: string
  consignorId: string
  consigneeId: string
  totalAmount: number
  payMode: string
  createdBy?: string
  branchId?: string
}

interface GoodsDeliveryData {
  id: string
  ledgerProcessed: boolean
  miti: Date
  nepaliMiti?: string
  deliveredBiltis: { biltiId: string; rebateAmount: number; rebateReason?: string; discountAmount: number; discountReason?: string }[]
  createdBy?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the request body
    const { type, payload } = await req.json()

    switch (type) {
      case 'PROCESS_APPROVED_DAYBOOK':
        return await handleProcessApprovedDaybook(supabaseClient, payload)
      case 'POST_BILTI_LEDGER_ENTRIES':
        return await handlePostBiltiLedgerEntries(supabaseClient, payload)
      case 'POST_GOODS_DELIVERY_LEDGER_ENTRIES':
        return await handlePostGoodsDeliveryLedgerEntries(supabaseClient, payload)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleProcessApprovedDaybook(supabase: any, daybook: DaybookData) {
  if (!daybook || daybook.status !== 'Approved' || daybook.processedByFunction) {
    return new Response(
      JSON.stringify({ message: 'Daybook not eligible for processing' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const MAIN_CASH_LEDGER_ACCOUNT_ID = `BRANCH_CASH_${daybook.branchId}`
  const ledgerEntries: LedgerEntryData[] = []

  for (const tx of daybook.transactions) {
    const ledgerEntryBase: Omit<LedgerEntryData, 'id' | 'accountId' | 'debit' | 'credit' | 'description' | 'transactionType'> = {
      miti: daybook.englishMiti,
      nepaliMiti: tx.nepaliMiti || daybook.nepaliMiti,
      referenceNo: `DB-${daybook.id}-${tx.id}`,
      sourceModule: 'Daybook',
      branchId: daybook.branchId,
      status: 'Approved',
      createdAt: new Date(),
      createdBy: daybook.approvedBy || 'system-daybook-processor',
    }

    let debitAccountId: string | undefined
    let creditAccountId: string | undefined
    let description = tx.description

    if (tx.transactionType.toLowerCase().includes('cash in')) {
      debitAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID
      creditAccountId = tx.ledgerAccountId || tx.partyId || 'UNKNOWN_INCOME_SOURCE'
      description = `Cash In via Daybook: ${tx.description}`
    } else if (tx.transactionType.toLowerCase().includes('cash out')) {
      creditAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID
      debitAccountId = tx.ledgerAccountId || tx.partyId || 'UNKNOWN_EXPENSE_TARGET'
      description = `Cash Out via Daybook: ${tx.description}`
    } else if (tx.transactionType === 'Adjustment/Correction') {
      if (tx.amount >= 0) {
        debitAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID
        creditAccountId = tx.ledgerAccountId || 'ADJUSTMENT_ACCOUNT'
        description = `Daybook Adjustment (Credit Cash): ${tx.description}`
      } else {
        creditAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID
        debitAccountId = tx.ledgerAccountId || 'ADJUSTMENT_ACCOUNT'
        description = `Daybook Adjustment (Debit Cash): ${tx.description}`
      }
    } else {
      continue
    }

    if (debitAccountId) {
      ledgerEntries.push({
        ...ledgerEntryBase,
        accountId: debitAccountId,
        description,
        debit: Math.abs(tx.amount),
        credit: 0,
        transactionType: tx.transactionType,
      })
    }

    if (creditAccountId) {
      ledgerEntries.push({
        ...ledgerEntryBase,
        accountId: creditAccountId,
        description,
        debit: 0,
        credit: Math.abs(tx.amount),
        transactionType: tx.transactionType,
      })
    }
  }

  // Insert all ledger entries
  const { error: ledgerError } = await supabase
    .from('ledger_entries')
    .insert(ledgerEntries)

  if (ledgerError) throw ledgerError

  // Update daybook as processed
  const { error: updateError } = await supabase
    .from('daybooks')
    .update({ processedByFunction: true, updatedAt: new Date() })
    .eq('id', daybook.id)

  if (updateError) throw updateError

  return new Response(
    JSON.stringify({ message: 'Daybook processed successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handlePostBiltiLedgerEntries(supabase: any, biltiData: FunctionsBiltiData) {
  if (!biltiData || biltiData.ledgerProcessed) {
    return new Response(
      JSON.stringify({ message: 'Bilti not eligible for processing' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get consignor and consignee data
  const { data: consignor, error: consignorError } = await supabase
    .from('parties')
    .select('*')
    .eq('id', biltiData.consignorId)
    .single()

  const { data: consignee, error: consigneeError } = await supabase
    .from('parties')
    .select('*')
    .eq('id', biltiData.consigneeId)
    .single()

  if (consignorError || consigneeError || !consignor || !consignee) {
    throw new Error('Consignor or Consignee party not found')
  }

  const ledgerEntries: LedgerEntryData[] = []
  const ledgerEntryBase: Omit<LedgerEntryData, 'id' | 'accountId' | 'debit' | 'credit' | 'description'> = {
    miti: biltiData.miti,
    nepaliMiti: biltiData.nepaliMiti || '',
    referenceNo: `BLT-${biltiData.id}`,
    sourceModule: 'Bilti',
    status: 'Approved',
    createdAt: new Date(),
    createdBy: biltiData.createdBy || 'system-bilti-processor',
    transactionType: 'Bilti',
    branchId: biltiData.branchId || 'UNKNOWN_BRANCH',
  }

  const freightAmount = biltiData.totalAmount

  if (biltiData.payMode === 'Paid') {
    ledgerEntries.push({
      ...ledgerEntryBase,
      accountId: consignor.assignedLedgerId,
      description: `Freight charges for Bilti ${biltiData.id} (Paid by Consignor)`,
      debit: freightAmount,
      credit: 0,
    })
    ledgerEntries.push({
      ...ledgerEntryBase,
      accountId: PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID,
      description: `Freight income from Bilti ${biltiData.id}`,
      debit: 0,
      credit: freightAmount,
    })
  } else if (biltiData.payMode === 'To Pay' || biltiData.payMode === 'Due') {
    ledgerEntries.push({
      ...ledgerEntryBase,
      accountId: consignee.assignedLedgerId,
      description: `Freight charges for Bilti ${biltiData.id} (To be Paid by Consignee)`,
      debit: freightAmount,
      credit: 0,
    })
    ledgerEntries.push({
      ...ledgerEntryBase,
      accountId: PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID,
      description: `Freight income from Bilti ${biltiData.id}`,
      debit: 0,
      credit: freightAmount,
    })
  }

  // Insert all ledger entries
  const { error: ledgerError } = await supabase
    .from('ledger_entries')
    .insert(ledgerEntries)

  if (ledgerError) throw ledgerError

  // Update bilti as processed
  const { error: updateError } = await supabase
    .from('biltis')
    .update({ ledgerProcessed: true, updatedAt: new Date() })
    .eq('id', biltiData.id)

  if (updateError) throw updateError

  return new Response(
    JSON.stringify({ message: 'Bilti ledger entries processed successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handlePostGoodsDeliveryLedgerEntries(supabase: any, deliveryData: GoodsDeliveryData) {
  if (!deliveryData || deliveryData.ledgerProcessed || !deliveryData.deliveredBiltis || deliveryData.deliveredBiltis.length === 0) {
    if (deliveryData && (!deliveryData.deliveredBiltis || deliveryData.deliveredBiltis.length === 0)) {
      await supabase
        .from('goods_deliveries')
        .update({ ledgerProcessed: true, updatedAt: new Date() })
        .eq('id', deliveryData.id)
    }
    return new Response(
      JSON.stringify({ message: 'Goods Delivery not eligible for processing' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const ledgerEntries: LedgerEntryData[] = []

  for (const item of deliveryData.deliveredBiltis) {
    // Get bilti data
    const { data: bilti, error: biltiError } = await supabase
      .from('biltis')
      .select('*')
      .eq('id', item.biltiId)
      .single()

    if (biltiError || !bilti) continue

    // Get party data
    const { data: partyToCredit, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', bilti.consigneeId)
      .single()

    if (partyError || !partyToCredit) continue

    const ledgerEntryBase: Omit<LedgerEntryData, 'id' | 'accountId' | 'debit' | 'credit' | 'description' | 'transactionType'> = {
      miti: deliveryData.miti,
      nepaliMiti: deliveryData.nepaliMiti || '',
      referenceNo: `GD-${deliveryData.id}-BLT-${item.biltiId}`,
      sourceModule: 'GoodsDelivery',
      status: 'Approved',
      createdAt: new Date(),
      createdBy: deliveryData.createdBy || 'system-goods-delivery-processor',
    }

    // Add rebate entry if applicable
    if (item.rebateAmount > 0) {
      ledgerEntries.push({
        ...ledgerEntryBase,
        accountId: partyToCredit.assignedLedgerId,
        description: `Rebate for Bilti ${item.biltiId}: ${item.rebateReason || 'No reason provided'}`,
        debit: 0,
        credit: item.rebateAmount,
        transactionType: 'Rebate',
      })
      ledgerEntries.push({
        ...ledgerEntryBase,
        accountId: PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID,
        description: `Rebate expense for Bilti ${item.biltiId}`,
        debit: item.rebateAmount,
        credit: 0,
        transactionType: 'Rebate',
      })
    }

    // Add discount entry if applicable
    if (item.discountAmount > 0) {
      ledgerEntries.push({
        ...ledgerEntryBase,
        accountId: partyToCredit.assignedLedgerId,
        description: `Discount for Bilti ${item.biltiId}: ${item.discountReason || 'No reason provided'}`,
        debit: 0,
        credit: item.discountAmount,
        transactionType: 'Discount',
      })
      ledgerEntries.push({
        ...ledgerEntryBase,
        accountId: PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID,
        description: `Discount expense for Bilti ${item.biltiId}`,
        debit: item.discountAmount,
        credit: 0,
        transactionType: 'Discount',
      })
    }
  }

  // Insert all ledger entries
  const { error: ledgerError } = await supabase
    .from('ledger_entries')
    .insert(ledgerEntries)

  if (ledgerError) throw ledgerError

  // Update goods delivery as processed
  const { error: updateError } = await supabase
    .from('goods_deliveries')
    .update({ ledgerProcessed: true, updatedAt: new Date() })
    .eq('id', deliveryData.id)

  if (updateError) throw updateError

  return new Response(
    JSON.stringify({ message: 'Goods Delivery ledger entries processed successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Additional handler functions will be implemented similarly... 