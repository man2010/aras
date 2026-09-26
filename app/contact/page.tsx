'use client';

import React from 'react';
import { Mail, Send, Clock, CheckCircle2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus('sending');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      const data = await response.json();
      console.log('Response data:', data);
      if (!response.ok) throw new Error();
      setStatus('sent');
      if (formRef.current) formRef.current.reset();
      setMessage('');
    } catch (error) {
      console.error('Erreur formulaire:', error);
      setStatus('error');
    }
  }
  return <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[105px] lg:px-8 lg:pt-[130px]">
    <div className="mx-auto grid max-w-[1040px] gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
      <section className="lg:pt-8">
        <p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#ec3b78]">Nous contacter</p>
        <h1 className="font-display mt-4 text-4xl leading-tight tracking-[-.045em] text-[#241c18] sm:text-6xl">Parlons-en, <span className="italic text-[#1a6b68]">simplement.</span></h1>
        <p className="mt-5 max-w-[420px] text-[15px] leading-7 text-[#756960]">Une question, besoin d’aide ou de signaler un problème ? L’équipe ARAS est à votre écoute.</p>
        <div className="mt-9 space-y-4">
          <a href="mailto:contact@aras.sn" className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_6px_22px_rgba(83,46,32,.05)] transition hover:-translate-y-0.5"><Mail className="text-[#ec3b78]" /><span><span className="block text-xs font-bold uppercase tracking-wider text-[#9a8b82]">E-mail</span><span className="mt-1 block font-bold text-[#241c18]">contact@aras.sn</span></span></a>
          <div className="flex items-center gap-4 rounded-2xl bg-[#f3e9dc] p-5"><Clock className="text-[#c88a27]" /><span className="text-sm leading-6 text-[#756960]">Réponse habituelle sous <strong className="text-[#241c18]">24 à 48 heures ouvrées</strong>.</span></div>
        </div>
      </section>
      <section className="rounded-[28px] bg-white p-6 shadow-[0_16px_45px_rgba(83,46,32,.08)] sm:p-9">
        <h2 className="font-display text-3xl text-[#241c18]">Envoyez-nous un message</h2>
        <form ref={formRef} onSubmit={submit} className="mt-7 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-[#4f4138]">Nom<input required name="name" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 font-normal outline-none focus:border-[#ec3b78]" /></label><label className="text-sm font-bold text-[#4f4138]">E-mail<input required type="email" name="email" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 font-normal outline-none focus:border-[#ec3b78]" /></label></div>
          <label className="block text-sm font-bold text-[#4f4138]">Sujet<input required name="subject" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 font-normal outline-none focus:border-[#ec3b78]" /></label>
          <label className="block text-sm font-bold text-[#4f4138]">Message<textarea required name="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="mt-2 w-full resize-y rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 font-normal outline-none focus:border-[#ec3b78]" /></label>
          {status === 'sent' && <p className="flex items-center gap-2 text-sm font-bold text-[#1a6b68]"><CheckCircle2 size={18} /> Votre message a bien été envoyé.</p>}
          {status === 'error' && <p className="text-sm font-bold text-[#b32d58]">L’envoi est momentanément indisponible. Écrivez-nous à contact@aras.sn.</p>}
          <button disabled={status === 'sending'} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ec3b78] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-60"><Send size={17} />{status === 'sending' ? 'Envoi en cours…' : 'Envoyer le message'}</button>
        </form>
      </section>
    </div>
  </main>;
}
