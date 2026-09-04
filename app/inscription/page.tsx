'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, Check, X, Sparkles, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toProfile, type ProfileRow } from '@/lib/adapters';

function assessStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthMeta = [
  { label: 'Très faible', color: '#c83d50', bar: '20%' },
  { label: 'Faible', color: '#d89b52', bar: '40%' },
  { label: 'Correct', color: '#d89b52', bar: '60%' },
  { label: 'Bon', color: '#1a6b68', bar: '80%' },
  { label: 'Excellent', color: '#1a6b68', bar: '100%' },
];

export default function InscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const strength = assessStrength(password);
  const meta = strengthMeta[Math.min(strength, 4)];
  const canSubmit = strength >= 3;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const pw = String(form.get('password') ?? '');
    
    try {
      console.log('=== DÉBUT INSCRIPTION ===');
      console.log('Email:', email);
      console.log('URL Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password: pw
      });
      
      if (error) {
        console.error('=== ERREUR AUTHENTIFICATION ===');
        console.error('Code:', error.status);
        console.error('Message:', error.message);
        console.error('Détails:', error);
        
        // Cas spécial : compte existe déjà mais pas de profil
        if (error.message?.includes('already registered') || error.status === 400) {
          console.log('Compte existe déjà, tentative de connexion...');
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: pw });
          
          if (!signInError && signInData.user) {
            console.log('Connexion réussie, vérification profil...');
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', signInData.user.id).maybeSingle();
            
            if (!profile) {
              console.log('Profil manquant, création...');
              const { error: createError } = await supabase.from('profiles').insert({
                id: signInData.user.id,
                full_name: email.split('@')[0],
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
              });
              
              if (createError) {
                console.error('Erreur création profil:', createError);
                setMessage('Compte existe mais erreur profil: ' + createError.message);
                setLoading(false);
                return;
              }
            }
            
            setSuccess(true);
            setMessage('Connexion réussie ! Bienvenue chez ARAS.');
            setTimeout(() => router.push('/espace'), 1200);
            return;
          }
        }
        
        setMessage(error.message || 'Erreur lors de l\'inscription');
        setLoading(false);
        return;
      }
      
      if (data.user) {
        console.log('=== UTILISATEUR CRÉÉ ===');
        console.log('User ID:', data.user.id);
        console.log('Email:', data.user.email);
        console.log('Confirmé:', data.user.confirmed_at);
        
        // Avec confirmation email désactivée, l'utilisateur est déjà connecté
        if (data.user.confirmed_at) {
          console.log('Utilisateur déjà confirmé, vérification profil...');
          
          // Create profile entry for the new user
          try {
            console.log('=== CRÉATION PROFIL ===');
            const { error: profileError } = await supabase.from('profiles').insert({
              id: data.user.id,
              full_name: email.split('@')[0],
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
            });
            
            if (profileError) {
              console.error('=== ERREUR CRÉATION PROFIL ===');
              console.error('Code:', profileError.code);
              console.error('Message:', profileError.message);
              console.error('Détails:', profileError);
              console.error('Hint:', profileError.hint);
              throw new Error(`Erreur création profil: ${profileError.message}`);
            }
            
            console.log('=== SUCCÈS ===');
            console.log('Profil créé avec succès');
            setSuccess(true);
            setMessage('Votre compte est prêt. Bienvenue chez ARAS.');
            setTimeout(() => router.push('/espace'), 1200);
            
          } catch (profileError) {
            console.error('=== EXCEPTION CRÉATION PROFIL ===');
            console.error('Exception:', profileError);
            throw new Error(`Échec création profil: ${profileError instanceof Error ? profileError.message : 'Erreur inconnue'}`);
          }
        } else {
          console.log('Utilisateur créé mais non confirmé - tentative de connexion automatique...');
          // Tenter de connecter l'utilisateur immédiatement après création
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: pw });
          
          if (!signInError && signInData.user) {
            console.log('Connexion automatique réussie !');
            
            // Créer le profil
            try {
              const { error: profileError } = await supabase.from('profiles').insert({
                id: signInData.user.id,
                full_name: email.split('@')[0],
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
              });
              
              if (profileError) {
                console.error('Erreur création profil après connexion auto:', profileError);
                setSuccess(true);
                setMessage('Compte créé et connecté ! (profil: erreur)');
                setTimeout(() => router.push('/espace'), 1500);
                return;
              }
              
              setSuccess(true);
              setMessage('Compte créé avec succès ! Bienvenue chez ARAS.');
              setTimeout(() => router.push('/espace'), 1200);
              
            } catch (profileError) {
              console.error('Exception création profil:', profileError);
              setSuccess(true);
              setMessage('Compte créé et connecté ! (profil: erreur)');
              setTimeout(() => router.push('/espace'), 1500);
            }
          } else {
            console.error('Échec connexion automatique:', signInError);
            setMessage('Compte créé. Veuillez vous connecter avec vos identifiants.');
            setSuccess(true);
            setTimeout(() => router.push('/connexion'), 2000);
          }
        }
      }
    } catch (exception) {
      console.error('=== EXCEPTION NON GÉRÉE ===');
      console.error('Exception:', exception);
      const errorMessage = exception instanceof Error ? exception.message : 'Erreur inconnue lors de l\'inscription';
      setMessage(errorMessage);
    } finally {
      console.log('=== FIN INSCRIPTION ===');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f3e9dc] to-[#fbf8f2] px-5 pt-[72px]">
      <div className="w-full max-w-[480px]">
        <div className="rounded-[28px] bg-[#fbf8f2] p-8 shadow-[0_20px_60px_rgba(83,46,32,.08)] sm:p-10">
          <Link href="/" className="font-display text-3xl font-bold tracking-[-.06em] text-[#e9515f]">ARAS<span className="text-[#d89b52]">.</span></Link>
          <div className="mt-6 mb-2 inline-flex items-center gap-2 rounded-full border border-[#d89b52]/40 bg-white/40 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#9a682f]"><Sparkles size={13} /> Bienvenue</div>
          <h1 className="font-display text-4xl tracking-[-.04em]">Créer mon compte</h1>
          <p className="mt-2 text-sm leading-6 text-[#756960]">Un profil sincère est le premier pas vers une belle rencontre.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-xs font-extrabold text-[#625852]">Votre email<input required name="email" type="email" placeholder="vous@exemple.com" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#e9515f]" /></label>
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
                  className="w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#e9515f]"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8b82] transition hover:text-[#241c18]">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-[#9a8b82]">{password.length} caractères</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f3e9dc]">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: meta.bar, background: meta.color }} />
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    {[
                      { ok: (pw: string) => pw.length >= 8, label: '8+ caractères' },
                      { ok: (pw: string) => /[A-Z]/.test(pw), label: '1 majuscule' },
                      { ok: (pw: string) => /\d/.test(pw), label: '1 chiffre' },
                      { ok: (pw: string) => /[^A-Za-z0-9]/.test(pw), label: '1 symbole' },
                    ].map((req) => (
                      <li key={req.label} className={`flex items-center gap-1.5 ${req.ok(password) ? 'text-[#1a6b68]' : 'text-[#9a8b82]'}`}>
                        {req.ok(password) ? <Check size={12} /> : <X size={12} />} {req.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {message && (
              <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${success ? 'bg-[#e5f0ed] text-[#1a6b68]' : 'bg-[#fae4e2] text-[#c83d50]'}`}>
                {success ? <Check size={16} className="mt-0.5 shrink-0" /> : <X size={16} className="mt-0.5 shrink-0" />} <span>{message}</span>
              </div>
            )}
            <button disabled={loading || !canSubmit} className="w-full rounded-full bg-[#e9515f] py-4 text-sm font-extrabold text-white transition hover:bg-[#c83d50] disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Un instant...' : 'Créer mon compte'} <ArrowRight size={16} className="ml-2 inline" />
            </button>
            {!canSubmit && password.length > 0 && (
              <p className="text-center text-[11px] font-bold text-[#9a8b82]">Renforcez votre mot de passe pour continuer (au moins une majuscule, un chiffre et 8 caractères).</p>
            )}
          </form>
          <p className="mt-6 text-center text-sm text-[#756960]">Vous avez déjà un compte ? <Link href="/connexion" className="font-extrabold text-[#e9515f]">Se connecter</Link></p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#9a8b82]"><LockKeyhole size={13} /> Vos données restent confidentielles</div>
        </div>
      </div>
    </main>
  );
}
