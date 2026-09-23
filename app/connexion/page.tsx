'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Chrome, Eye, EyeOff, LockKeyhole, Mail, Phone, X } from 'lucide-react';
import { AuthPhoneInput } from '@/components/auth-phone-input';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import { ensureProfile } from '@/lib/create-profile';
import { getAuthRedirectOrigin, supabase } from '@/lib/supabase';

type Method = 'email' | 'phone';

export default function ConnexionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<Method>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const canSubmit = useMemo(() => password.length >= 6, [password]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setMessage(errorParam);
    }
  }, [searchParams]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getAuthRedirectOrigin()}/auth/callback?next=/espace&flow=signin`,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const form = new FormData(e.currentTarget);
    const contact = String(form.get('contact') ?? '').trim();

    if (method === 'phone' && !isValidPhone(contact)) {
      setMessage('Veuillez saisir un numéro de téléphone valide.');
      setLoading(false);
      return;
    }

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
          <Link href="/" className="flex justify-center" aria-label="ARAS">
            <Image src="/aras-logo.jpeg" alt="ARAS" width={180} height={72} className="h-14 w-auto object-contain sm:h-16" priority />
          </Link>
          <h1 className="mt-8 font-display text-4xl tracking-[-.04em]">Content de vous revoir</h1>
          <p className="mt-2 text-sm leading-6 text-[#756960]">Connectez-vous avec votre email ou votre téléphone et votre mot de passe.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[#f3e9dc] p-1">
            <button
              type="button"
              onClick={() => setMethod('email')}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'email' ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.22)]' : 'text-[#756960] hover:text-[#ec3b78]'}`}
            >
              <span className="inline-flex items-center gap-2"><Mail size={15} /> Email</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('phone')}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'phone' ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.22)]' : 'text-[#756960] hover:text-[#ec3b78]'}`}
            >
              <span className="inline-flex items-center gap-2"><Phone size={15} /> Téléphone</span>
            </button>
          </div>

          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#9a8b82]">
              <span className="h-px flex-1 bg-[#e8d9cd]" />
              ou
              <span className="h-px flex-1 bg-[#e8d9cd]" />
            </div>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#dfd2c6] bg-white px-4 py-3 text-sm font-extrabold text-[#241c18] transition hover:border-[#ec3b78] hover:text-[#ec3b78] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Chrome size={16} /> Continuer avec Google
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-xs font-extrabold text-[#625852]">
              {method === 'email' ? 'Votre email' : 'Votre téléphone'}
              {method === 'email' ? (
                <input
                  required
                  name="contact"
                  type="email"
                  placeholder="vous@exemple.com"
                  className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#ec3b78]"
                />
              ) : (
                <AuthPhoneInput key="phone" required name="contact" />
              )}
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
