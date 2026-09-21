import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Database, BellRing, LockKeyhole, Mail, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — ARAS',
  description: 'Politique de confidentialité détaillée d’ARAS, conforme aux exigences de Google et au RGPD.',
};

const sections = [
  {
    id: 'objet',
    title: '1. Objet et champ d’application',
    icon: ShieldCheck,
    paragraphs: [
      'Cette politique de confidentialité explique comment ARAS collecte, utilise, stocke, protège et partage les données personnelles des utilisateurs de notre plateforme.',
      'Elle s’applique à tous les utilisateurs qui créent un compte, naviguent sur le site, utilisent les fonctionnalités de rencontre, participent à des événements ou interagissent avec les services proposés par ARAS.',
    ],
  },
  {
    id: 'donnees-collectees',
    title: '2. Données collectées',
    icon: Database,
    paragraphs: [
      'Nous collectons les informations que vous fournissez directement lorsque vous créez un compte ou complétez votre profil, notamment : nom ou pseudonyme, adresse e-mail, numéro de téléphone, date de naissance, ville, photo de profil, centre d’intérêts, bio, préférences et informations de compte.',
      'Nous collectons aussi des données techniques et d’usage, comme l’adresse IP, le type de navigateur, les pages consultées, les interactions sur la plateforme, les logs d’authentification, les données de connexion et les informations issues de nos outils d’analyse et de sécurité.',
      'Si vous utilisez la connexion Google, nous pouvons recevoir les informations de votre compte Google nécessaires à l’authentification et au bon fonctionnement du service, conformément à votre consentement et aux paramètres de votre compte Google.',
    ],
  },
  {
    id: 'usage',
    title: '3. Utilisation des données',
    icon: BellRing,
    paragraphs: [
      'Les données sont utilisées pour créer et gérer votre compte, sécuriser l’accès à la plateforme, personnaliser votre expérience, faciliter les matches et les échanges, améliorer la qualité du service, détecter les abus et les comportements frauduleux, et répondre à nos obligations légales et contractuelles.',
      'Nous utilisons aussi vos données pour vous envoyer des notifications liées à votre compte, aux messages, aux likes, aux matches, aux événements et aux services que vous avez activés dans les paramètres.',
      'Les données peuvent être traitées à des fins de prévention des fraudes, de sécurité, de modération, d’analyse de performance et d’amélioration continue de la plateforme.',
    ],
  },
  {
    id: 'partage',
    title: '4. Partage des données',
    icon: LockKeyhole,
    paragraphs: [
      'ARAS ne vend pas vos données personnelles à des tiers. Nous pouvons partager certaines informations uniquement dans les cas suivants : avec les prestataires techniques nécessaires au fonctionnement du service (hébergement, authentification, messagerie, analytics, support client), avec les autorités compétentes lorsqu’une obligation légale l’exige, et dans le cadre d’une opération de sécurité ou de protection de nos utilisateurs.',
      'Les informations visibles publiquement sur votre profil sont celles que vous avez choisies d’afficher dans les paramètres de confidentialité. Les contenus privés (messages, échanges) ne sont accessibles qu’aux personnes autorisées par l’application.',
    ],
  },
  {
    id: 'droits',
    title: '5. Vos droits',
    icon: FileText,
    paragraphs: [
      'Conformément à la réglementation applicable, vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation du traitement, d’opposition et de portabilité de vos données personnelles. Vous pouvez également retirer votre consentement à certains traitements lorsque celui-ci a été donné.',
      'Vous pouvez modifier vos préférences de confidentialité depuis votre espace personnel. Si vous souhaitez exercer vos droits, vous pouvez nous contacter à l’adresse contact@aras.sn.',
      'Nous traiterons votre demande dans les délais prévus par la loi et vous informerons des suites données à votre demande.',
    ],
  },
  {
    id: 'securite',
    title: '6. Sécurité et conservation',
    icon: ShieldCheck,
    paragraphs: [
      'ARAS met en œuvre des mesures techniques et organisationnelles raisonnables pour protéger vos données contre la perte, l’accès non autorisé, la modification ou la divulgation non conforme.',
      'Les données sont conservées pendant la durée nécessaire à la gestion de votre compte, au respect de nos obligations légales et à la prévention des abus. Certaines données peuvent être conservées plus longtemps si nécessaires pour des obligations légales, comptables ou de sécurité.',
    ],
  },
  {
    id: 'cookies',
    title: '7. Cookies et technologies similaires',
    icon: Database,
    paragraphs: [
      'Nous utilisons des cookies et technologies similaires pour assurer le bon fonctionnement du site, mémoriser vos préférences, sécuriser votre session et améliorer votre expérience. Certains cookies sont strictement nécessaires au service, tandis que d’autres peuvent être utilisés à des fins d’analyse ou de personnalisation.',
      'Vous pouvez gérer vos préférences de cookies dans votre navigateur ou via les outils de configuration de la plateforme lorsque cela est proposé.',
    ],
  },
  {
    id: 'contact',
    title: '8. Contact',
    icon: Mail,
    paragraphs: [
      'Pour toute question relative à cette politique de confidentialité, à l’utilisation de vos données ou à l’exercice de vos droits, vous pouvez nous contacter à l’adresse : contact@aras.sn.',
      'Nous nous engageons à répondre avec diligence et à traiter vos demandes de manière transparente, conforme aux exigences de sécurité, de confidentialité et de conformité applicables.',
    ],
  },
] as const;

export default function PolitiqueConfidentialitePage() {
  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[105px] lg:px-8 lg:pt-[130px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf7f6] text-[#1a6b68]">
            <ShieldCheck size={27} />
          </div>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[.22em] text-[#1a6b68]">Protection des données</p>
          <h1 className="font-display mt-4 text-4xl tracking-[-.045em] text-[#241c18] sm:text-6xl">
            Politique de <span className="italic text-[#ec3b78]">confidentialité</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[760px] text-[15px] leading-7 text-[#756960] sm:text-base">
            Cette politique décrit la manière dont ARAS collecte, traite, protège et partage les données de ses utilisateurs, conformément aux principes de transparence, de sécurité et de respect de la vie privée.
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[.16em] text-[#9a8b82]">
            Dernière mise à jour : 21 septembre 2026
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-16">
          <aside className="lg:sticky lg:top-[100px] lg:self-start">
            <nav
              aria-label="Sommaire de la politique de confidentialité"
              className="rounded-2xl border border-[#eadfd5] bg-white p-5 shadow-[0_6px_22px_rgba(83,46,32,.05)]"
            >
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#1a6b68]">Sommaire</p>
              <ol className="mt-4 space-y-2 text-sm">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block rounded-lg px-2 py-1.5 text-[#756960] transition hover:bg-[#f3e9dc] hover:text-[#241c18]"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="space-y-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-[120px] rounded-2xl border border-[#eadfd5] bg-white p-6 shadow-[0_6px_22px_rgba(83,46,32,.05)] sm:p-8"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e9dc] text-[#ec3b78]">
                      <Icon size={18} />
                    </div>
                    <h2 className="font-display text-2xl tracking-[-.03em] text-[#241c18] sm:text-3xl">
                      {section.title}
                    </h2>
                  </div>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-[#756960] sm:text-[15px]">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              );
            })}

            <section className="rounded-2xl bg-[#241c18] p-6 text-white sm:p-8">
              <h2 className="font-display text-2xl tracking-[-.03em] sm:text-3xl">Des questions ?</h2>
              <p className="mt-3 max-w-[520px] text-sm leading-7 text-white/70 sm:text-[15px]">
                Nous sommes à votre disposition pour vous aider à mieux comprendre la manière dont vos données sont utilisées et protégées.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]"
                >
                  Nous contacter
                </Link>
                <a
                  href="mailto:contact@aras.sn"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-extrabold text-white transition hover:border-white/40"
                >
                  <Mail size={16} /> contact@aras.sn
                </a>
              </div>
            </section>
          </article>
        </div>
      </div>
    </main>
  );
}
