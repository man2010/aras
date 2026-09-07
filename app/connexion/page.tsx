'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Method = 'email' | 'phone';

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '').trim();
}

export default function ConnexionPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const canSubmit = useMemo(() => password.length >= 6, [password]);

  const ensureProfile = async (userId: string, fallbackName: string) => {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (profile) return;

    await supabase.from('profiles').upsert(
      {
        id: userId,
        full_name: fallbackName,
        is_active: true,
        is_online: true,
        avatar_urls: ['https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600'],
        interests: [],
        languages: [],
        notif_messages: true,
        notif_likes: true,
        notif_matches: true,
        show_age: true,
        show_online_status: true,
        show_distance: true,
        notif_events: true,
      },
      { onConflict: 'id' }
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const form = new FormData(e.currentTarget);
    const contact = String(form.get('contact') ?? '').trim();

    const credentials = method === 'email'
      ? { email: contact, password }
      : { phone: normalizePhone(contact), password };

    const { data, error } = await supabase.auth.signInWithPassword(credentials as never);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await ensureProfile(data.user.id, method === 'email' ? contact.split('@')[0] : contact);
      router.push('/espace');
    }

    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f3e9dc] to-[#fbf8f2] px-5 pt-[72px]">
      <div className="w-full max-w-[460px]">
        <div className="rounded-[28px] bg-[#fbf8f2] p-8 shadow-[0_20px_60px_rgba(83,46,32,.08)] sm:p-10">
          <Link href="/" className="font-display text-3xl font-bold tracking-[-.06em] text-[#ec3b78]">
            ARAS<span className="text-[#d89b52]">.</span>
          </Link>
          <h1 className="mt-8 font-display text-4xl tracking-[-.04em]">Content de vous revoir</h1>
          <p className="mt-2 text-sm leading-6 text-[#756960]">Connectez-vous avec votre email ou votre téléphone et votre mot de passe.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[#f3e9dc] p-1">
            <button
              type="button"
              onClick={() => setMethod('email')}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'email' ? 'bg-white text-[#241c18]' : 'text-[#756960]'}`}
            >
              <span className="inline-flex items-center gap-2"><Mail size={15} /> Email</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('phone')}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'phone' ? 'bg-white text-[#241c18]' : 'text-[#756960]'}`}
            >
              <span className="inline-flex items-center gap-2"><Phone size={15} /> Téléphone</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-xs font-extrabold text-[#625852]">
              {method === 'email' ? 'Votre email' : 'Votre téléphone'}
              <input
                required
                name="contact"
                type={method === 'email' ? 'email' : 'tel'}
                placeholder={method === 'email' ? 'vous@exemple.com' : '+221 77 123 45 67'}
                className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#ec3b78]"
              />
            </label>
            <label className="block text-xs font-extrabold text-[#625852]">
              Mot de passe
              <div className="relative mt-2">
                <input
                  required
                  minLength={6}
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#ec3b78]"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8b82] transition hover:text-[#241c18]">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {message && (
              <div className="flex items-center gap-2 rounded-xl bg-[#fae4e2] px-4 py-3 text-sm text-[#c92e63]">
                <X size={16} /> {message}
              </div>
            )}

            <button
              disabled={loading || !canSubmit}
              className="w-full rounded-full bg-[#ec3b78] py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Un instant...' : 'Se connecter'} <ArrowRight size={16} className="ml-2 inline" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#756960]">
            Pas encore de compte ?{' '}
            <Link href="/inscription" className="font-extrabold text-[#ec3b78]">
              Créer un compte
            </Link>
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#9a8b82]">
            <LockKeyhole size={13} /> Vos données restent confidentielles
          </div>
        </div>
      </div>
    </main>
  );
}
