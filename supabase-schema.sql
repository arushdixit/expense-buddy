-- Supabase SQL Schema for Expense Buddy
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ===========================================
-- 1. CREATE TABLES
-- ===========================================

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(category, name)
);

-- ===========================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_updated_at ON expenses(updated_at);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category);

-- ===========================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on both tables
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations for now (public access)
-- For a production app, you'd want to restrict this to authenticated users

-- Expenses policies
CREATE POLICY "Allow public read access on expenses" 
  ON expenses FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access on expenses" 
  ON expenses FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update access on expenses" 
  ON expenses FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access on expenses" 
  ON expenses FOR DELETE 
  USING (true);

-- Subcategories policies
CREATE POLICY "Allow public read access on subcategories" 
  ON subcategories FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access on subcategories" 
  ON subcategories FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update access on subcategories" 
  ON subcategories FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access on subcategories" 
  ON subcategories FOR DELETE 
  USING (true);

-- ===========================================
-- 4. SEED DEFAULT SUBCATEGORIES
-- ===========================================

INSERT INTO subcategories (category, name) VALUES
  -- Groceries
  ('Groceries', 'Carrefour'),
  ('Groceries', 'Noon'),
  ('Groceries', 'Careem'),
  ('Groceries', 'West Zone'),
  ('Groceries', 'Talabat'),
  ('Groceries', 'Amazon Now'),
  ('Groceries', 'Grandiose'),
  ('Groceries', 'Spinneys'),
  ('Groceries', 'Madhoor'),
  ('Groceries', 'Lulu'),
  ('Groceries', 'Refund'),
  -- Shopping
  ('Shopping', 'Clothes'),
  ('Shopping', 'Skincare'),
  ('Shopping', 'Accessories'),
  ('Shopping', 'Miscellaneous'),
  ('Shopping', 'Refund'),
  -- Entertainment
  ('Entertainment', 'Dine-out'),
  ('Entertainment', 'Food Delivery'),
  ('Entertainment', 'Activities'),
  ('Entertainment', 'Expo Tickets'),
  ('Entertainment', 'Snacks'),
  ('Entertainment', 'Refund'),
  -- Utilities
  ('Utilities', 'Cook Salary'),
  ('Utilities', 'Internet'),
  ('Utilities', 'DEWA'),
  ('Utilities', 'Mobile Recharge'),
  ('Utilities', 'Chiller'),
  ('Utilities', 'Refund'),
  -- Grooming
  ('Grooming', 'Haircut'),
  ('Grooming', 'Waxing'),
  ('Grooming', 'Refund'),
  -- Transport
  ('Transport', 'Nol Card'),
  ('Transport', 'Taxi'),
  ('Transport', 'Refund'),
  -- Luxury
  ('Luxury', 'Refund')
ON CONFLICT (category, name) DO NOTHING;
