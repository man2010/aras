'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Phone, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Method = 'email' | 'phone';

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '').trim();
}

function isValidPhone(value: string) {
  return /^\+?[1-9]\d{7,14}$/.test(normalizePhone(value));
}

function isStrongPassword(value: string) {
  return value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function InscriptionPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pendingContact, setPendingContact] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const canSubmit = useMemo(() => {
    return isStrongPassword(password);
  }, [password]);

  // Timer pour l'expiration du code (30 secondes)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (needsVerification && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [needsVerification, countdown]);

  const createProfile = async (userId: string, displayName: string) => {
    await supabase.from('profiles').upsert(
      {
        id: userId,
        full_name: displayName,
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
        profile_status: 'verified',
        onboarding_completed: false,
        is_verified: true,
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
    const acceptedTerms = form.get('terms') === 'on';
    const acceptedPrivacy = form.get('privacy') === 'on';
    const over18 = form.get('over18') === 'on';

    if (!acceptedTerms || !acceptedPrivacy || !over18) {
      setMessage('Vous devez accepter les conditions, la confidentialité et confirmer avoir plus de 18 ans.');
      setLoading(false);
      return;
    }

    if (!isStrongPassword(password)) {
      setMessage('Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un symbole.');
      setLoading(false);
      return;
    }

    if (method === 'phone' && !isValidPhone(contact)) {
      setMessage('Veuillez saisir un numéro de téléphone valide au format international, par exemple +221...');
      setLoading(false);
      return;
    }

    const payload =
      method === 'email'
        ? { email: contact, password }
        : { phone: normalizePhone(contact), password };

    const { data, error } = await supabase.auth.signUp({
      ...payload,
      options: {
        data: { auth_method: method },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.user && data.session) {
      await createProfile(data.user.id, method === 'email' ? contact.split('@')[0] : contact);
      setSuccess(true);
      setMessage('Compte créé avec succès. Complétez maintenant votre profil.');
      setTimeout(() => router.push('/onboarding'), 1200);
      setLoading(false);
      return;
    }

    setPendingContact(contact);
    setNeedsVerification(true);
    setCountdown(30);
    setCanResend(false);
    setSuccess(true);
    setMessage(method === 'phone' ? 'Un code SMS a été envoyé. Saisissez-le pour confirmer votre compte.' : 'Un email de confirmation a été envoyé. Suivez le lien reçu pour activer votre compte.');
    setLoading(false);
  };

  const handleResendCode = async () => {
    setLoading(true);
    setMessage('');

    if (method === 'email') {
      const { error } = await supabase.auth.signInWithOtp({
        email: pendingContact,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizePhone(pendingContact),
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
    }

    setCountdown(30);
    setCanResend(false);
    setSuccess(true);
    setMessage(method === 'phone' ? 'Un nouveau code SMS a été envoyé.' : 'Un nouvel email de confirmation a été envoyé.');
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    setMessage('');

    if (method === 'phone') {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizePhone(pendingContact),
        token: verificationCode.trim(),
        type: 'sms',
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await createProfile(data.user.id, pendingContact);
        setSuccess(true);
        setMessage('Téléphone confirmé. Complétez maintenant votre profil.');
        setTimeout(() => router.push('/onboarding'), 1200);
        setLoading(false);
        return;
      }
    } else {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingContact,
        token: verificationCode.trim(),
        type: 'email',
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await createProfile(data.user.id, pendingContact.split('@')[0]);
        setSuccess(true);
        setMessage('Email confirmé. Complétez maintenant votre profil.');
        setTimeout(() => router.push('/onboarding'), 1200);
        setLoading(false);
        return;
      }
    }

    setMessage('Code invalide ou expiré.');
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f3e9dc] to-[#fbf8f2] px-5 pt-[72px]">
      <div className="w-full max-w-[520px]">
        <div className="rounded-[28px] bg-[#fbf8f2] p-8 shadow-[0_20px_60px_rgba(83,46,32,.08)] sm:p-10">
          <Link href="/" className="font-display text-3xl font-bold tracking-[-.06em] text-[#ec3b78]">
            ARAS<span className="text-[#d89b52]">.</span>
          </Link>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#d89b52]/40 bg-white/40 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#9a682f]">
            <ShieldCheck size={13} /> Inscription sécurisée
          </div>
          <h1 className="mt-6 font-display text-4xl tracking-[-.04em]">Créer mon compte</h1>
          <p className="mt-2 text-sm leading-6 text-[#756960]">
            Choisissez email ou téléphone, puis confirmez votre accès avant de rejoindre ARAS.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[#f3e9dc] p-1">
            <button
              type="button"
              onClick={() => { setMethod('email'); setNeedsVerification(false); setVerificationCode(''); setPendingContact(''); setMessage(''); setCountdown(30); setCanResend(false); }}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'email' ? 'bg-white text-[#241c18]' : 'text-[#756960]'}`}
            >
              <span className="inline-flex items-center gap-2"><Mail size={15} /> Email</span>
            </button>
            <button
              type="button"
              onClick={() => { setMethod('phone'); setNeedsVerification(false); setVerificationCode(''); setPendingContact(''); setMessage(''); setCountdown(30); setCanResend(false); }}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'phone' ? 'bg-white text-[#241c18]' : 'text-[#756960]'}`}
            >
              <span className="inline-flex items-center gap-2"><Phone size={15} /> Téléphone</span>
            </button>
          </div>

          {!needsVerification ? (
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


              <div>
                <label className="block text-xs font-extrabold text-[#625852]">Mot de passe</label>
                <div className="relative mt-2">
                  <input
                    required
                    minLength={8}
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 8 caractères, variés"
                    className="w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#ec3b78]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8b82] transition hover:text-[#241c18]"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl bg-white p-4 text-sm text-[#756960]">
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="terms" className="mt-1 h-4 w-4 accent-[#ec3b78]" />
                  <span>J’accepte les conditions générales d’utilisation.</span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="privacy" className="mt-1 h-4 w-4 accent-[#ec3b78]" />
                  <span>J’accepte la politique de confidentialité.</span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="over18" className="mt-1 h-4 w-4 accent-[#ec3b78]" />
                  <span>Je confirme avoir plus de 18 ans.</span>
                </label>
              </div>

              {message && (
                <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${success ? 'bg-[#e5f0ed] text-[#1a6b68]' : 'bg-[#fae4e2] text-[#c92e63]'}`}>
                  {success ? <Check size={16} className="mt-0.5 shrink-0" /> : <X size={16} className="mt-0.5 shrink-0" />}
                  <span>{message}</span>
                </div>
              )}

              <button
                disabled={loading || !canSubmit}
                className="w-full rounded-full bg-[#ec3b78] py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Un instant...' : 'Créer mon compte'} <ArrowRight size={16} className="ml-2 inline" />
              </button>
              {!canSubmit && password.length > 0 && (
                <p className="text-center text-[11px] font-bold text-[#9a8b82]">
                  Le mot de passe doit contenir 8 caractères minimum, une majuscule, un chiffre et un symbole.
                </p>
              )}
            </form>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl bg-white p-4 text-sm text-[#756960]">
                <p className="font-bold text-[#241c18]">Vérification requise</p>
                <p className="mt-1">
                  {method === 'phone'
                    ? `Un code SMS a été envoyé à ${pendingContact}.`
                    : `Un email a été envoyé à ${pendingContact}.`}
                </p>
                {countdown > 0 ? (
                  <p className="mt-2 text-xs font-bold text-[#1a6b68]">
                    Code valide pendant {countdown} seconde{countdown > 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-bold text-[#c92e63]">
                    Code expiré
                  </p>
                )}
              </div>

              <label className="block text-xs font-extrabold text-[#625852]">
                Code de vérification
                <input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  inputMode="numeric"
                  placeholder="123456"
                  disabled={countdown === 0}
                  className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#ec3b78] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </label>

              {countdown === 0 && (
                <button
                  onClick={handleResendCode}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full rounded-full border border-[#ec3b78] bg-white px-4 py-3 text-sm font-extrabold text-[#ec3b78] transition hover:bg-[#fbf8f2] disabled:opacity-50"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Envoi en cours...' : 'Renvoyer le code'}
                </button>
              )}

              {message && (
                <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${success ? 'bg-[#e5f0ed] text-[#1a6b68]' : 'bg-[#fae4e2] text-[#c92e63]'}`}>
                  {success ? <Check size={16} className="mt-0.5 shrink-0" /> : <X size={16} className="mt-0.5 shrink-0" />}
                  <span>{message}</span>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || !verificationCode.trim() || countdown === 0}
                className="w-full rounded-full bg-[#1a6b68] py-4 text-sm font-extrabold text-white transition hover:bg-[#125552] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Vérification...' : 'Confirmer mon compte'}
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-[#756960]">
            Vous avez déjà un compte ?{' '}
            <Link href="/connexion" className="font-extrabold text-[#ec3b78]">
              Se connecter
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



