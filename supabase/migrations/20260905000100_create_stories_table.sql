-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view stories from matches" ON stories;
DROP POLICY IF EXISTS "Users can create own stories" ON stories;
DROP POLICY IF EXISTS "Users can delete own stories" ON stories;
DROP POLICY IF EXISTS "Users can update own stories" ON stories;

-- Table stories pour les fonctionnalités de stories
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_is_active ON stories(is_active);

-- RLS Policies
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Politique simplifiée : permettre aux utilisateurs authentifiés de voir toutes les stories
CREATE POLICY "Users can view all stories"
ON stories FOR SELECT
TO authenticated
USING (true);

-- Les utilisateurs peuvent créer leurs propres stories
CREATE POLICY "Users can create own stories"
ON stories FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres stories
CREATE POLICY "Users can delete own stories"
ON stories FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Les utilisateurs peuvent modifier leurs propres stories
CREATE POLICY "Users can update own stories"
ON stories FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Fonction pour nettoyer les stories expirées
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  UPDATE stories
  SET is_active = false
  WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;
