'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, X } from 'lucide-react';
import { GoogleIcon } from '@/components/google-icon';
import { AuthPhoneInput } from '@/components/auth-phone-input';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import { ensureProfile } from '@/lib/create-profile';
import { getAuthRedirectOrigin, supabase } from '@/lib/supabase';

type Method = 'email' | 'phone';
type RecoveryStep = 'contact' | 'code' | 'password' | 'done';

export default function ConnexionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<Method>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('contact');
  const [recoveryContact, setRecoveryContact] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirmation, setRecoveryConfirmation] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);

  const canSubmit = useMemo(() => password.length >= 6, [password]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setMessage(errorParam);
      router.replace('/connexion', { scroll: false });
    }
  }, [searchParams, router]);

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

  const handleForgotPassword = async () => {
    setRecoveryContact('');
    setRecoveryCode('');
    setRecoveryPassword('');
    setRecoveryConfirmation('');
    setRecoveryStep('contact');
    setRecoveryMessage('');
    setRecoveryOpen(true);
  };

  const handleSendRecoveryCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const contact = recoveryContact.trim();
    setRecoveryMessage('');
    if (!contact) {
      setRecoveryMessage(method === 'email' ? 'Saisissez votre adresse e-mail.' : 'Saisissez votre numéro de téléphone.');
      return;
    }

    setRecoveryLoading(true);
    if (method === 'phone' && !isValidPhone(contact)) {
      setRecoveryMessage('Veuillez saisir un numéro de téléphone valide.');
      setRecoveryLoading(false);
      return;
    }
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      setRecoveryMessage('Veuillez saisir une adresse e-mail valide.');
      setRecoveryLoading(false);
      return;
    }
    const destination = method === 'phone' ? normalizePhone(contact) : contact.toLowerCase();
    let sendError = false;
    if (method === 'email') {
      const response = await fetch('/api/auth/password-recovery-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: destination }),
      }).catch(() => null);
      sendError = !response?.ok;
    } else {
      const { error } = await supabase.auth.signInWithOtp({ phone: destination, options: { shouldCreateUser: false } });
      sendError = Boolean(error);
    }
    if (sendError) {
      setRecoveryMessage('Impossible d’envoyer le code pour le moment. Vérifiez vos coordonnées et réessayez.');
    } else {
      sessionStorage.setItem('aras-password-recovery', JSON.stringify({ method, contact: destination }));
      setRecoveryContact(destination);
      setRecoveryStep('code');
    }
    setRecoveryLoading(false);
  };

  const handleVerifyRecoveryCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryMessage('');
    const { error } = method === 'email'
      ? await supabase.auth.verifyOtp({ email: recoveryContact, token: recoveryCode.trim(), type: 'recovery' })
      : await supabase.auth.verifyOtp({ phone: recoveryContact, token: recoveryCode.trim(), type: 'sms' });
    if (error) {
      setRecoveryMessage('Code incorrect ou expiré. Vérifiez le code reçu ou demandez-en un nouveau.');
      setRecoveryLoading(false);
      return;
    }
    setRecoveryStep('password');
    setRecoveryMessage('');
    setRecoveryLoading(false);
  };

  const handleResendRecoveryCode = async () => {
    setRecoveryLoading(true);
    setRecoveryMessage('');
    let resendError = false;
    if (method === 'email') {
      const response = await fetch('/api/auth/password-recovery-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryContact }),
      }).catch(() => null);
      resendError = !response?.ok;
    } else {
      const { error } = await supabase.auth.signInWithOtp({ phone: recoveryContact, options: { shouldCreateUser: false } });
      resendError = Boolean(error);
    }
    setRecoveryMessage(resendError
      ? 'Impossible de renvoyer le code tout de suite. Réessayez dans quelques instants.'
      : 'Un nouveau code de vérification a été envoyé.');
    setRecoveryLoading(false);
  };

  const handleChangeRecoveryPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryMessage('');
    if (recoveryPassword.length < 8 || !/[A-Z]/.test(recoveryPassword) || !/\d/.test(recoveryPassword) || !/[^A-Za-z0-9]/.test(recoveryPassword)) {
      setRecoveryMessage('Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un symbole.');
      return;
    }
    if (recoveryPassword !== recoveryConfirmation) {
      setRecoveryMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setRecoveryLoading(true);
    const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
    if (error) {
      setRecoveryMessage('Impossible de modifier le mot de passe. Vérifiez votre connexion et réessayez.');
      setRecoveryLoading(false);
      return;
    }
    sessionStorage.removeItem('aras-password-recovery');
    setRecoveryStep('done');
    setRecoveryMessage('Mot de passe modifié. Redirection vers votre espace…');
    window.setTimeout(() => router.replace('/espace'), 900);
  };

  const closeRecoveryDialog = async () => {
    if (recoveryStep === 'password') await supabase.auth.signOut();
    sessionStorage.removeItem('aras-password-recovery');
    setRecoveryOpen(false);
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
      const invalidCredentials = error.code === 'invalid_credentials'
        || error.message.toLowerCase() === 'invalid login credentials';
      setMessage(invalidCredentials
        ? method === 'email'
          ? 'Adresse e-mail ou mot de passe incorrect.'
          : 'Numéro de téléphone ou mot de passe incorrect.'
        : error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        await supabase.auth.signOut();
        setMessage('Nous ne pouvons pas vérifier le statut de votre compte pour le moment. Réessayez dans quelques instants.');
        setLoading(false);
        return;
      }
      {
        const accessCheck = await fetch('/api/auth/access', { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } });
        if (accessCheck.status === 403) {
          await supabase.auth.signOut();
          setMessage('Votre compte est bloqué. Veuillez contacter contact@aras.sn pour obtenir de l’aide.');
          setLoading(false);
          return;
        }
        if (!accessCheck.ok) {
          await supabase.auth.signOut();
          setMessage('Nous ne pouvons pas vérifier le statut de votre compte pour le moment. Réessayez dans quelques instants.');
          setLoading(false);
          return;
        }
      }
      if (sessionData.session?.access_token) {
        void fetch('/api/admin/activity-log', { method: 'POST', headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }).catch(() => undefined);
      }
      await ensureProfile(data.user.id, method === 'email' ? contact.split('@')[0] : contact);
      router.push('/espace');
    }

    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f8f9fd] to-[#f8f9fd] px-5 pt-[72px]">
      <div className="w-full max-w-[460px]">
        <div className="rounded-[28px] bg-[#f8f9fd] p-8 shadow-[0_20px_60px_rgba(83,46,32,.08)] sm:p-10">
          <Link href="/" className="flex justify-center" aria-label="ARAS">
            <Image src="/aras-logo.jpeg" alt="ARAS" width={180} height={72} className="h-14 w-auto object-contain sm:h-16" priority />
          </Link>
          <h1 className="mt-8 font-display text-4xl tracking-[-.04em]">Content de vous revoir</h1>
          <p className="mt-2 text-sm leading-6 text-[#756960]">Connectez-vous avec votre email ou votre téléphone et votre mot de passe.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[#f8f9fd] p-1">
            <button
              type="button"
              onClick={() => { setMethod('email'); setRecoveryMessage(''); }}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'email' ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.22)]' : 'text-[#756960] hover:text-[#ec3b78]'}`}
            >
              <span className="inline-flex items-center gap-2"><Mail size={15} /> Email</span>
            </button>
            <button
              type="button"
              onClick={() => { setMethod('phone'); setRecoveryMessage(''); }}
              className={`rounded-full px-4 py-3 text-sm font-extrabold transition ${method === 'phone' ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.22)]' : 'text-[#756960] hover:text-[#ec3b78]'}`}
            >
              <span className="inline-flex items-center gap-2"><Phone size={15} /> Téléphone</span>
            </button>
          </div>

          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#9a8b82]">
              <span className="h-px flex-1 bg-[#f8f9fd]" />
              ou
              <span className="h-px flex-1 bg-[#f8f9fd]" />
            </div>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#dfd2c6] bg-white px-4 py-3 text-sm font-extrabold text-[#241c18] transition hover:border-[#ec3b78] hover:text-[#ec3b78] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon size={16} /> Continuer avec Google
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

            <div className="flex justify-end">
              <button type="button" onClick={() => void handleForgotPassword()} disabled={recoveryLoading} className="text-xs font-extrabold text-[#ec3b78] underline-offset-2 hover:underline disabled:opacity-60">
                Mot de passe oublié ?
              </button>
            </div>

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

        {recoveryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 py-6" onClick={() => void closeRecoveryDialog()}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="recovery-dialog-title"
              className="relative max-h-full w-full max-w-[460px] overflow-y-auto rounded-[28px] bg-white p-7 shadow-2xl dark:bg-[#1c1b21] sm:p-9"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" aria-label="Fermer" onClick={() => void closeRecoveryDialog()} className="absolute right-5 top-5 rounded-full p-2 text-[#756960] transition hover:bg-[#f8f9fd] dark:text-white/70 dark:hover:bg-white/10">
                <X size={18} />
              </button>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fce7ef] text-[#ec3b78]"><LockKeyhole size={21} /></div>
              <h2 id="recovery-dialog-title" className="mt-5 pr-8 font-display text-2xl font-bold text-[#241c18] dark:text-white">
                {recoveryStep === 'contact' ? 'Mot de passe oublié ?' : recoveryStep === 'code' ? 'Vérification' : recoveryStep === 'password' ? 'Nouveau mot de passe' : 'Mot de passe modifié'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#756960] dark:text-white/65">
                {recoveryStep === 'contact' && `Ressaisissez votre ${method === 'email' ? 'adresse e-mail' : 'numéro de téléphone'} pour recevoir un code à 6 chiffres.`}
                {recoveryStep === 'code' && <>Saisissez le code à 6 chiffres envoyé à <strong>{recoveryContact}</strong>.</>}
                {recoveryStep === 'password' && 'Choisissez un nouveau mot de passe pour votre compte.'}
                {recoveryStep === 'done' && recoveryMessage}
              </p>

              {recoveryStep === 'contact' && (
                <form onSubmit={handleSendRecoveryCode} className="mt-6 space-y-4">
                  <label className="block text-xs font-extrabold text-[#625852] dark:text-white/80">
                    {method === 'email' ? 'Adresse e-mail' : 'Numéro de téléphone'}
                    {method === 'email' ? (
                      <input required type="email" autoComplete="email" value={recoveryContact} onChange={(event) => setRecoveryContact(event.target.value)} placeholder="vous@exemple.com" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white" />
                    ) : (
                      <AuthPhoneInput key="recovery-dialog-phone" name="recoveryContact" value={recoveryContact} onChange={setRecoveryContact} placeholder="Saisissez votre numéro" />
                    )}
                  </label>
                  {recoveryMessage && <p role="status" className="text-sm font-semibold text-[#c92e63]">{recoveryMessage}</p>}
                  <button type="submit" disabled={recoveryLoading} className="w-full rounded-full bg-[#ec3b78] py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-60">
                    {recoveryLoading ? 'Envoi en cours…' : 'Envoyer le code'}
                  </button>
                </form>
              )}

              {recoveryStep === 'code' && (
                <form onSubmit={handleVerifyRecoveryCode} className="mt-6 space-y-4">
                  <label className="block text-xs font-extrabold text-[#625852] dark:text-white/80">
                    Code de vérification
                    <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-center text-lg tracking-[.35em] outline-none focus:border-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white" />
                  </label>
                  {recoveryMessage && <p role="status" className="text-sm font-semibold text-[#c92e63]">{recoveryMessage}</p>}
                  <button type="submit" disabled={recoveryLoading || recoveryCode.length !== 6} className="w-full rounded-full bg-[#ec3b78] py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-60">
                    {recoveryLoading ? 'Vérification…' : 'Valider le code'}
                  </button>
                  <button type="button" onClick={() => void handleResendRecoveryCode()} disabled={recoveryLoading} className="w-full py-2 text-sm font-extrabold text-[#1a6b68] disabled:opacity-60">Renvoyer le code</button>
                  <button type="button" onClick={() => { setRecoveryStep('contact'); setRecoveryCode(''); setRecoveryMessage(''); }} className="w-full py-1 text-xs font-semibold text-[#756960] dark:text-white/60">Modifier les coordonnées</button>
                </form>
              )}

              {recoveryStep === 'password' && (
                <form onSubmit={handleChangeRecoveryPassword} className="mt-6 space-y-4">
                  <label className="block text-xs font-extrabold text-[#625852] dark:text-white/80">
                    Nouveau mot de passe
                    <div className="relative mt-2">
                      <input required minLength={8} type={showRecoveryPassword ? 'text' : 'password'} autoComplete="new-password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} className="w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 pr-12 text-sm outline-none focus:border-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white" />
                      <button type="button" aria-label={showRecoveryPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowRecoveryPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8b82]">{showRecoveryPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                    </div>
                    <span className="mt-2 block text-[11px] font-medium text-[#9a8b82]">8 caractères minimum, une majuscule, un chiffre et un symbole.</span>
                  </label>
                  <label className="block text-xs font-extrabold text-[#625852] dark:text-white/80">
                    Confirmer le nouveau mot de passe
                    <input required minLength={8} type={showRecoveryPassword ? 'text' : 'password'} autoComplete="new-password" value={recoveryConfirmation} onChange={(event) => setRecoveryConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white" />
                  </label>
                  {recoveryMessage && <p role="status" className="text-sm font-semibold text-[#c92e63]">{recoveryMessage}</p>}
                  <button type="submit" disabled={recoveryLoading} className="w-full rounded-full bg-[#ec3b78] py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-60">
                    {recoveryLoading ? 'Modification…' : 'Modifier mon mot de passe'}
                  </button>
                </form>
              )}

              {recoveryStep === 'done' && <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-[#1a6b68]"><ShieldCheck size={17} /> Votre mot de passe a été modifié.</div>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
