-- Create contact_messages table for tracking support tickets
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on ticket_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_contact_messages_ticket_number ON contact_messages(ticket_number);

-- Create index on email for tracking user messages
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);

-- Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (submit contact form)
CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Users can view their own messages by email
CREATE POLICY "Users can view their own messages"
  ON contact_messages
  FOR SELECT
  TO public
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Function to generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  sequence_part TEXT;
  ticket_count INTEGER;
BEGIN
  -- Get current date in YYYYMMDD format
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Count tickets created today
  SELECT COUNT(*) INTO ticket_count
  FROM contact_messages
  WHERE ticket_number LIKE 'SF-' || date_part || '-%';
  
  -- Generate sequence part with leading zeros
  sequence_part := LPAD((ticket_count + 1)::TEXT, 4, '0');
  
  -- Return formatted ticket number
  RETURN 'SF-' || date_part || '-' || sequence_part;
END;
$$ LANGUAGE plpgsql;
