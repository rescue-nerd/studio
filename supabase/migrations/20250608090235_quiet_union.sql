-- Create invoice_line_customizations table with proper quoting for reserved keywords
CREATE TABLE IF NOT EXISTS invoice_line_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  field_name TEXT NOT NULL,
  type TEXT NOT NULL,
  required BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  options TEXT[] DEFAULT '{}',
  default_value TEXT,
  "order" INTEGER NOT NULL, -- Quoted to avoid SQL reserved keyword error
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT
);

-- Enable Row Level Security
ALTER TABLE invoice_line_customizations ENABLE ROW LEVEL SECURITY;

-- Create policy for invoice_line_customizations
CREATE POLICY "Allow all access for authenticated users"
  ON invoice_line_customizations
  FOR ALL
  TO authenticated
  USING (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_invoice_line_customizations_order ON invoice_line_customizations("order");