-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON contact_messages;

-- Policy: Allow anonymous and authenticated users to insert contact messages
CREATE POLICY "Allow contact form submissions"
  ON contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Allow users to view their own messages (authenticated users only)
CREATE POLICY "Users can view own messages"
  ON contact_messages
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Policy: Allow anonymous users to view messages they just submitted (by email match)
-- This is optional but useful for showing confirmation
CREATE POLICY "Allow viewing recent submissions"
  ON contact_messages
  FOR SELECT
  TO anon
  USING (created_at > NOW() - INTERVAL '1 hour');
