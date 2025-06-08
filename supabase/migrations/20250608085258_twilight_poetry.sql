/*
  # Fix users table schema

  1. Changes
    - Drop the existing users table if it exists
    - Create required enum types for user roles and status
    - Recreate users table with correct schema that matches auth expectations
    - Use `id` field as primary key to match Supabase auth user IDs
    - Remove `uid` field and use `id` instead
    - Add proper RLS policies for authenticated users

  2. Security
    - Enable RLS on users table
    - Add policies for users to read and update their own data
    - Add policy for service role to manage all users
*/

-- Drop existing users table if it exists
DROP TABLE IF EXISTS users CASCADE;

-- Create user_role enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'manager', 'operator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table with correct schema
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  display_name text,
  role user_role NOT NULL DEFAULT 'operator',
  assigned_branch_ids text[] DEFAULT '{}',
  status user_status DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by text,
  last_login_at timestamp with time zone,
  enable_email_notifications boolean DEFAULT false,
  dark_mode_enabled boolean DEFAULT false,
  auto_data_sync_enabled boolean DEFAULT false,
  updated_at timestamp with time zone,
  updated_by text
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage all users"
  ON users
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);