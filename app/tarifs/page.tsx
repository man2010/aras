'use client';

import Link from 'next/link';
import { Check, Crown, Sparkles, Heart, ShieldCheck } from 'lucide-react';

export default function TarifsPage() {
  const plans = [
    {
      name: 'Gratuit',
      price: '0',
      period: 'FCFA',
      icon: Heart,
      bg: '#fbf8f2',
      accent: '#1a6b68',
      cta: 'Commencer',
      href: '/inscription',
      features: [
        'Création du profil',
        'Découverte des profils',
        'Nombre illimité de likes',
        'Participation aux événements (accès standard)',
        '3 conversations par semaine',
        'Badge profil vérifié',
        'Support 24h/7',
      ],
    },
    {
      name: 'Premium',
      price: '4 500',
      period: 'FCFA / mois',
      icon: Sparkles,
      bg: '#ec3b78',
      accent: '#fff',
      cta: 'Passer Premium',
      href: '/inscription',
      featured: true,
      features: [
        'Création du profil',
        'Découverte des profils',
        'Nombre illimité de likes',
        'Participation aux événements (accès standard)',
        '3 conversations par semaine',
        'Badge profil vérifié',
        'Nombre illimité de messages',
        'Voir les visites de votre profil',
        'Voir qui vous a liké',
        'Voir qui est connecté',
        'Meilleure classification dans les résultats',
        'Filtres standards',
        'Chat avec SARA, votre coach relationnel',
        'Support prioritaire 24h/7',
      ],
    },
    {
      name: 'Elite',
      price: '30 000',
      period: 'FCFA',
      icon: Crown,
      bg: '#241c18',
      accent: '#f4c27a',
      cta: 'Rejoindre l\'Elite',
      href: '/inscription',
      features: [
        'Création du profil',
        'Découverte des profils',
        'Nombre illimité de likes',
        'Accès prioritaire aux événements VIP',
        '3 conversations par semaine',
        'Badge profil vérifié',
        'Badge membre Elite',
        'Nombre illimité de messages',
        'Voir les visites de votre profil',
        'Voir qui vous a liké',
        'Voir qui est connecté',
        'Meilleure classification dans les résultats',
        'Filtres avancés',
        'Chat avec SARA, votre coach relationnel',
        'Support prioritaire 24h/7',
        'Masquage total de votre photo de profil',
        'Mode incognito (seuls vos matchs voient votre profil)',
        'Demande de mise en relation gratuite',
      ],
    },
  ];

  const faqs = [
    { q: 'La formule gratuite suffit-elle pour commencer ?', r: 'Oui, la formule gratuite permet déjà de créer votre profil, découvrir les profils et tester la plateforme avec les bases essentielles.' },
    { q: 'Le Premium est-il gratuit pour les femmes ?', r: 'Oui, la formule Premium est à 4 500 FCFA par mois et gratuite pour les femmes.' },
    { q: 'Qu\'est-ce que la formule Elite ?', r: 'La formule Elite donne accès aux avantages les plus complets, dont les événements VIP, l’incognito et le support prioritaire.' },
    { q: 'Mes données sont-elles protégées ?', r: 'Absolument. Vos informations personnelles restent confidentielles et ne sont jamais partagées sans votre accord.' },
  ];

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Choisissez votre formule</p>
          <h1 className="font-display mt-4 text-5xl tracking-[-.045em] sm:text-6xl">Des formules <span className="italic text-[#1a6b68]">simples</span></h1>
          <p className="mx-auto mt-4 max-w-[480px] text-sm leading-6 text-[#756960]">Commencez gratuitement. Passez à Premium ou Elite quand vous voulez aller plus loin. Sans engagement.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-[28px] p-8 ${plan.featured ? 'text-white shadow-[0_20px_50px_rgba(233,81,95,.25)] lg:-translate-y-4' : plan.name === 'Elite' ? 'text-white shadow-[0_20px_50px_rgba(36,28,24,.25)] lg:-translate-y-4' : 'text-[#241c18] shadow-[0_10px_30px_rgba(83,46,32,.06)]'}`} style={{ background: plan.bg }}>
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
              <Link href={plan.href} className={`mt-8 block rounded-full py-3.5 text-center text-sm font-extrabold transition hover:-translate-y-0.5 ${plan.featured ? 'bg-white text-[#ec3b78]' : plan.name === 'Elite' ? 'bg-[#f4c27a] text-[#241c18] hover:bg-[#e5b86a]' : 'bg-[#1a6b68] text-white hover:bg-[#125552]'}`}>{plan.cta}</Link>
            </div>
          ))}
        </div>

        <section className="mt-20 rounded-[28px] bg-[#f3e9dc] px-6 py-10 lg:px-10 lg:py-14">
          <div className="mx-auto grid max-w-[1080px] gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:gap-16">
            <div className="text-center lg:text-left">
              <p className="text-[11px] font-extrabold uppercase tracking-[.28em] text-[#c88a27]">Je ne souhaite pas m'inscrire sur le site</p>
              <h2 className="mt-4 font-display text-[34px] leading-tight tracking-[-.04em] sm:text-[44px]">
                Devenez membre <span className="text-[#c88a27]">Golden</span>
              </h2>
              <p className="mx-auto mt-4 max-w-[720px] text-[15px] leading-7 text-[#756960] lg:mx-0">
                Vous cherchez l'amour mais préférez rester discret ? Remplissez un formulaire confidentiel : notre équipe recherche pour vous et vous recontacte en privé, sans profil visible ni photo en ligne.
              </p>
              <p className="mx-auto mt-4 max-w-[720px] text-[14px] leading-7 text-[#9a8b82] lg:mx-0">
                À cette étape, le membre Golden remplit un formulaire et paie 50 000 FCFA pour que la demande soit soumise à l'administrateur.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {[
                { title: 'Sans inscription', text: 'Aucun profil public, aucune photo en ligne. Votre présence reste totalement privée.' },
                { title: 'Accompagnement humain', text: 'Nos experts étudient votre demande et recherchent manuellement un profil qui vous correspond.' },
                { title: 'Contact en privé', text: 'Nous vous recontactons par le moyen de votre choix : SMS, appel ou e-mail.' },
                { title: 'Suivi et accompagnement', text: 'Nous vous accompagnons jusqu’au mariage.' },
              ].map((item, index) => (
                <div key={item.title} className="rounded-[22px] bg-[#fbf8f2] p-5 shadow-[0_10px_24px_rgba(83,46,32,.05)] transition duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 120}ms` }}>
                  <h3 className="font-display text-[20px] text-[#c88a27]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#756960]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Link href="/inscription" className="rounded-full bg-[#c88a27] px-8 py-3 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(200,138,39,.25)] transition hover:-translate-y-0.5 hover:bg-[#b57a21]">
              Devenir membre Golden
            </Link>
          </div>
          <p className="mt-4 text-center text-xs text-[#9a8b82]">Vos informations sont traitées confidentiellement par notre support.</p>
        </section>

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
