'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Chrome, Eye, EyeOff, LockKeyhole, Mail, Phone, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { AuthPhoneInput } from '@/components/auth-phone-input';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import { HumanVerification } from '@/components/human-verification';
import { createProfileAfterSignup } from '@/lib/create-profile';
import { requestHumanVerification } from '@/lib/verify-human-client';
import { supabase } from '@/lib/supabase';

type Method = 'email' | 'phone';

function isStrongPassword(value: string) {
  return value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function InscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [turnstileToken, setTurnstileToken] = useState('');
  const [pendingHumanProof, setPendingHumanProof] = useState('');

  const canSubmit = useMemo(() => {
    return isStrongPassword(password) && Boolean(turnstileToken);
  }, [password, turnstileToken]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setMessage(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/onboarding` : undefined,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
  };

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

  const finalizeProfile = async (displayName: string, humanProof: string) => {
    const result = await createProfileAfterSignup(displayName, humanProof);
    if (!result.ok) {
      setMessage(result.error);
      setSuccess(false);
      return false;
    }
    if (!result.is_verified) {
      setMessage(
        'Compte créé. Votre profil n’est pas marqué « vérifié » : la vérification anti-robot n’a pas abouti. Vous pouvez continuer l’inscription.'
      );
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const form = new FormData(e.currentTarget);
    const contact = String(form.get('contact') ?? '').trim();
    const acceptedLegal = form.get('legal') === 'on';
    const over18 = form.get('over18') === 'on';

    if (!acceptedLegal || !over18) {
      setMessage('Vous devez accepter les conditions générales et la politique de confidentialité, et confirmer avoir plus de 18 ans.');
      setLoading(false);
      return;
    }

    if (!isStrongPassword(password)) {
      setMessage('Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un symbole.');
      setLoading(false);
      return;
    }

    if (method === 'phone' && !isValidPhone(contact)) {
      setMessage('Veuillez saisir un numéro de téléphone valide.');
      setLoading(false);
      return;
    }

    if (!turnstileToken) {
      setMessage('Veuillez confirmer que vous n’êtes pas un robot.');
      setLoading(false);
      return;
    }

    const humanCheck = await requestHumanVerification(turnstileToken);
    if (!humanCheck.ok) {
      setMessage(humanCheck.error);
      setTurnstileToken('');
      setLoading(false);
      return;
    }
    setPendingHumanProof(humanCheck.proof);

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
      const displayName = method === 'email' ? contact.split('@')[0] : contact;
      const profileOk = await finalizeProfile(displayName, humanCheck.proof);
      if (!profileOk) {
        setLoading(false);
        return;
      }
      setSuccess(true);
      if (!message) {
        setMessage('Compte créé avec succès. Complétez maintenant votre profil.');
      }
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
        const profileOk = await finalizeProfile(pendingContact, pendingHumanProof);
        if (!profileOk) {
          setLoading(false);
          return;
        }
        setSuccess(true);
        if (!message) {
          setMessage('Téléphone confirmé. Complétez maintenant votre profil.');
        }
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
        const profileOk = await finalizeProfile(pendingContact.split('@')[0], pendingHumanProof);
        if (!profileOk) {
          setLoading(false);
          return;
        }
        setSuccess(true);
        if (!message) {
          setMessage('Email confirmé. Complétez maintenant votre profil.');
        }
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
          <Link href="/" className="flex justify-center" aria-label="ARAS">
            <Image src="/aras-logo.jpeg" alt="ARAS" width={180} height={72} className="h-14 w-auto object-contain sm:h-16" priority />
          </Link>
          
          <h1 className="mt-6 font-display text-4xl tracking-[-.04em]">Créer mon compte</h1>
          <p className="mt-2 text-sm leading-6 text-[#756960]">
            Choisissez email ou téléphone, puis confirmez votre accès avant de rejoindre ARAS.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[#f3e9dc] p-1">
            <button
              type="button"
              onClick={() => { setMethod('email'); setNeedsVerification(false); setVerificationCode(''); setPendingContact(''); setMessage(''); setCountdown(30); setCanResend(false); setTurnstileToken(''); setPendingHumanProof(''); }}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'email' ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.22)]' : 'text-[#756960] hover:text-[#ec3b78]'}`}
            >
              <span className="inline-flex items-center gap-2"><Mail size={15} /> Email</span>
            </button>
            <button
              type="button"
              onClick={() => { setMethod('phone'); setNeedsVerification(false); setVerificationCode(''); setPendingContact(''); setMessage(''); setCountdown(30); setCanResend(false); setTurnstileToken(''); setPendingHumanProof(''); }}
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

          {!needsVerification ? (
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
                  <input type="checkbox" name="legal" className="mt-1 h-4 w-4 accent-[#ec3b78]" />
                  <span>
                    J’accepte les{' '}
                    <Link href="/cgu" className="font-extrabold text-[#ec3b78] underline-offset-2 hover:underline">
                      conditions générales d&apos;utilisation
                    </Link>{' '}
                    et la{' '}
                    <Link href="/politique-confidentialite" className="font-extrabold text-[#ec3b78] underline-offset-2 hover:underline">
                      politique de confidentialité
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="over18" className="mt-1 h-4 w-4 accent-[#ec3b78]" />
                  <span>Je confirme avoir plus de 18 ans.</span>
                </label>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-extrabold text-[#625852]">
                  <ShieldCheck size={14} className="text-[#1a6b68]" />
                  Vérification rapide (anti-robot)
                </p>
                <HumanVerification
                  onToken={setTurnstileToken}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                />
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



