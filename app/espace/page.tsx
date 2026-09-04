'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, MessageCircle, Heart, CalendarDays, ArrowRight, ShieldCheck, Send, Plus, Check, Upload, X, Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile, Conversation, Message, Story } from '@/lib/types';
import { toConversation, toEvent, toMessage, toProfile, toStory, type EventRow, type MatchRow, type MessageRow, type ProfileRow, type StoryRow } from '@/lib/adapters';
import { StoryManager } from '@/components/story-manager';
import { StoriesCarousel } from '@/components/stories-carousel';

type Tab = 'profile' | 'messages' | 'likes' | 'matches' | 'stories' | 'events';

export default function EspacePage() {
  const { user, loading: authLoading, setUnreadCount } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('likes');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({ display_name: '', age: '', city: 'Dakar', bio: '', profession: '', photo_url: '', interests: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string; time: string }>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [likedProfiles, setLikedProfiles] = useState<Profile[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [allStories, setAllStories] = useState<Story[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Profile[]>([]);
  const [selectedLikedProfile, setSelectedLikedProfile] = useState<Profile | null>(null);
  const [selectedReceivedProfile, setSelectedReceivedProfile] = useState<Profile | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Profile | null>(null);
  const [likesView, setLikesView] = useState<'received' | 'sent'>('received');
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string; location: string }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/connexion');
  }, [authLoading, user, router]);

  useEffect(() => {
    // Handle URL parameters for tab and conversation
    const tabParam = searchParams.get('tab');
    const convParam = searchParams.get('conv');
    if (tabParam && ['profile', 'messages', 'events', 'likes'].includes(tabParam)) {
      setTab(tabParam as Tab);
    }
    if (convParam) {
      setActiveConv(convParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: existing } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (existing) {
        const p = toProfile(existing as ProfileRow);
        setProfile(p);
        setProfileForm({ display_name: p.display_name, age: String(p.age), city: p.city, bio: p.bio, profession: p.profession, photo_url: p.photo_url, interests: p.interests.join(', ') });
      }
      const { data: convs } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`).order('updated_at', { ascending: false });
      if (convs) {
        const mappedConversations = (convs as MatchRow[]).map(toConversation);
        setConversations(mappedConversations);
        const partnerIds = mappedConversations.map((c) => c.user_a === user.id ? c.user_b : c.user_a);
        const { data: partnerProfiles } = await supabase.from('profiles').select('*').in('id', partnerIds);
        if (partnerProfiles) {
          const profileMap: Record<string, Profile> = {};
          partnerProfiles.map((row) => toProfile(row as ProfileRow)).forEach((p: Profile) => {
            if (p.user_id) {
              profileMap[p.user_id] = p;
            }
          });
          setConversationProfiles(profileMap);
        }
        // Charger le dernier message pour chaque conversation
        const lastMsgs: Record<string, { content: string; time: string }> = {};
        for (const conv of mappedConversations) {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('match_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg) {
            const time = new Date(lastMsg.created_at);
            const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            lastMsgs[conv.id] = { content: lastMsg.content, time: timeStr };
          }
        }
        setLastMessages(lastMsgs);
      }
      const { data: likes } = await supabase.from('swipes').select('swiped_id').eq('swiper_id', user.id).eq('type', 'like');
      if (likes && likes.length > 0) {
        const ids = likes.map((l: { swiped_id: string }) => l.swiped_id);
        const { data: likedProfs } = await supabase.from('profiles').select('*').in('id', ids);
        if (likedProfs) {
          const profiles = (likedProfs as ProfileRow[]).map(toProfile);
          // Filtrer pour ne garder que ceux qui n'ont PAS liké en retour
          const receivedSwipers = new Set();
          const { data: receivedSwipes } = await supabase.from('swipes').select('swiper_id').eq('swiped_id', user.id).eq('type', 'like');
          if (receivedSwipes) {
            receivedSwipes.forEach((s: { swiper_id: string }) => receivedSwipers.add(s.swiper_id));
          }
          setLikedProfiles(profiles.filter((p) => !receivedSwipers.has(p.id)));
        }
      }
      // Charger les likes reçus (personnes qui ont liké l'utilisateur)
      const { data: receivedLikesData } = await supabase.from('swipes').select('swiper_id').eq('swiped_id', user.id).eq('type', 'like');
      if (receivedLikesData && receivedLikesData.length > 0) {
        const ids = receivedLikesData.map((l: { swiper_id: string }) => l.swiper_id);
        const { data: receivedProfs } = await supabase.from('profiles').select('*').in('id', ids);
        if (receivedProfs) {
          const profiles = (receivedProfs as ProfileRow[]).map(toProfile);
          // Filtrer pour ne garder que ceux que l'utilisateur n'a PAS liké en retour
          const sentSwipes = new Set();
          likes?.forEach((l: { swiped_id: string }) => sentSwipes.add(l.swiped_id));
          setReceivedLikes(profiles.filter((p) => !sentSwipes.has(p.id)));
        }
      }
      // Charger les matches (likes réciproques)
      const { data: matchesData } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);
      if (matchesData && matchesData.length > 0) {
        const partnerIds = matchesData.map((m: any) => m.user_1_id === user.id ? m.user_2_id : m.user_1_id);
        const { data: matchProfiles } = await supabase.from('profiles').select('*').in('id', partnerIds);
        if (matchProfiles) setMatches((matchProfiles as ProfileRow[]).map(toProfile));
      }
      // Charger les comptes de messages non lus
      const { data: unreadData } = await supabase
        .from('messages')
        .select('match_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      if (unreadData) {
        const counts: Record<string, number> = {};
        let total = 0;
        unreadData.forEach((m: { match_id: string }) => {
          counts[m.match_id] = (counts[m.match_id] || 0) + 1;
          total++;
        });
        setUnreadCounts(counts);
        setTotalUnread(total);
        setUnreadCount(total);
      }
      // Charger les stories de l'utilisateur
      const { data: storiesData } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (storiesData) {
        setStories((storiesData as StoryRow[]).map(toStory));
      }
      // Charger toutes les stories pour le carrousel
      const { data: allStoriesData } = await supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false });
      if (allStoriesData) {
        setAllStories((allStoriesData as StoryRow[]).map(toStory));
        // Charger les profils des auteurs de stories
        const authorIds = Array.from(new Set(allStoriesData.map((s: any) => s.user_id)));
        if (authorIds.length > 0) {
          const { data: authorProfiles } = await supabase.from('profiles').select('*').in('id', authorIds);
          if (authorProfiles) {
            authorProfiles.map((row) => toProfile(row as ProfileRow)).forEach((p: Profile) => {
              if (p.user_id) {
                setConversationProfiles((prev) => ({ ...prev, [p.user_id as string]: p }));
              }
            });
          }
        }
      }
      const { data: evts } = await supabase.from('events').select('*').order('date', { ascending: true }).limit(5);
      if (evts) setEvents((evts as EventRow[]).map(toEvent).map((event) => ({ id: event.id, title: event.title, event_date: event.event_date, location: event.location })));
    })();
  }, [user]);

  useEffect(() => {
    if (!activeConv || !user) return;
    (async () => {
      const { data } = await supabase.from('messages').select('*').eq('match_id', activeConv).order('created_at', { ascending: true });
      if (data) {
        setMessages((data as MessageRow[]).map(toMessage));
        // Marquer les messages reçus comme lus
        const receivedMessages = data.filter((m: any) => m.receiver_id === user.id && !m.is_read);
        if (receivedMessages.length > 0) {
          await supabase.from('messages').update({ is_read: true }).eq('match_id', activeConv).eq('receiver_id', user.id);
          setMessages((prev) => prev.map((m) => m.receiver_id === user.id ? { ...m, is_read: true } : m));
          // Mettre à jour le compteur global
          setTotalUnread((prev) => Math.max(0, prev - receivedMessages.length));
          setUnreadCount(Math.max(0, totalUnread - receivedMessages.length));
        }
      }
    })();
  }, [activeConv, user]);

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaved(false);
    const payload = {
      full_name: profileForm.display_name,
      city: profileForm.city,
      bio: profileForm.bio,
      profession: profileForm.profession,
      avatar_urls: imagePreview ? [imagePreview] : (profileForm.photo_url ? [profileForm.photo_url] : profile?.avatar_urls || ['https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600']),
      interests: profileForm.interests.split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (profile) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id);
      if (!error) { setProfile({ ...profile, display_name: payload.full_name, city: payload.city, bio: payload.bio, profession: payload.profession, photo_url: payload.avatar_urls[0], interests: payload.interests } as Profile); setProfileSaved(true); }
    } else {
      const { data, error } = await supabase.from('profiles').insert({ id: user.id, ...payload }).select().single();
      if (!error && data) { setProfile(toProfile(data as ProfileRow)); setProfileSaved(true); }
    }
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeConv || !newMessage.trim()) return;
    const activeConversation = conversations.find((conversation) => conversation.id === activeConv);
    const receiverId = activeConversation?.user_a === user.id ? activeConversation.user_b : activeConversation?.user_a;
    if (!receiverId) return;
    const { data, error } = await supabase.from('messages').insert({ match_id: activeConv, sender_id: user.id, receiver_id: receiverId, content: newMessage.trim() }).select().single();
    if (error) {
      alert('Erreur lors de l\'envoi du message. Veuillez réessayer.');
      return;
    }
    if (data) { 
      setMessages((prev) => [...prev, toMessage(data as MessageRow)]); 
      setNewMessage('');
      // Mettre à jour le dernier message
      const time = new Date(data.created_at);
      const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setLastMessages((prev) => ({ ...prev, [activeConv]: { content: data.content, time: timeStr } }));
    }
  };

  const handleLikeBack = async (profileId: string) => {
    if (!user) return;
    const { error } = await supabase.from('swipes').upsert({
      swiper_id: user.id,
      swiped_id: profileId,
      type: 'like',
    });
    if (!error) {
      // Vérifier si c'est un match réciproque
      const { data: reciprocalSwipe } = await supabase
        .from('swipes')
        .select('*')
        .eq('swiper_id', profileId)
        .eq('swiped_id', user.id)
        .eq('type', 'like')
        .maybeSingle();

      if (reciprocalSwipe) {
        // Créer le match
        const { data: conversationId } = await supabase.rpc('create_match_from_swipe', {
          target_profile_id: profileId,
        });
        if (conversationId) {
          alert('🎉 C\'est un match ! Vous pouvez maintenant discuter ensemble !');
          // Recharger les conversations
          const { data: convs } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`).order('updated_at', { ascending: false });
          if (convs) {
            const mappedConversations = (convs as MatchRow[]).map(toConversation);
            setConversations(mappedConversations);
          }
        }
      } else {
        alert('Vous avez liké ce profil. Si cette personne vous like en retour, c\'est un match !');
      }
      // Retirer de la liste des likes reçus
      setReceivedLikes((prev) => prev.filter((p) => p.id !== profileId));
    }
  };

  if (authLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Chargement...</p></main>;
  }

  const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date); };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Mon profil', icon: User },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'likes', label: 'Likes', icon: Heart },
    { id: 'matches', label: 'Matches', icon: Heart },
    { id: 'stories', label: 'Stories', icon: Heart },
    { id: 'events', label: 'Événements', icon: CalendarDays },
  ];

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Bienvenue dans votre espace</p>
          <h1 className="font-display mt-3 text-4xl tracking-[-.04em] sm:text-5xl">Bonjour{profile ? `, ${profile.display_name}` : ''} <span className="italic text-[#1a6b68]">!</span></h1>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-[0_6px_20px_rgba(83,46,32,.04)]">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-extrabold transition ${tab === t.id ? 'bg-[#e9515f] text-white' : 'text-[#756960] hover:bg-[#f3e9dc]'}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="rounded-[26px] bg-white p-6 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
              <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                <img src={imagePreview || profileForm.photo_url || 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=300'} alt="Photo" className="h-full w-full object-cover" />
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
                  <Upload size={20} className="text-white" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // Validate file type
                      if (!file.type.match(/image\/(png|jpeg|jpg)$/)) {
                        alert('Seuls les fichiers PNG, JPG et JPEG sont acceptés');
                        return;
                      }
                      
                      // Validate file size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        alert('L\'image ne doit pas dépasser 5MB');
                        return;
                      }
                      
                      setUploadingImage(true);
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setImagePreview(e.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                      
                      // Upload to Supabase storage
                      try {
                        const fileName = `${Date.now()}_${file.name}`;
                        const filePath = `${user.id}/${fileName}`;
                        
                        const { data: uploadData, error: uploadError } = await supabase.storage
                          .from('avatars')
                          .upload(filePath, file);
                        
                        if (uploadError) {
                          console.error('Upload error:', uploadError);
                          alert('Erreur lors de l\'upload de l\'image');
                          setUploadingImage(false);
                          return;
                        }
                        
                        const { data: { publicUrl } } = supabase.storage
                          .from('avatars')
                          .getPublicUrl(filePath);
                        
                        setProfileForm({ ...profileForm, photo_url: publicUrl });
                        setUploadingImage(false);
                      } catch (error) {
                        console.error('Exception upload:', error);
                        alert('Erreur lors de l\'upload');
                        setUploadingImage(false);
                      }
                    }}
                  />
                </label>
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  </div>
                )}
              </div>
              <p className="mt-4 font-display text-2xl">{profileForm.display_name || 'Votre nom'}</p>
              <p className="mt-1 text-sm text-[#756960]">{profileForm.profession || 'Votre profession'}</p>
              <p className="mt-1 text-sm text-[#756960]">{profileForm.city}</p>
              {profile?.is_verified && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#e5f0ed] px-3 py-1.5 text-[10px] font-extrabold uppercase text-[#1a6b68]"><ShieldCheck size={12} /> Vérifié</span>}
              {!profile?.is_verified && <p className="mt-3 text-xs text-[#9a8b82]">Profil non vérifié</p>}
            </div>
            <form onSubmit={saveProfile} className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] lg:p-8">
              <h2 className="font-display text-2xl">Mes informations</h2>
              <p className="mt-1 text-sm text-[#756960]">Renseignez votre profil pour augmenter vos chances de match.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-extrabold text-[#625852]">Nom affiché<input value={profileForm.display_name} onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })} required placeholder="Votre nom" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" /></label>
                <label className="block text-xs font-extrabold text-[#625852]">Âge<input value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} type="number" min="18" max="99" required className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" /></label>
                <label className="block text-xs font-extrabold text-[#625852]">Ville<input value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} required className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" /></label>
                <label className="block text-xs font-extrabold text-[#625852]">Profession<input value={profileForm.profession} onChange={(e) => setProfileForm({ ...profileForm, profession: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" /></label>
                <div className="sm:col-span-2">
                  <p className="text-xs font-extrabold text-[#625852]">Photo de profil</p>
                  <p className="mt-1 text-xs text-[#9a8b82]">Cliquez sur l'image pour changer (PNG, JPG, max 5MB)</p>
                </div>
                <label className="block text-xs font-extrabold text-[#625852] sm:col-span-2">Centres d'intérêt (séparés par des virgules)<input value={profileForm.interests} onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })} placeholder="Voyage, Cuisine, Musique..." className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" /></label>
                <label className="block text-xs font-extrabold text-[#625852] sm:col-span-2">Bio<textarea value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} rows={4} placeholder="Parlez de vous..." className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" /></label>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <button type="submit" className="rounded-full bg-[#e9515f] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c83d50]">Enregistrer</button>
                {profileSaved && <span className="flex items-center gap-2 text-sm font-bold text-[#1a6b68]"><Check size={16} /> Profil mis à jour !</span>}
              </div>
            </form>
          </div>
        )}

        {/* MESSAGES TAB */}
        {tab === 'messages' && (
          <div className="mt-8">
            <StoriesCarousel matches={matches} stories={allStories} profileMap={conversationProfiles} />
            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <div className="rounded-[26px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
              <p className="px-2 pb-3 font-display text-xl">Conversations</p>
              {conversations.length === 0 ? (
                <div className="px-2 py-8 text-center">
                  <MessageCircle size={28} className="mx-auto text-[#dfd2c6]" />
                  <p className="mt-3 text-sm text-[#756960]">Aucune conversation pour l'instant.</p>
                  <p className="mt-1 text-xs text-[#9a8b82]">Quand vous ferez un match, vos conversations apparaîtront ici.</p>
                  <Link href="/decouverte" className="mt-4 inline-block rounded-full bg-[#e9515f] px-5 py-2.5 text-xs font-extrabold text-white">Découvrir des profils</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => {
                    const otherId = c.user_a === user.id ? c.user_b : c.user_a;
                    const otherProfile = conversationProfiles[otherId];
                    const lastMsg = lastMessages[c.id];
                    const unreadCount = unreadCounts[c.id] || 0;
                    return (
                      <button 
                        key={c.id} 
                        onClick={() => {
                          setActiveConv(c.id);
                          // Marquer comme lu
                          if (unreadCounts[c.id] > 0) {
                            setUnreadCounts((prev) => ({ ...prev, [c.id]: 0 }));
                            setTotalUnread((prev) => Math.max(0, prev - unreadCounts[c.id]));
                            setUnreadCount(Math.max(0, totalUnread - unreadCounts[c.id]));
                          }
                        }} 
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activeConv === c.id ? 'bg-[#fae4e2]' : 'hover:bg-[#f3e9dc]'}`}
                      >
                        <div className="relative shrink-0">
                          <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#f3e9dc]">
                            <img src={otherProfile?.photo_url} alt={otherProfile?.display_name} className="h-full w-full object-cover" />
                          </div>
                          {unreadCount > 0 && (
                            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#e9515f] text-[10px] font-extrabold text-white">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-[#241c18] truncate">{otherProfile?.display_name || 'Utilisateur'}</p>
                            {lastMsg && <p className="text-[10px] text-[#9a8b82]">{lastMsg.time}</p>}
                          </div>
                          <p className="mt-0.5 text-xs text-[#9a8b82] truncate">
                            {lastMsg ? lastMsg.content : 'Aucun message'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex h-[460px] flex-col rounded-[26px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
              {activeConv ? (
                <>
                  <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-[#fbf8f2] p-4">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_id === user.id ? 'bg-[#e9515f] text-white' : 'bg-white text-[#241c18] shadow-sm'}`}>
                          <p>{m.content}</p>
                          {m.sender_id === user.id && (
                            <div className="mt-1 flex items-center justify-end gap-1">
                              <span className="text-[10px] opacity-70">
                                {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {m.is_read ? (
                                <CheckCheck size={14} className="text-[#53bdeb]" />
                              ) : (
                                <Check size={14} className="opacity-50" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && <p className="py-8 text-center text-sm text-[#9a8b82]">Démarrez la conversation.</p>}
                  </div>
                  <form onSubmit={sendMessage} className="mt-3 flex gap-2">
                    <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Votre message..." className="flex-1 rounded-full border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" />
                    <button type="submit" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9515f] text-white transition hover:bg-[#c83d50]"><Send size={18} /></button>
                  </form>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <MessageCircle size={36} className="text-[#dfd2c6]" />
                  <p className="mt-3 text-sm font-bold text-[#756960]">Sélectionnez une conversation</p>
                  <p className="mt-1 text-xs text-[#9a8b82]">Vos messages s'afficheront ici.</p>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* LIKES TAB */}
        {tab === 'likes' && (
          <div className="mt-8">
            <div className="mb-6 flex items-center gap-4">
              <button
                onClick={() => setLikesView('received')}
                className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${likesView === 'received' ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}
              >
                Qui m'a liké ({receivedLikes.length})
              </button>
              <button
                onClick={() => setLikesView('sent')}
                className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${likesView === 'sent' ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}
              >
                Ce que j'ai liké ({likedProfiles.length})
              </button>
            </div>

            {likesView === 'received' ? (
              <>
                {receivedLikes.length === 0 ? (
                  <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                    <Heart size={28} className="mx-auto text-[#dfd2c6]" />
                    <p className="mt-3 font-display text-xl">Personne ne vous a liké pour l'instant</p>
                    <p className="mt-1 text-sm text-[#756960]">Explorez la découverte pour attirer l'attention.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {receivedLikes.slice(0, 10).map((p) => (
                      <div key={p.id} className="flex items-center gap-4 rounded-[16px] bg-white p-3 shadow-[0_4px_15px_rgba(83,46,32,.04)] transition hover:shadow-[0_8px_25px_rgba(83,46,32,.08)]">
                        <div className="relative shrink-0 cursor-pointer" onClick={() => setSelectedReceivedProfile(p)}>
                          <div className="h-14 w-14 overflow-hidden rounded-full border-3 border-[#f3e9dc]">
                            <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#e9515f]"><Heart size={10} fill="currentColor" className="text-white" /></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-base font-semibold truncate">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                          <p className="text-xs text-[#756960]">{p.city} · {p.profession}</p>
                        </div>
                        <button
                          onClick={() => handleLikeBack(p.id)}
                          className="shrink-0 rounded-full bg-[#1a6b68] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#125552]"
                        >
                          Liker
                        </button>
                      </div>
                    ))}
                    {receivedLikes.length > 10 && (
                      <p className="text-center text-xs text-[#9a8b82]">... et {receivedLikes.length - 10} autres</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {likedProfiles.length === 0 ? (
                  <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                    <Heart size={28} className="mx-auto text-[#dfd2c6]" />
                    <p className="mt-3 font-display text-xl">Vous n'avez liké personne pour l'instant</p>
                    <p className="mt-1 text-sm text-[#756960]">Explorez la découverte et likez les profils qui vous inspirent.</p>
                    <Link href="/decouverte" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#e9515f] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c83d50]">Aller à la découverte <ArrowRight size={16} /></Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {likedProfiles.slice(0, 10).map((p) => (
                      <div key={p.id} className="flex items-center gap-4 rounded-[16px] bg-white p-3 shadow-[0_4px_15px_rgba(83,46,32,.04)] transition hover:shadow-[0_8px_25px_rgba(83,46,32,.08)]">
                        <div className="relative shrink-0 cursor-pointer" onClick={() => setSelectedLikedProfile(p)}>
                          <div className="h-14 w-14 overflow-hidden rounded-full border-3 border-[#f3e9dc]">
                            <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#e9515f]"><Heart size={10} fill="currentColor" className="text-white" /></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-base font-semibold truncate">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                          <p className="text-xs text-[#756960]">{p.city} · {p.profession}</p>
                        </div>
                        <div className="shrink-0 text-xs text-[#9a8b82]">En attente...</div>
                      </div>
                    ))}
                    {likedProfiles.length > 10 && (
                      <p className="text-center text-xs text-[#9a8b82]">... et {likedProfiles.length - 10} autres</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MATCHES TAB */}
        {tab === 'matches' && (
          <div className="mt-8">
            <h2 className="mb-4 font-display text-2xl">Mes matches</h2>
            {matches.length === 0 ? (
              <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                <Heart size={28} className="mx-auto text-[#dfd2c6]" />
                <p className="mt-3 font-display text-xl">Aucun match pour l'instant</p>
                <p className="mt-1 text-sm text-[#756960]">Likez des profils pour créer des matches mutuels.</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm font-bold text-[#756960]">{matches.length} match(s)</p>
                <div className="space-y-3">
                  {matches.slice(0, 10).map((p) => (
                    <div key={p.id} className="flex items-center gap-4 rounded-[16px] bg-white p-3 shadow-[0_4px_15px_rgba(83,46,32,.04)] transition hover:shadow-[0_8px_25px_rgba(83,46,32,.08)]">
                      <div className="relative shrink-0 cursor-pointer" onClick={() => setSelectedMatch(p)}>
                        <div className="h-14 w-14 overflow-hidden rounded-full border-3 border-[#1a6b68]">
                          <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a6b68]"><Heart size={10} fill="currentColor" className="text-white" /></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-base font-semibold truncate">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                        <p className="text-xs text-[#756960]">{p.city} · {p.profession}</p>
                      </div>
                      <button
                        onClick={() => { setTab('messages'); }}
                        className="shrink-0 rounded-full bg-[#e9515f] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#c83d50]"
                      >
                        Discuter
                      </button>
                    </div>
                  ))}
                  {matches.length > 10 && (
                    <p className="text-center text-xs text-[#9a8b82]">... et {matches.length - 10} autres</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* STORIES TAB */}
        {tab === 'stories' && (
          <div className="mt-8">
            <StoryManager userId={user.id} stories={stories} onStoriesChange={setStories} />
          </div>
        )}

        {/* EVENTS TAB */}
        {tab === 'events' && (
          <div className="mt-8 space-y-4">
            {events.length === 0 ? (
              <div className="rounded-[26px] bg-white p-12 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                <CalendarDays size={36} className="mx-auto text-[#dfd2c6]" />
                <p className="mt-4 font-display text-2xl">Aucun événement à venir</p>
                <p className="mt-2 text-sm text-[#756960]">Les prochains rendez-vous seront bientôt annoncés.</p>
              </div>
            ) : (
              events.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-[0_6px_20px_rgba(83,46,32,.04)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-[#fae4e2] text-[#e9515f]"><CalendarDays size={18} /></div>
                    <div><p className="font-display text-lg">{e.title}</p><p className="text-sm text-[#756960]">{formatDate(e.event_date)} · {e.location}</p></div>
                  </div>
                  <Link href="/evenements" className="rounded-full bg-[#1a6b68] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#125552]">Détails</Link>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* PROFILE DETAIL MODALS */}
      {selectedReceivedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Profil de {selectedReceivedProfile.display_name}</h3>
              <button onClick={() => setSelectedReceivedProfile(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex flex-col items-center">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                <img src={selectedReceivedProfile.photo_url} alt={selectedReceivedProfile.display_name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 font-display text-2xl">{selectedReceivedProfile.display_name}, <span className="text-[#9a8b82]">{selectedReceivedProfile.age}</span></p>
              <p className="mt-1 text-sm text-[#756960]">{selectedReceivedProfile.city} · {selectedReceivedProfile.profession}</p>
            </div>
            <div className="mt-6">
              <p className="text-xs font-extrabold text-[#625852]">À propos</p>
              <p className="mt-2 text-sm text-[#756960]">{selectedReceivedProfile.bio || 'Aucune description'}</p>
            </div>
            <button
              onClick={() => { handleLikeBack(selectedReceivedProfile.id); setSelectedReceivedProfile(null); }}
              className="mt-6 w-full rounded-full bg-[#1a6b68] py-3 text-sm font-extrabold text-white transition hover:bg-[#125552]"
            >
              Liker en retour
            </button>
          </div>
        </div>
      )}

      {selectedLikedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Profil de {selectedLikedProfile.display_name}</h3>
              <button onClick={() => setSelectedLikedProfile(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex flex-col items-center">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                <img src={selectedLikedProfile.photo_url} alt={selectedLikedProfile.display_name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 font-display text-2xl">{selectedLikedProfile.display_name}, <span className="text-[#9a8b82]">{selectedLikedProfile.age}</span></p>
              <p className="mt-1 text-sm text-[#756960]">{selectedLikedProfile.city} · {selectedLikedProfile.profession}</p>
            </div>
            <div className="mt-6">
              <p className="text-xs font-extrabold text-[#625852]">À propos</p>
              <p className="mt-2 text-sm text-[#756960]">{selectedLikedProfile.bio || 'Aucune description'}</p>
            </div>
            <div className="mt-6 text-center text-sm text-[#9a8b82]">En attente de like en retour...</div>
          </div>
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Match avec {selectedMatch.display_name}</h3>
              <button onClick={() => setSelectedMatch(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex flex-col items-center">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[#1a6b68]">
                <img src={selectedMatch.photo_url} alt={selectedMatch.display_name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 font-display text-2xl">{selectedMatch.display_name}, <span className="text-[#9a8b82]">{selectedMatch.age}</span></p>
              <p className="mt-1 text-sm text-[#756960]">{selectedMatch.city} · {selectedMatch.profession}</p>
            </div>
            <div className="mt-6">
              <p className="text-xs font-extrabold text-[#625852]">À propos</p>
              <p className="mt-2 text-sm text-[#756960]">{selectedMatch.bio || 'Aucune description'}</p>
            </div>
            <button
              onClick={() => { setSelectedMatch(null); setTab('messages'); }}
              className="mt-6 w-full rounded-full bg-[#e9515f] py-3 text-sm font-extrabold text-white transition hover:bg-[#c83d50]"
            >
              Aller aux messages
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
