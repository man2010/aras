'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, MessageCircle, Heart, CalendarDays, ArrowRight, ShieldCheck, Send, Plus, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile, Conversation, Message } from '@/lib/types';

type Tab = 'profile' | 'messages' | 'events' | 'likes';

export default function EspacePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({ display_name: '', age: '', city: 'Dakar', bio: '', profession: '', photo_url: '', interests: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState('');
  const [likedProfiles, setLikedProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string; location: string }[]>([]);

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
      const { data: existing } = await supabase.from('aras_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (existing) {
        const p = existing as Profile;
        setProfile(p);
        setProfileForm({ display_name: p.display_name, age: String(p.age), city: p.city, bio: p.bio, profession: p.profession, photo_url: p.photo_url, interests: p.interests.join(', ') });
      }
      const { data: convs } = await supabase.from('aras_conversations').select('*').or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order('created_at', { ascending: false });
      if (convs) {
        setConversations(convs as Conversation[]);
        // Fetch profiles for conversation partners
        const partnerIds = convs.map((c: Conversation) => c.user_a === user.id ? c.user_b : c.user_a);
        const { data: partnerProfiles } = await supabase.from('aras_profiles').select('*').in('user_id', partnerIds);
        if (partnerProfiles) {
          const profileMap: Record<string, Profile> = {};
          partnerProfiles.forEach((p: Profile) => {
            profileMap[p.user_id] = p;
          });
          setConversationProfiles(profileMap);
        }
      }
      const { data: likes } = await supabase.from('aras_likes').select('liked_profile_id').eq('liker_id', user.id);
      if (likes && likes.length > 0) {
        const ids = likes.map((l: { liked_profile_id: string }) => l.liked_profile_id);
        const { data: likedProfs } = await supabase.from('aras_profiles').select('*').in('id', ids);
        if (likedProfs) setLikedProfiles(likedProfs as Profile[]);
      }
      const { data: evts } = await supabase.from('aras_events').select('id, title, event_date, location').order('event_date', { ascending: true }).limit(5);
      if (evts) setEvents(evts as { id: string; title: string; event_date: string; location: string }[]);
    })();
  }, [user]);

  useEffect(() => {
    if (!activeConv || !user) return;
    (async () => {
      const { data } = await supabase.from('aras_messages').select('*').eq('conversation_id', activeConv).order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);
    })();
  }, [activeConv, user]);

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaved(false);
    const payload = {
      user_id: user.id,
      display_name: profileForm.display_name,
      age: parseInt(profileForm.age) || 25,
      city: profileForm.city,
      bio: profileForm.bio,
      profession: profileForm.profession,
      photo_url: profileForm.photo_url || 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
      interests: profileForm.interests.split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (profile) {
      const { error } = await supabase.from('aras_profiles').update(payload).eq('id', profile.id);
      if (!error) { setProfile({ ...profile, ...payload } as Profile); setProfileSaved(true); }
    } else {
      const { data, error } = await supabase.from('aras_profiles').insert(payload).select().single();
      if (!error && data) { setProfile(data as Profile); setProfileSaved(true); }
    }
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeConv || !newMessage.trim()) return;
    const { data, error } = await supabase.from('aras_messages').insert({ conversation_id: activeConv, sender_id: user.id, content: newMessage.trim() }).select().single();
    if (error) {
      alert('Erreur lors de l\'envoi du message. Veuillez réessayer.');
      return;
    }
    if (data) { setMessages((prev) => [...prev, data as Message]); setNewMessage(''); }
  };

  if (authLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Chargement...</p></main>;
  }

  const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date); };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Mon profil', icon: User },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'likes', label: 'Mes likes', icon: Heart },
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
                <img src={profileForm.photo_url || 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=300'} alt="Photo" className="h-full w-full object-cover" />
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
                <label className="block text-xs font-extrabold text-[#625852] sm:col-span-2">Photo (URL)<input value={profileForm.photo_url} onChange={(e) => setProfileForm({ ...profileForm, photo_url: e.target.value })} placeholder="https://..." className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]" /></label>
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
          <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
            <div className="rounded-[26px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
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
                    return (
                      <button key={c.id} onClick={() => setActiveConv(c.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${activeConv === c.id ? 'bg-[#fae4e2]' : 'hover:bg-[#f3e9dc]'}`}>
                        <p className="text-sm font-bold text-[#241c18]">{otherProfile?.display_name || 'Utilisateur'}</p>
                        <p className="text-xs text-[#9a8b82]">{otherProfile?.city || 'Ville inconnue'}</p>
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
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_id === user.id ? 'bg-[#e9515f] text-white' : 'bg-white text-[#241c18] shadow-sm'}`}>{m.content}</div>
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
        )}

        {/* LIKES TAB */}
        {tab === 'likes' && (
          <div className="mt-8">
            {likedProfiles.length === 0 ? (
              <div className="rounded-[26px] bg-white p-12 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                <Heart size={36} className="mx-auto text-[#dfd2c6]" />
                <p className="mt-4 font-display text-2xl">Aucun like pour l'instant</p>
                <p className="mt-2 text-sm text-[#756960]">Explorez la découverte et likez les profils qui vous inspirent.</p>
                <Link href="/decouverte" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e9515f] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c83d50]">Aller à la découverte <ArrowRight size={16} /></Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {likedProfiles.map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-[22px] bg-white shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                      <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#e9515f] text-white"><Heart size={16} fill="currentColor" /></span>
                    </div>
                    <div className="p-4"><p className="font-display text-xl">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p><p className="mt-1 text-xs font-bold text-[#756960]">{p.city}</p></div>
                  </div>
                ))}
              </div>
            )}
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
    </main>
  );
}
