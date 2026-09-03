/*
# Create ARAS profiles, likes, conversations, messages, and testimonials tables

1. New Tables
- aras_profiles: public member profiles for discovery
- aras_likes: tracks likes between members (composite PK prevents duplicates)
- aras_conversations: 1:1 conversations between matched members
- aras_messages: messages within conversations
- aras_testimonials: public success stories for the homepage

2. Notes
- Profile photos use Pexels URLs as placeholders
- interests is a text array for flexible filtering
*/

CREATE TABLE IF NOT EXISTS public.aras_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  age integer NOT NULL CHECK (age BETWEEN 18 AND 99),
  city text NOT NULL DEFAULT 'Dakar',
  bio text NOT NULL DEFAULT '',
  photo_url text NOT NULL,
  interests text[] NOT NULL DEFAULT '{}',
  profession text NOT NULL DEFAULT '',
  is_verified boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aras_likes (
  liker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_profile_id uuid NOT NULL REFERENCES public.aras_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (liker_id, liked_profile_id)
);

CREATE TABLE IF NOT EXISTS public.aras_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS public.aras_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.aras_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aras_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  author_photo text NOT NULL,
  couple_photo text NOT NULL,
  story text NOT NULL,
  city text NOT NULL DEFAULT 'Dakar',
  relationship_duration text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aras_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aras_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aras_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aras_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aras_testimonials ENABLE ROW LEVEL SECURITY;
