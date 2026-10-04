-- Create study_plans table
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration TEXT,
  goals_text TEXT[],
  tips TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create study_plan_goals table
CREATE TABLE IF NOT EXISTS study_plan_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  due_date DATE,
  estimated_hours INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for study_plans
CREATE POLICY "Users can view own study plans" ON study_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study plans" ON study_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study plans" ON study_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own study plans" ON study_plans FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for study_plan_goals
CREATE POLICY "Users can view own goals" ON study_plan_goals FOR SELECT USING (
  EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_goals.plan_id AND study_plans.user_id = auth.uid())
);
CREATE POLICY "Users can insert own goals" ON study_plan_goals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_goals.plan_id AND study_plans.user_id = auth.uid())
);
CREATE POLICY "Users can update own goals" ON study_plan_goals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_goals.plan_id AND study_plans.user_id = auth.uid())
);
CREATE POLICY "Users can delete own goals" ON study_plan_goals FOR DELETE USING (
  EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_goals.plan_id AND study_plans.user_id = auth.uid())
);

-- Create indexes
CREATE INDEX idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX idx_study_plans_dates ON study_plans(start_date, end_date);
CREATE INDEX idx_study_plan_goals_plan_id ON study_plan_goals(plan_id);
CREATE INDEX idx_study_plan_goals_completed ON study_plan_goals(completed);
CREATE INDEX idx_study_plan_goals_due_date ON study_plan_goals(due_date);
