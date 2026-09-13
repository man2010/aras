'use client';

import { HelpCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const questions = [
  ['Comment créer un compte ?', "Téléchargez l'application ARAS sur Google Play ou l'App Store, puis inscrivez-vous avec votre numéro de téléphone ou votre adresse e-mail. Renseignez les informations demandées et validez votre compte à l'aide du code reçu par SMS ou par e-mail."],
  ['Comment fonctionne ARAS ?', "ARAS permet aux célibataires de créer leur profil, de définir leurs préférences, de découvrir des personnes qui pourraient leur correspondre et d'échanger avec elles. L'objectif est de favoriser des rencontres sérieuses et durables, avec le mariage comme projet pour ceux qui le souhaitent."],
  ['Comment fonctionne le système de match ?', "ARAS vous permet de découvrir des célibataires qui correspondent à vos préférences et à vos affinités. Lorsque l'intérêt est réciproque, vous pouvez échanger et prendre le temps de vous découvrir."],
  ["Comment participer à un événement ARAS ?", "Lorsqu'un événement est disponible, rendez-vous dans la rubrique « Événements », consultez les informations puis inscrivez-vous directement depuis l'application."],
  ['Comment fonctionnent les rencontres lors des événements ?', "Les événements ARAS sont conçus pour permettre aux célibataires de se rencontrer dans un cadre convivial. Selon le format de l'événement, ARAS peut vous mettre en relation avec une personne correspondant à vos préférences et à vos affinités."],
  ['ARAS est-elle une application gratuite ?', "Oui. ARAS est gratuite à télécharger. Certaines fonctionnalités supplémentaires pourront être proposées dans une offre Premium."],
  ['Mes données personnelles sont-elles sécurisées ?', "Nous accordons une attention particulière à la protection de vos données et mettons en place des mesures destinées à préserver leur confidentialité et leur sécurité."],
  ['Comment signaler ou bloquer un utilisateur ?', "Depuis votre conversation, appuyez sur « Bloquer » ou « Signaler ». Pour un signalement, choisissez le motif correspondant puis validez votre demande. Notre équipe de modération examinera votre signalement."],
  ['Que faire si mon compte a été suspendu ?', "Votre compte peut être suspendu en cas de non-respect des Conditions d'utilisation, notamment en cas de faux profil, de harcèlement, de contenus inappropriés ou de comportements frauduleux. Si vous pensez qu'il s'agit d'une erreur, contactez notre support."],
  ['Comment contacter le support ARAS ?', "Vous pouvez nous contacter à tout moment à l'adresse contact@aras.sn ou via la rubrique « Nous contacter » dans l'application. Notre équipe répond généralement sous 24 à 48 heures ouvrées, selon le volume des demandes."],
] as const;

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[105px] lg:px-8 lg:pt-[130px]">
      <div className="mx-auto max-w-[900px]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fbe8ec] text-[#ec3b78]"><HelpCircle size={27} /></div>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[.22em] text-[#ec3b78]">ARAS vous accompagne</p>
          <h1 className="font-display mt-4 text-4xl tracking-[-.045em] text-[#241c18] sm:text-6xl">Questions <span className="italic text-[#1a6b68]">fréquentes</span></h1>
          <p className="mx-auto mt-5 max-w-[650px] text-[15px] leading-7 text-[#756960] sm:text-base">Les réponses aux questions que vous vous posez. Retrouvez ici les informations essentielles sur votre compte, les échanges, les événements et le fonctionnement d’ARAS.</p>
        </div>
        <section className="mt-12 space-y-3" aria-label="Questions fréquentes">
          {questions.map(([question, answer], index) => {
            const isOpen = open === index;
            return <article key={question} className="overflow-hidden rounded-2xl border border-[#eadfd5] bg-white shadow-[0_6px_22px_rgba(83,46,32,.05)]">
              <button onClick={() => setOpen(isOpen ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-7" aria-expanded={isOpen}>
                <span className="font-display text-lg text-[#241c18] sm:text-xl">{question}</span>
                <ChevronDown className={`shrink-0 text-[#ec3b78] transition-transform ${isOpen ? 'rotate-180' : ''}`} size={21} />
              </button>
              {isOpen && <p className="border-t border-[#f1e6da] px-5 py-5 text-sm leading-7 text-[#756960] sm:px-7 sm:text-[15px]">{answer}</p>}
            </article>;
          })}
        </section>
      </div>
    </main>
  );
}
