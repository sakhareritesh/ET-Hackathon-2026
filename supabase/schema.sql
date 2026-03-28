-- ============================================================
-- DhanGuru — Full Supabase Schema
-- Run this in your Supabase SQL Editor (safe to re-run)
-- ============================================================

-- 1. Profiles (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  age INT,
  city TEXT,
  is_metro BOOLEAN DEFAULT false,
  marital_status TEXT DEFAULT 'single',
  dependents INT DEFAULT 0,
  risk_profile TEXT DEFAULT 'moderate',
  employment_type TEXT DEFAULT 'salaried',
  tax_regime TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Income details (one row per user)
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  gross_salary FLOAT DEFAULT 0,
  basic_salary FLOAT DEFAULT 0,
  hra_received FLOAT DEFAULT 0,
  special_allowance FLOAT DEFAULT 0,
  other_income FLOAT DEFAULT 0,
  monthly_expenses FLOAT DEFAULT 0,
  rent_paid FLOAT DEFAULT 0,
  expense_breakdown JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Investments
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT,
  name TEXT,
  invested_amount FLOAT DEFAULT 0,
  current_value FLOAT DEFAULT 0,
  monthly_sip FLOAT DEFAULT 0,
  start_date DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Insurance policies
CREATE TABLE IF NOT EXISTS insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT,
  provider TEXT,
  cover_amount FLOAT DEFAULT 0,
  premium_annual FLOAT DEFAULT 0,
  policy_term INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Debts / Loans
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT,
  outstanding_amount FLOAT DEFAULT 0,
  emi_monthly FLOAT DEFAULT 0,
  interest_rate FLOAT DEFAULT 0,
  remaining_months INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tax deductions
CREATE TABLE IF NOT EXISTS tax_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  financial_year TEXT DEFAULT '2025-26',
  section_80c FLOAT DEFAULT 0,
  section_80d_self FLOAT DEFAULT 0,
  section_80d_parents FLOAT DEFAULT 0,
  nps_80ccd1b FLOAT DEFAULT 0,
  home_loan_interest FLOAT DEFAULT 0,
  other_deductions FLOAT DEFAULT 0,
  deduction_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Financial goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  category TEXT,
  target_amount FLOAT,
  target_date DATE,
  current_savings FLOAT DEFAULT 0,
  monthly_sip FLOAT DEFAULT 0,
  priority INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Health score history
CREATE TABLE IF NOT EXISTS health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  overall_score FLOAT,
  emergency_score FLOAT,
  insurance_score FLOAT,
  investment_score FLOAT,
  debt_score FLOAT,
  tax_score FLOAT,
  retirement_score FLOAT,
  recommendations JSONB,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Tax analysis history
CREATE TABLE IF NOT EXISTS tax_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  financial_year TEXT,
  old_regime_tax FLOAT,
  new_regime_tax FLOAT,
  recommended_regime TEXT,
  missed_deductions JSONB,
  savings_potential FLOAT,
  full_result JSONB,
  analyzed_at TIMESTAMPTZ DEFAULT now()
);

-- 10. MF portfolio snapshots
CREATE TABLE IF NOT EXISTS mf_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total_invested FLOAT,
  current_value FLOAT,
  xirr FLOAT,
  holdings JSONB,
  overlap_matrix JSONB,
  rebalancing_plan JSONB,
  ai_summary TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT now()
);

-- 11. FIRE plans
CREATE TABLE IF NOT EXISTS fire_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  fire_number FLOAT,
  years_to_fire INT,
  monthly_sip_required FLOAT,
  success_probability FLOAT,
  monte_carlo_data JSONB,
  allocation JSONB,
  glide_path JSONB,
  roadmap JSONB,
  input_params JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Life events
CREATE TABLE IF NOT EXISTS life_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT,
  event_date DATE,
  amount FLOAT,
  description TEXT,
  advice JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Couples
CREATE TABLE IF NOT EXISTS couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_a UUID REFERENCES profiles(id),
  partner_b UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending',
  optimization_results JSONB,
  combined_net_worth FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Chat messages (AI Mentor history)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT,
  content TEXT,
  tool_used TEXT,
  tool_result JSONB,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mf_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fire_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies (DROP IF EXISTS for safe re-runs)
-- ============================================================
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users manage own income" ON income;
CREATE POLICY "Users manage own income" ON income
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own investments" ON investments;
CREATE POLICY "Users manage own investments" ON investments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own insurance" ON insurance;
CREATE POLICY "Users manage own insurance" ON insurance
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own debts" ON debts;
CREATE POLICY "Users manage own debts" ON debts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own tax_deductions" ON tax_deductions;
CREATE POLICY "Users manage own tax_deductions" ON tax_deductions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own goals" ON goals;
CREATE POLICY "Users manage own goals" ON goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own health_scores" ON health_scores;
CREATE POLICY "Users manage own health_scores" ON health_scores
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own tax_analyses" ON tax_analyses;
CREATE POLICY "Users manage own tax_analyses" ON tax_analyses
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own mf_portfolios" ON mf_portfolios;
CREATE POLICY "Users manage own mf_portfolios" ON mf_portfolios
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own fire_plans" ON fire_plans;
CREATE POLICY "Users manage own fire_plans" ON fire_plans
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own life_events" ON life_events;
CREATE POLICY "Users manage own life_events" ON life_events
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own couples" ON couples;
CREATE POLICY "Users manage own couples" ON couples
  FOR ALL USING (auth.uid() = partner_a OR auth.uid() = partner_b)
  WITH CHECK (auth.uid() = partner_a OR auth.uid() = partner_b);

DROP POLICY IF EXISTS "Users manage own chat" ON chat_messages;
CREATE POLICY "Users manage own chat" ON chat_messages
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
