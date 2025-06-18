export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      biltis: {
        Row: {
          branch_id: string | null
          cash_collection_status:
            | Database["public"]["Enums"]["cash_collection_status"]
            | null
          consignee_id: string
          consignor_id: string
          created_at: string
          created_by: string
          description: string
          destination: string
          driver_id: string
          goods_delivery_note_id: string | null
          id: string
          ledger_processed: boolean | null
          manifest_id: string | null
          miti: string
          nepali_miti: string | null
          origin: string
          packages: number
          pay_mode: Database["public"]["Enums"]["bilti_pay_mode"]
          rate: number
          status: Database["public"]["Enums"]["bilti_status"] | null
          total_amount: number
          truck_id: string
          updated_at: string | null
          updated_by: string | null
          weight: number | null
        }
        Insert: {
          branch_id?: string | null
          cash_collection_status?:
            | Database["public"]["Enums"]["cash_collection_status"]
            | null
          consignee_id: string
          consignor_id: string
          created_at?: string
          created_by: string
          description: string
          destination: string
          driver_id: string
          goods_delivery_note_id?: string | null
          id?: string
          ledger_processed?: boolean | null
          manifest_id?: string | null
          miti: string
          nepali_miti?: string | null
          origin: string
          packages: number
          pay_mode: Database["public"]["Enums"]["bilti_pay_mode"]
          rate: number
          status?: Database["public"]["Enums"]["bilti_status"] | null
          total_amount: number
          truck_id: string
          updated_at?: string | null
          updated_by?: string | null
          weight?: number | null
        }
        Update: {
          branch_id?: string | null
          cash_collection_status?:
            | Database["public"]["Enums"]["cash_collection_status"]
            | null
          consignee_id?: string
          consignor_id?: string
          created_at?: string
          created_by?: string
          description?: string
          destination?: string
          driver_id?: string
          goods_delivery_note_id?: string | null
          id?: string
          ledger_processed?: boolean | null
          manifest_id?: string | null
          miti?: string
          nepali_miti?: string | null
          origin?: string
          packages?: number
          pay_mode?: Database["public"]["Enums"]["bilti_pay_mode"]
          rate?: number
          status?: Database["public"]["Enums"]["bilti_status"] | null
          total_amount?: number
          truck_id?: string
          updated_at?: string | null
          updated_by?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "biltis_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biltis_consignee_id_fkey"
            columns: ["consignee_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biltis_consignor_id_fkey"
            columns: ["consignor_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biltis_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biltis_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          id: string
          location: string
          manager_name: string | null
          manager_user_id: string | null
          name: string
          status: Database["public"]["Enums"]["party_status"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          id?: string
          location: string
          manager_name?: string | null
          manager_user_id?: string | null
          name: string
          status?: Database["public"]["Enums"]["party_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          id?: string
          location?: string
          manager_name?: string | null
          manager_user_id?: string | null
          name?: string
          status?: Database["public"]["Enums"]["party_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      daybook_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          daybook_entry_id: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daybook_entry_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daybook_entry_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daybook_attachments_daybook_entry_id_fkey"
            columns: ["daybook_entry_id"]
            isOneToOne: false
            referencedRelation: "daybook_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      daybook_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entry_type: string
          id: string
          is_approved: boolean | null
          miti: string
          nepali_miti: string
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["status"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_type: string
          id?: string
          is_approved?: boolean | null
          miti: string
          nepali_miti: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["status"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          is_approved?: boolean | null
          miti?: string
          nepali_miti?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["status"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daybook_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      daybooks: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          nepali_miti: string
          transactions: Json[] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          nepali_miti: string
          transactions?: Json[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nepali_miti?: string
          transactions?: Json[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daybooks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      delivered_bilti_items: {
        Row: {
          bilti_id: string
          created_at: string
          created_by: string
          discount_amount: number
          discount_reason: string | null
          goods_delivery_id: string
          id: string
          rebate_amount: number
          rebate_reason: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bilti_id: string
          created_at?: string
          created_by: string
          discount_amount?: number
          discount_reason?: string | null
          goods_delivery_id: string
          id?: string
          rebate_amount?: number
          rebate_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bilti_id?: string
          created_at?: string
          created_by?: string
          discount_amount?: number
          discount_reason?: string | null
          goods_delivery_id?: string
          id?: string
          rebate_amount?: number
          rebate_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivered_bilti_items_bilti_id_fkey"
            columns: ["bilti_id"]
            isOneToOne: false
            referencedRelation: "biltis"
            referencedColumns: ["id"]
          },
        ]
      }
      document_numbering_configs: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          current_number: number
          document_type: Database["public"]["Enums"]["document_type"]
          fiscal_year: string | null
          id: string
          is_active: boolean | null
          padding_length: number | null
          prefix: string | null
          start_number: number
          suffix: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          current_number: number
          document_type: Database["public"]["Enums"]["document_type"]
          fiscal_year?: string | null
          id?: string
          is_active?: boolean | null
          padding_length?: number | null
          prefix?: string | null
          start_number: number
          suffix?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          current_number?: number
          document_type?: Database["public"]["Enums"]["document_type"]
          fiscal_year?: string | null
          id?: string
          is_active?: boolean | null
          padding_length?: number | null
          prefix?: string | null
          start_number?: number
          suffix?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_numbering_configs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          assigned_ledger_id: string
          contact_no: string
          created_at: string
          created_by: string
          id: string
          joining_date: string | null
          license_no: string
          name: string
          status: Database["public"]["Enums"]["driver_status"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          assigned_ledger_id: string
          contact_no: string
          created_at?: string
          created_by: string
          id?: string
          joining_date?: string | null
          license_no: string
          name: string
          status?: Database["public"]["Enums"]["driver_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          assigned_ledger_id?: string
          contact_no?: string
          created_at?: string
          created_by?: string
          id?: string
          joining_date?: string | null
          license_no?: string
          name?: string
          status?: Database["public"]["Enums"]["driver_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      godowns: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          id: string
          location: string
          name: string
          status: Database["public"]["Enums"]["godown_status"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          id?: string
          location: string
          name: string
          status?: Database["public"]["Enums"]["godown_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          location?: string
          name?: string
          status?: Database["public"]["Enums"]["godown_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_deliveries: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          delivered_to_contact: string | null
          delivered_to_name: string | null
          id: string
          ledger_processed: boolean | null
          miti: string
          nepali_miti: string | null
          overall_remarks: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          delivered_to_contact?: string | null
          delivered_to_name?: string | null
          id?: string
          ledger_processed?: boolean | null
          miti: string
          nepali_miti?: string | null
          overall_remarks?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          delivered_to_contact?: string | null
          delivered_to_name?: string | null
          id?: string
          ledger_processed?: boolean | null
          miti?: string
          nepali_miti?: string | null
          overall_remarks?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_deliveries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string
          created_by: string
          damages: string | null
          id: string
          manifest_id: string
          miti: string
          nepali_miti: string | null
          receiving_branch_id: string
          receiving_godown_id: string | null
          remarks: string | null
          shortages: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          damages?: string | null
          id?: string
          manifest_id: string
          miti: string
          nepali_miti?: string | null
          receiving_branch_id: string
          receiving_godown_id?: string | null
          remarks?: string | null
          shortages?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          damages?: string | null
          id?: string
          manifest_id?: string
          miti?: string
          nepali_miti?: string | null
          receiving_branch_id?: string
          receiving_godown_id?: string | null
          remarks?: string | null
          shortages?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_receiving_branch_id_fkey"
            columns: ["receiving_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_receiving_godown_id_fkey"
            columns: ["receiving_godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_customizations: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          name: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          name: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          name?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ledger_accounts: {
        Row: {
          account_id: string
          account_name: string
          account_type: string
          created_at: string
          created_by: string
          id: string
          parent_account_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_id: string
          account_name: string
          account_type: string
          created_at?: string
          created_by: string
          id?: string
          parent_account_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string
          account_type?: string
          created_at?: string
          created_by?: string
          id?: string
          parent_account_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          data: Json
          id: string
          miti: string
          reference_id: string | null
          reference_type: string | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          miti: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          miti?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      manifests: {
        Row: {
          attached_bilti_ids: string[] | null
          created_at: string
          created_by: string
          driver_id: string
          from_branch_id: string
          goods_receipt_id: string | null
          id: string
          miti: string
          nepali_miti: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["manifest_status"] | null
          to_branch_id: string
          truck_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          attached_bilti_ids?: string[] | null
          created_at?: string
          created_by: string
          driver_id: string
          from_branch_id: string
          goods_receipt_id?: string | null
          id?: string
          miti: string
          nepali_miti?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["manifest_status"] | null
          to_branch_id: string
          truck_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          attached_bilti_ids?: string[] | null
          created_at?: string
          created_by?: string
          driver_id?: string
          from_branch_id?: string
          goods_receipt_id?: string | null
          id?: string
          miti?: string
          nepali_miti?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["manifest_status"] | null
          to_branch_id?: string
          truck_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manifests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_templates: {
        Row: {
          applicable_to: string[] | null
          created_at: string
          created_by: string | null
          id: string
          template: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applicable_to?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          template: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applicable_to?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          template?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      parties: {
        Row: {
          address: string | null
          assigned_ledger_id: string
          city: string | null
          contact_no: string
          country: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          pan_no: string | null
          state: string | null
          status: Database["public"]["Enums"]["party_status"] | null
          type: Database["public"]["Enums"]["party_type"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          assigned_ledger_id: string
          city?: string | null
          contact_no: string
          country?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          pan_no?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["party_status"] | null
          type: Database["public"]["Enums"]["party_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          assigned_ledger_id?: string
          city?: string | null
          contact_no?: string
          country?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          pan_no?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["party_status"] | null
          type?: Database["public"]["Enums"]["party_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      trucks: {
        Row: {
          assigned_ledger_id: string
          capacity: string | null
          created_at: string
          created_by: string
          id: string
          owner_name: string
          owner_pan: string | null
          status: Database["public"]["Enums"]["truck_status"] | null
          truck_no: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_ledger_id: string
          capacity?: string | null
          created_at?: string
          created_by: string
          id?: string
          owner_name: string
          owner_pan?: string | null
          status?: Database["public"]["Enums"]["truck_status"] | null
          truck_no: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_ledger_id?: string
          capacity?: string | null
          created_at?: string
          created_by?: string
          id?: string
          owner_name?: string
          owner_pan?: string | null
          status?: Database["public"]["Enums"]["truck_status"] | null
          truck_no?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          conversion_factor: number | null
          created_at: string
          created_by: string | null
          id: string
          is_base_unit: boolean | null
          name: string
          symbol: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_base_unit?: boolean | null
          name: string
          symbol: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_base_unit?: boolean | null
          name?: string
          symbol?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          assigned_branch_ids: string[] | null
          auto_data_sync_enabled: boolean | null
          created_at: string
          created_by: string | null
          dark_mode_enabled: boolean | null
          display_name: string | null
          email: string
          enable_email_notifications: boolean | null
          id: string
          last_login_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_branch_ids?: string[] | null
          auto_data_sync_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          dark_mode_enabled?: boolean | null
          display_name?: string | null
          email: string
          enable_email_notifications?: boolean | null
          id: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_branch_ids?: string[] | null
          auto_data_sync_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          dark_mode_enabled?: boolean | null
          display_name?: string | null
          email?: string
          enable_email_notifications?: boolean | null
          id?: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      bilti_pay_mode: "Paid" | "To Pay" | "Due"
      bilti_status:
        | "Pending"
        | "Manifested"
        | "Received"
        | "Delivered"
        | "Paid"
        | "Cancelled"
      cash_collection_status: "Pending" | "collected" | "partially_collected"
      document_type:
        | "bilti"
        | "manifest"
        | "goods_receipt"
        | "goods_delivery"
        | "daybook"
      driver_status: "Active" | "Inactive" | "On Leave"
      godown_status: "Active" | "Inactive" | "Operational"
      manifest_status:
        | "Open"
        | "In Transit"
        | "Received"
        | "Completed"
        | "Cancelled"
      party_status: "Active" | "Inactive"
      party_type: "consignor" | "consignee" | "both"
      pay_mode: "cash" | "credit" | "bank_transfer"
      status: "active" | "inactive" | "disabled"
      truck_status: "Active" | "Inactive" | "Maintenance"
      user_role: "super_admin" | "admin" | "manager" | "operator"
      user_status: "active" | "inactive" | "disabled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bilti_pay_mode: ["Paid", "To Pay", "Due"],
      bilti_status: [
        "Pending",
        "Manifested",
        "Received",
        "Delivered",
        "Paid",
        "Cancelled",
      ],
      cash_collection_status: ["Pending", "collected", "partially_collected"],
      document_type: [
        "bilti",
        "manifest",
        "goods_receipt",
        "goods_delivery",
        "daybook",
      ],
      driver_status: ["Active", "Inactive", "On Leave"],
      godown_status: ["Active", "Inactive", "Operational"],
      manifest_status: [
        "Open",
        "In Transit",
        "Received",
        "Completed",
        "Cancelled",
      ],
      party_status: ["Active", "Inactive"],
      party_type: ["consignor", "consignee", "both"],
      pay_mode: ["cash", "credit", "bank_transfer"],
      status: ["active", "inactive", "disabled"],
      truck_status: ["Active", "Inactive", "Maintenance"],
      user_role: ["super_admin", "admin", "manager", "operator"],
      user_status: ["active", "inactive", "disabled"],
    },
  },
} as const

