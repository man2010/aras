-- Table settings pour la configuration du site
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings"
ON settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE user_id = auth.uid()
  )
);

-- Insérer les paramètres par défaut
INSERT INTO settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('allow_registration', 'true'),
  ('max_upload_size_mb', '10'),
  ('story_expiration_hours', '24'),
  ('notification_email', 'admin@aras.com')
ON CONFLICT (key) DO NOTHING;
