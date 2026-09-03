'use client';

import Link from 'next/link';
import { Check, Crown, Sparkles, Heart, ShieldCheck } from 'lucide-react';

export default function TarifsPage() {
  const plans = [
    { name: 'Découverte', price: 'Gratuit', period: '', icon: Heart, bg: '#fbf8f2', accent: '#1a6b68', cta: 'Commencer', href: '/inscription', features: ['Création du profil', 'Voir tous les profils', '1 like par jour', 'Participation aux événements', 'Profil visible par la communauté'] },
    { name: 'Premium', price: '5 000', period: 'FCFA / mois', icon: Sparkles, bg: '#e9515f', accent: '#fff', cta: 'Passer Premium', href: '/inscription', featured: true, features: ['Likes illimités', 'Voir qui vous a liké', 'Messagerie illimitée', 'Filtres avancés (ville, âge, intérêts)', 'Priorité d\'inscription aux événements', 'Badge "Membre actif"'] },
    { name: 'Élite', price: '15 000', period: 'FCFA / mois', icon: Crown, bg: '#241c18', accent: '#f4c27a', cta: 'Rejoindre l\'Élite', href: '/inscription', features: ['Toutes les fonctionnalités Premium', 'Conciergerie personnelle', 'Accès aux événements privés', 'Profil mis en avant en haut des résultats', 'Coaching rencontre (1 session/mois)', 'Vérification prioritaire du profil'] },
  ];

  const faqs = [
    { q: 'Puis-je essayer gratuitement ?', r: 'Oui, la formule Découverte est gratuite à vie. Vous pouvez créer un profil et explorer la communauté sans aucun engagement.' },
    { q: 'Comment fonctionne le paiement Premium ?', r: 'Le paiement se fait mensuellement par carte ou mobile money. Vous pouvez annuler à tout moment depuis votre espace.' },
    { q: 'Qu\'est-ce que la conciergerie Élite ?', r: 'Un accompagnement personnalisé par notre équipe : sélection de profils compatibles, conseils de conversation et accès à des événements privés.' },
    { q: 'Mes données sont-elles protégées ?', r: 'Absolument. Vos informations personnelles restent confidentielles et ne sont jamais partagées sans votre accord.' },
  ];

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Choisissez votre formule</p>
          <h1 className="font-display mt-4 text-5xl tracking-[-.045em] sm:text-6xl">Des formules <span className="italic text-[#1a6b68]">simples</span></h1>
          <p className="mx-auto mt-4 max-w-[480px] text-sm leading-6 text-[#756960]">Commencez gratuitement. Passez à Premium ou Élite quand vous voulez aller plus loin. Sans engagement.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-[28px] p-8 ${plan.featured ? 'text-white shadow-[0_20px_50px_rgba(233,81,95,.25)] lg:-translate-y-4' : 'shadow-[0_10px_30px_rgba(83,46,32,.06)]'}`} style={{ background: plan.bg }}>
              {plan.featured && <span className="mb-4 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider">Le plus choisi</span>}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: plan.featured ? 'rgba(255,255,255,.2)' : `${plan.accent}15`, color: plan.accent }}>
                <plan.icon size={22} fill={plan.icon === Heart ? 'currentColor' : 'none'} />
              </div>
              <h3 className="mt-6 font-display text-2xl">{plan.name}</h3>
              <p className="mt-3"><span className="font-display text-4xl font-semibold">{plan.price}</span><span className="ml-2 text-sm opacity-60">{plan.period}</span></p>
              <ul className="mt-7 space-y-3.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0" style={{ color: plan.accent }} /> {f}</li>
                ))}
              </ul>
              <Link href={plan.href} className={`mt-8 block rounded-full py-3.5 text-center text-sm font-extrabold transition hover:-translate-y-0.5 ${plan.featured ? 'bg-white text-[#e9515f]' : 'bg-[#1a6b68] text-white hover:bg-[#125552]'}`}>{plan.cta}</Link>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-[28px] bg-[#f3e9dc] p-8 text-center lg:p-12">
          <ShieldCheck size={28} className="mx-auto text-[#1a6b68]" />
          <h2 className="mt-4 font-display text-3xl">Pourquoi passer à Premium ?</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { title: 'Plus de chances', text: 'Des likes illimités pour multiplier vos opportunités de match.' },
              { title: 'Plus de contrôle', text: 'Filtrez par ville, âge et intérêts pour trouver les profils les plus compatibles.' },
              { title: 'Plus d\'exclusivité', text: 'Accédez en priorité aux événements et faites-vous connaître plus vite.' },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-xl text-[#1a6b68]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#756960]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20">
          <h2 className="text-center font-display text-4xl tracking-[-.04em]">Questions <span className="italic text-[#1a6b68]">fréquentes</span></h2>
          <div className="mx-auto mt-10 max-w-[760px] space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-2xl bg-white p-6 shadow-[0_6px_20px_rgba(83,46,32,.04)]">
                <p className="font-display text-lg">{f.q}</p>
                <p className="mt-2 text-sm leading-6 text-[#756960]">{f.r}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
