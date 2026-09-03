'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ConnexionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      router.push('/espace');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f3e9dc] to-[#fbf8f2] px-5 pt-[72px]">
      <div className="w-full max-w-[460px]">
        <div className="rounded-[28px] bg-[#fbf8f2] p-8 shadow-[0_20px_60px_rgba(83,46,32,.08)] sm:p-10">
          <Link href="/" className="font-display text-3xl font-bold tracking-[-.06em] text-[#e9515f]">ARAS<span className="text-[#d89b52]">.</span></Link>
          <h1 className="mt-8 font-display text-4xl tracking-[-.04em]">Content de vous revoir</h1>
          <p className="mt-2 text-sm leading-6 text-[#756960]">Retrouvez votre espace et vos conversations.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-xs font-extrabold text-[#625852]">Votre email<input required name="email" type="email" placeholder="vous@exemple.com" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#e9515f]" /></label>
            <label className="block text-xs font-extrabold text-[#625852]">Mot de passe<input required minLength={6} name="password" type="password" placeholder="6 caractères minimum" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#e9515f]" /></label>
            {message && <div className="flex items-center gap-2 rounded-xl bg-[#fae4e2] px-4 py-3 text-sm text-[#c83d50]"><X size={16} /> {message}</div>}
            <button disabled={loading} className="w-full rounded-full bg-[#e9515f] py-4 text-sm font-extrabold text-white transition hover:bg-[#c83d50] disabled:opacity-60">{loading ? 'Un instant...' : 'Se connecter'} <ArrowRight size={16} className="ml-2 inline" /></button>
          </form>
          <p className="mt-6 text-center text-sm text-[#756960]">Pas encore de compte ? <Link href="/inscription" className="font-extrabold text-[#e9515f]">Créer un compte</Link></p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#9a8b82]"><LockKeyhole size={13} /> Vos données restent confidentielles</div>
        </div>
      </div>
    </main>
  );
}
