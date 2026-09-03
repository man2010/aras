/*
# Add RLS policies for ARAS social tables

1. Security changes
- Profiles: public SELECT, owner INSERT/UPDATE
- Likes: authenticated INSERT/SELECT/DELETE with ownership checks
- Conversations: participants can SELECT/INSERT
- Messages: participants can SELECT/INSERT with sender check
- Testimonials: public SELECT
*/

DROP POLICY IF EXISTS "Public can view profiles" ON public.aras_profiles;
CREATE POLICY "Public can view profiles"
ON public.aras_profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON public.aras_profiles;
CREATE POLICY "Users insert own profile"
ON public.aras_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.aras_profiles;
CREATE POLICY "Users update own profile"
ON public.aras_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert likes" ON public.aras_likes;
CREATE POLICY "Users can insert likes"
ON public.aras_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = liker_id);

DROP POLICY IF EXISTS "Users can view own likes" ON public.aras_likes;
CREATE POLICY "Users can view own likes"
ON public.aras_likes FOR SELECT TO authenticated USING (auth.uid() = liker_id OR auth.uid() = (SELECT user_id FROM public.aras_profiles WHERE id = liked_profile_id));

DROP POLICY IF EXISTS "Users can delete own likes" ON public.aras_likes;
CREATE POLICY "Users can delete own likes"
ON public.aras_likes FOR DELETE TO authenticated USING (auth.uid() = liker_id);

DROP POLICY IF EXISTS "Users can view own conversations" ON public.aras_conversations;
CREATE POLICY "Users can view own conversations"
ON public.aras_conversations FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Users can create conversations" ON public.aras_conversations;
CREATE POLICY "Users can create conversations"
ON public.aras_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Users can view own messages" ON public.aras_messages;
CREATE POLICY "Users can view own messages"
ON public.aras_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.aras_conversations c WHERE c.id = aras_messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid()))
);

DROP POLICY IF EXISTS "Users can send messages" ON public.aras_messages;
CREATE POLICY "Users can send messages"
ON public.aras_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM public.aras_conversations c WHERE c.id = aras_messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid()))
);

DROP POLICY IF EXISTS "Public can view testimonials" ON public.aras_testimonials;
CREATE POLICY "Public can view testimonials"
ON public.aras_testimonials FOR SELECT TO anon, authenticated USING (true);
