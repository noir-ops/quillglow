-- Create tasks table for study planner
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  subject TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pomodoro_sessions table
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create flashcard_decks table
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[],
  image_url TEXT,
  difficulty INTEGER DEFAULT 3,
  next_review_date TIMESTAMPTZ DEFAULT NOW(),
  review_interval_days INTEGER DEFAULT 1,
  times_reviewed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  subject TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create mood_logs table for analytics
CREATE TABLE IF NOT EXISTS mood_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for pomodoro_sessions
CREATE POLICY "Users can view own sessions" ON pomodoro_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON pomodoro_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON pomodoro_sessions FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for flashcard_decks
CREATE POLICY "Users can view own decks" ON flashcard_decks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decks" ON flashcard_decks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON flashcard_decks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own decks" ON flashcard_decks FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for flashcards
CREATE POLICY "Users can view own flashcards" ON flashcards FOR SELECT USING (
  EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own flashcards" ON flashcards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid())
);
CREATE POLICY "Users can update own flashcards" ON flashcards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own flashcards" ON flashcards FOR DELETE USING (
  EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid())
);

-- RLS Policies for notes
CREATE POLICY "Users can view own notes" ON notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for mood_logs
CREATE POLICY "Users can view own mood logs" ON mood_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mood logs" ON mood_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_pomodoro_user_id ON pomodoro_sessions(user_id);
CREATE INDEX idx_flashcard_decks_user_id ON flashcard_decks(user_id);
CREATE INDEX idx_flashcards_deck_id ON flashcards(deck_id);
CREATE INDEX idx_flashcards_next_review ON flashcards(next_review_date);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_mood_logs_user_id ON mood_logs(user_id);
