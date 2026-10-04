'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Crown, ShieldCheck } from 'lucide-react';

const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3 text-base font-normal text-[#241c18] outline-none transition focus:border-[#c88a27] focus:ring-2 focus:ring-[#c88a27]/20';
const labelClass = 'block text-sm font-semibold text-[#625852]';

export default function GoldenPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const response = await fetch('/api/golden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || 'Impossible de préparer le paiement.');
      window.location.assign(result.checkoutUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Une erreur est survenue. Réessayez.');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f7] px-4 pb-16 pt-24 transition-colors dark:bg-[#101014] sm:px-6 sm:pt-28">
      <div className="mx-auto max-w-[860px] overflow-hidden rounded-[28px] border border-[#e7e2db] bg-white shadow-[0_18px_55px_rgba(61,45,28,.08)]">
        <header className="border-b border-[#dfc48e] bg-gradient-to-br from-[#fcf2e5] to-[#f5e0c6] px-6 py-10 text-center sm:px-10 sm:py-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#c88a27]/15 text-[#b57a21]"><Crown size={27} /></div>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[.2em] text-[#b57a21]">Je ne souhaite pas m'inscrire sur le site</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.035em] text-[#24171b] sm:text-4xl">Devenez membre <span className="text-[#c88a27]">Golden</span></h1>
          <p className="mx-auto mt-3 max-w-[620px] text-sm leading-6 text-[#756960] sm:text-base">Remplissez ce formulaire confidentiel. Notre équipe vous accompagne et organise des événements privés, en toute discrétion.</p>
        </header>

        <form onSubmit={submit} className="space-y-7 px-5 py-7 sm:px-10 sm:py-10">
          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#625852]">Vos informations</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Prénom ou pseudo<input name="name" required maxLength={80} autoComplete="name" className={fieldClass} /></label>
              <label className={labelClass}>Genre<select name="gender" required defaultValue="Femme" className={fieldClass}><option>Femme</option><option>Homme</option></select></label>
              <label className={labelClass}>Date de naissance<input name="birthdate" required type="date" max={new Date().toISOString().slice(0, 10)} className={fieldClass} /></label>
              <label className={labelClass}>Ville / Pays<input name="location" required maxLength={120} placeholder="Dakar, Sénégal" className={fieldClass} /></label>
              <label className={labelClass}>Situation matrimoniale<select name="maritalStatus" required defaultValue="Célibataire" className={fieldClass}><option>Célibataire</option><option>Divorcé(e)</option><option>Veuf(ve)</option></select></label>
              <label className={labelClass}>Religion (facultatif)<input name="religion" maxLength={80} className={fieldClass} /></label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#625852]">Ce que vous recherchez</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Tranche d'âge souhaitée<input name="ageRange" required maxLength={60} placeholder="28 - 38 ans" className={fieldClass} /></label>
              <label className={labelClass}>Ville / distance<input name="preferredLocation" required maxLength={120} placeholder="Dakar et environs" className={fieldClass} /></label>
              <label className={`${labelClass} sm:col-span-2`}>Décrivez la personne ou la relation recherchée<textarea name="expectations" required maxLength={2000} rows={4} placeholder="Vos attentes, vos valeurs, le type de relation souhaitée..." className={`${fieldClass} resize-y`} /></label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#625852]">Comment vous contacter</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1.2fr_.8fr]">
              <label className={labelClass}>E-mail ou téléphone<input name="contact" required maxLength={160} autoComplete="email" className={fieldClass} /></label>
              <label className={labelClass}>Moyen préféré<select name="preferredContact" required defaultValue="SMS" className={fieldClass}><option>SMS</option><option>Appel</option><option>WhatsApp</option><option>E-mail</option></select></label>
            </div>
          </section>

          <div className="flex flex-col gap-3 rounded-2xl border border-[#e2c98f] bg-gradient-to-r from-[#fcf2e5] to-[#f5e0c6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-bold text-[#24171b]">Adhésion membre Golden</p><p className="mt-1 text-sm text-[#756960]">Accès aux événements privés organisés par ARAS</p></div>
            <p className="whitespace-nowrap font-display text-2xl font-bold text-[#c88a27] sm:text-3xl">30 000 FCFA</p>
          </div>

          <div className="space-y-3 text-sm leading-5 text-[#625852]">
            <label className="flex cursor-pointer items-start gap-3"><input name="privacyConsent" required type="checkbox" value="yes" className="mt-1 h-5 w-5 shrink-0 accent-[#c88a27]" /><span>J'accepte que mes données soient traitées confidentiellement par ARAS pour cette demande, conformément à la <Link href="/politique-confidentialite" className="font-bold text-[#a87320] underline">Politique de Confidentialité</Link>.</span></label>
            <label className="flex cursor-pointer items-start gap-3"><input name="paymentConsent" required type="checkbox" value="yes" className="mt-1 h-5 w-5 shrink-0 accent-[#c88a27]" /><span>Je comprends que le paiement s'effectue à l'envoi du formulaire et qu'il n'est pas remboursable.</span></label>
          </div>

          {error && <p role="alert" className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-semibold text-[#a52b42]">{error}</p>}
          <button type="submit" disabled={submitting} className="min-h-14 w-full rounded-full bg-[#c88a27] px-5 py-4 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(200,138,39,.25)] transition hover:bg-[#b57a21] disabled:cursor-wait disabled:opacity-60">{submitting ? 'Préparation du paiement…' : 'Payer 30 000 FCFA et envoyer ma demande'}</button>
          <p className="flex items-center justify-center gap-2 text-center text-xs text-[#9a8b82]"><ShieldCheck size={15} /> Paiement sécurisé · Wave</p>
          <p className="sr-only" aria-live="polite">{submitting ? 'Préparation du paiement Wave.' : ''}</p>
        </form>
      </div>
    </main>
  );
}
