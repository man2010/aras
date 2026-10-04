'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type RecoveryMethod = 'email' | 'phone';
type RecoveryStep = 'loading' | 'code' | 'password' | 'done' | 'unavailable';

function isStrongPassword(value: string) {
  return value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

function maskContact(contact: string, method: RecoveryMethod) {
  if (method === 'email') {
    const [name, domain] = contact.split('@');
    return domain ? `${name.slice(0, 2)}•••@${domain}` : contact;
  }
  return `${contact.slice(0, 4)}••••${contact.slice(-2)}`;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<RecoveryStep>('loading');
  const [method, setMethod] = useState<RecoveryMethod>('email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('aras-password-recovery');
      if (!pending) {
        setStep('unavailable');
        return;
      }
      const parsed = JSON.parse(pending) as { method?: RecoveryMethod; contact?: string };
      if ((parsed.method !== 'email' && parsed.method !== 'phone') || !parsed.contact) {
        setStep('unavailable');
        return;
      }
      setMethod(parsed.method);
      setContact(parsed.contact);
      setStep('code');
    } catch {
      setStep('unavailable');
    }
  }, []);

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = method === 'email'
      ? await supabase.auth.verifyOtp({ email: contact, token: code.trim(), type: 'recovery' })
      : await supabase.auth.verifyOtp({ phone: contact, token: code.trim(), type: 'sms' });
    if (error) {
      setMessage('Code incorrect ou expiré. Vérifiez le code reçu ou demandez-en un nouveau.');
      setBusy(false);
      return;
    }
    setStep('password');
    setMessage('');
    setBusy(false);
  }

  async function resendCode() {
    setBusy(true);
    setMessage('');
    let resendError = false;
    if (method === 'email') {
      const response = await fetch('/api/auth/password-recovery-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contact }),
      }).catch(() => null);
      resendError = !response?.ok;
    } else {
      const { error } = await supabase.auth.signInWithOtp({ phone: contact, options: { shouldCreateUser: false } });
      resendError = Boolean(error);
    }
    setMessage(resendError
      ? 'Impossible de renvoyer le code tout de suite. Réessayez dans quelques instants.'
      : 'Un nouveau code de vérification a été envoyé.');
    setBusy(false);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!isStrongPassword(password)) {
      setMessage('Choisissez au moins 8 caractères avec une majuscule, un chiffre et un symbole.');
      return;
    }
    if (password !== confirmation) {
      setMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage('Impossible de modifier le mot de passe. Vérifiez votre connexion et réessayez.');
      setBusy(false);
      return;
    }

    sessionStorage.removeItem('aras-password-recovery');
    setSaved(true);
    setMessage('Mot de passe modifié. Redirection vers votre espace…');
    window.setTimeout(() => router.replace('/espace'), 900);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] px-5 pb-12 pt-24 dark:bg-[#101014]">
      <section className="w-full max-w-[460px] rounded-[28px] bg-white p-7 shadow-[0_20px_60px_rgba(83,46,32,.08)] dark:bg-[#1c1b21] sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f0ed] text-[#1a6b68]"><LockKeyhole size={22} /></div>
        <h1 className="mt-5 font-display text-3xl font-bold text-[#241c18] dark:text-white">Réinitialiser le mot de passe</h1>

        {step === 'loading' ? <p className="mt-4 text-sm text-[#756960]">Préparation de la vérification…</p> : step === 'unavailable' ? (
          <div className="mt-4 rounded-xl bg-[#fae4e2] p-4 text-sm leading-6 text-[#a52b42]">
            Cette demande n’est plus disponible. Recommencez depuis la page de connexion.
            <Link href="/connexion" className="mt-3 block font-extrabold underline">Retour à la connexion</Link>
          </div>
        ) : step === 'code' ? (
          <>
            <p className="mt-2 text-sm leading-6 text-[#756960] dark:text-white/65">Si un compte correspond à ces coordonnées, un code de validation a été envoyé par {method === 'email' ? 'e-mail' : 'SMS'} à <strong>{maskContact(contact, method)}</strong>.</p>
            <form onSubmit={verifyCode} className="mt-6 space-y-4">
              <label className="block text-xs font-extrabold text-[#625852] dark:text-white/80">
                Code de validation
                <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3.5 text-center text-lg tracking-[.3em] outline-none focus:border-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white" />
              </label>
              {message && <p role="status" className="text-sm font-semibold text-[#c92e63]">{message}</p>}
              <button type="submit" disabled={busy || !code.trim()} className="w-full rounded-full bg-[#ec3b78] py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-60">{busy ? 'Vérification…' : 'Valider le code'}</button>
              <button type="button" onClick={() => void resendCode()} disabled={busy} className="w-full py-2 text-sm font-extrabold text-[#1a6b68] disabled:opacity-60">Renvoyer le code</button>
            </form>
          </>
        ) : step === 'done' ? (
          <div className="mt-5 space-y-4">
            <p role="status" className="text-sm leading-6 text-[#1a6b68]">{message}</p>
            <Link href="/connexion" className="block w-full rounded-full bg-[#ec3b78] py-4 text-center text-sm font-extrabold text-white">Retour à la connexion</Link>
          </div>
        ) : (
          <>
            <form onSubmit={changePassword} className="mt-6 space-y-4">
              <label className="block text-xs font-extrabold text-[#625852] dark:text-white/80">
                Nouveau mot de passe
                <div className="relative mt-2">
                  <input required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3.5 pr-12 text-sm outline-none focus:border-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white" />
                  <button type="button" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8b82]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
                <span className="mt-2 block text-[11px] font-medium text-[#9a8b82]">8 caractères minimum, une majuscule, un chiffre et un symbole.</span>
              </label>
              <label className="block text-xs font-extrabold text-[#625852] dark:text-white/80">
                Confirmer le nouveau mot de passe
                <input required minLength={8} type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3.5 text-sm outline-none focus:border-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white" />
              </label>
              {message && <p role="status" className={`text-sm font-semibold ${saved ? 'text-[#1a6b68]' : 'text-[#c92e63]'}`}>{message}</p>}
              <button type="submit" disabled={busy || saved} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ec3b78] py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-60">{saved && <Check size={16} />}{busy ? 'Modification…' : 'Modifier mon mot de passe'}</button>
            </form>
          </>
        )}
        {step !== 'unavailable' && <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-[#9a8b82]"><ShieldCheck size={14} /> La vérification protège votre compte.</p>}
      </section>
    </main>
  );
}
