-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Create enum types
create type user_role as enum ('super_admin', 'admin', 'manager', 'operator');
create type user_status as enum ('active', 'inactive', 'disabled');
create type status as enum ('active', 'inactive', 'disabled');
create type party_type as enum ('consignor', 'consignee', 'both');
create type pay_mode as enum ('cash', 'credit', 'bank_transfer');
create type cash_collection_status as enum ('Pending', 'collected', 'partially_collected');
create type document_type as enum ('bilti', 'manifest', 'goods_receipt', 'goods_delivery', 'daybook');
create type party_status as enum ('Active', 'Inactive');
create type truck_status as enum ('Active', 'Inactive', 'Maintenance');
create type driver_status as enum ('Active', 'Inactive', 'On Leave');
create type godown_status as enum ('Active', 'Inactive', 'Operational');
create type bilti_pay_mode as enum ('Paid', 'To Pay', 'Due');
create type bilti_status as enum ('Pending', 'Manifested', 'Received', 'Delivered', 'Paid', 'Cancelled');
create type manifest_status as enum ('Open', 'In Transit', 'Received', 'Completed', 'Cancelled');

-- Create users table
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  uid text unique not null,
  email text unique,
  display_name text,
  role user_role not null default 'operator',
  assigned_branch_ids text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  last_login_at timestamp with time zone,
  enable_email_notifications boolean default false,
  dark_mode_enabled boolean default false,
  auto_data_sync_enabled boolean default false,
  updated_at timestamp with time zone,
  updated_by text,
  status user_status default 'active'
);

-- Create branches table
create table if not exists branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text not null,
  manager_name text,
  manager_user_id text references users(uid),
  contact_email text,
  contact_phone text,
  status party_status default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create locations table
create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('country', 'state', 'city')),
  parent_id uuid references locations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create units table
create table if not exists units (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('weight', 'volume', 'length', 'count')),
  symbol text not null,
  conversion_factor decimal(10,2) default 1.0,
  is_base_unit boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create document_numbering_configs table
create table if not exists document_numbering_configs (
  id uuid primary key default uuid_generate_v4(),
  document_type document_type not null,
  prefix text,
  suffix text,
  start_number integer not null,
  current_number integer not null,
  padding_length integer default 4,
  branch_id uuid references branches(id),
  fiscal_year text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by text,
  unique(document_type, branch_id, fiscal_year)
);

-- Create daybooks table
create table if not exists daybooks (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid references branches(id) not null,
  nepali_miti text not null,
  transactions jsonb[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references users(id),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references users(id)
);

-- Create daybook_entries table
create table if not exists daybook_entries (
  id uuid primary key default uuid_generate_v4(),
  miti timestamp with time zone not null,
  nepali_miti text not null,
  entry_type text not null check (entry_type in ('receipt', 'payment')),
  amount decimal(10,2) not null,
  description text,
  reference_type text,
  reference_id text,
  branch_id uuid references branches(id),
  status status default 'active',
  is_approved boolean default false,
  approved_by text,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by text
);

-- Create daybook_attachments table
create table if not exists daybook_attachments (
  id uuid primary key default uuid_generate_v4(),
  daybook_entry_id uuid references daybook_entries(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  file_size integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text
);

-- Create parties table
create table if not exists parties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type party_type not null,
  contact_no text not null,
  pan_no text,
  address text,
  city text,
  state text,
  country text,
  assigned_ledger_id text not null,
  status party_status default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create trucks table
create table if not exists trucks (
  id uuid primary key default uuid_generate_v4(),
  truck_no text not null,
  type text not null,
  capacity text,
  owner_name text not null,
  owner_pan text,
  status truck_status default 'Active',
  assigned_ledger_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create drivers table
create table if not exists drivers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  license_no text not null,
  contact_no text not null,
  address text,
  joining_date timestamp with time zone,
  status driver_status default 'Active',
  assigned_ledger_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create godowns table
create table if not exists godowns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  branch_id uuid references branches(id) not null,
  location text not null,
  status godown_status default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create biltis table
create table if not exists biltis (
  id uuid primary key default uuid_generate_v4(),
  miti timestamp with time zone not null,
  nepali_miti text,
  consignor_id uuid references parties(id) not null,
  consignee_id uuid references parties(id) not null,
  origin text not null,
  destination text not null,
  description text not null,
  packages integer not null,
  weight numeric,
  rate numeric not null,
  total_amount numeric not null,
  pay_mode bilti_pay_mode not null,
  status bilti_status default 'Pending',
  manifest_id uuid,
  goods_delivery_note_id uuid,
  cash_collection_status cash_collection_status default 'Pending',
  truck_id uuid references trucks(id) not null,
  driver_id uuid references drivers(id) not null,
  ledger_processed boolean default false,
  branch_id uuid references branches(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create manifests table
create table if not exists manifests (
  id uuid primary key default uuid_generate_v4(),
  miti timestamp with time zone not null,
  nepali_miti text,
  truck_id uuid references trucks(id) not null,
  driver_id uuid references drivers(id) not null,
  from_branch_id uuid references branches(id) not null,
  to_branch_id uuid references branches(id) not null,
  attached_bilti_ids uuid[] default '{}',
  remarks text,
  status manifest_status default 'Open',
  goods_receipt_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create goods_receipts table
create table if not exists goods_receipts (
  id uuid primary key default uuid_generate_v4(),
  miti timestamp with time zone not null,
  nepali_miti text,
  manifest_id uuid references manifests(id) not null,
  receiving_branch_id uuid references branches(id) not null,
  receiving_godown_id uuid references godowns(id),
  remarks text,
  shortages text,
  damages text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create delivered_bilti_items table
create table if not exists delivered_bilti_items (
  id uuid primary key default uuid_generate_v4(),
  goods_delivery_id uuid not null,
  bilti_id uuid references biltis(id) not null,
  rebate_amount numeric not null default 0,
  rebate_reason text,
  discount_amount numeric not null default 0,
  discount_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create goods_deliveries table
create table if not exists goods_deliveries (
  id uuid primary key default uuid_generate_v4(),
  miti timestamp with time zone not null,
  nepali_miti text,
  overall_remarks text,
  delivered_to_name text,
  delivered_to_contact text,
  ledger_processed boolean default false,
  branch_id uuid references branches(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create ledger_accounts table
create table if not exists ledger_accounts (
  id uuid primary key default uuid_generate_v4(),
  account_id text unique not null,
  account_name text not null,
  account_type text not null,
  parent_account_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text not null,
  updated_at timestamp with time zone,
  updated_by text
);

-- Create narration_templates table
create table if not exists narration_templates (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  template text not null,
  applicable_to text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references users(id),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references users(id)
);

-- Create invoice_line_customizations table
create table if not exists invoice_line_customizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null,
  data jsonb not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references users(id),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references users(id)
);

-- Create ledger_entries table
create table if not exists ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  account_id text not null,
  miti text not null,
  type text not null,
  amount numeric not null,
  reference_id uuid,
  reference_type text,
  data jsonb not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references users(id),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references users(id)
);

-- Create indexes
create index if not exists idx_users_uid on users(uid);
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_role on users(role);
create index if not exists idx_branches_name on branches(name);
create index if not exists idx_parties_name on parties(name);
create index if not exists idx_parties_type on parties(type);
create index if not exists idx_trucks_truck_no on trucks(truck_no);
create index if not exists idx_drivers_license_no on drivers(license_no);
create index if not exists idx_godowns_branch_id on godowns(branch_id);
create index if not exists idx_biltis_miti on biltis(miti);
create index if not exists idx_biltis_status on biltis(status);
create index if not exists idx_biltis_branch_id on biltis(branch_id);
create index if not exists idx_manifests_miti on manifests(miti);
create index if not exists idx_manifests_status on manifests(status);
create index if not exists idx_goods_receipts_miti on goods_receipts(miti);
create index if not exists idx_goods_deliveries_miti on goods_deliveries(miti);
create index if not exists idx_ledger_accounts_account_id on ledger_accounts(account_id);

-- Enable Row Level Security
alter table users enable row level security;
alter table branches enable row level security;
alter table document_numbering_configs enable row level security;
alter table daybooks enable row level security;
alter table parties enable row level security;
alter table trucks enable row level security;
alter table drivers enable row level security;
alter table godowns enable row level security;
alter table biltis enable row level security;
alter table manifests enable row level security;
alter table goods_receipts enable row level security;
alter table delivered_bilti_items enable row level security;
alter table goods_deliveries enable row level security;
alter table ledger_accounts enable row level security;
alter table narration_templates enable row level security;
alter table invoice_line_customizations enable row level security;
alter table ledger_entries enable row level security;

-- Enable RLS on new tables
alter table locations enable row level security;
alter table units enable row level security;
alter table daybook_entries enable row level security;
alter table daybook_attachments enable row level security;

-- Create indexes for new tables
create index if not exists idx_locations_type on locations(type);
create index if not exists idx_locations_parent_id on locations(parent_id);
create index if not exists idx_units_type on units(type);
create index if not exists idx_document_numbering_configs_document_type on document_numbering_configs(document_type);
create index if not exists idx_document_numbering_configs_branch_id on document_numbering_configs(branch_id);
create index if not exists idx_daybook_entries_miti on daybook_entries(miti);
create index if not exists idx_daybook_entries_branch_id on daybook_entries(branch_id);
create index if not exists idx_daybook_entries_status on daybook_entries(status);
create index if not exists idx_daybook_attachments_daybook_entry_id on daybook_attachments(daybook_entry_id); 