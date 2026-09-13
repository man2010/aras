import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Conditions générales d\'utilisation — ARAS',
  description: 'Consultez les conditions générales d\'utilisation de la plateforme ARAS, espace de rencontres sérieuses et respectueuses.',
};

const sections = [
  {
    id: 'objet',
    title: '1. Objet et acceptation',
    paragraphs: [
      'Les présentes Conditions Générales d\'Utilisation (ci-après « CGU ») régissent l\'accès et l\'utilisation de la plateforme ARAS, accessible via le site internet et les applications associées.',
      'En créant un compte ou en utilisant ARAS, vous reconnaissez avoir lu, compris et accepté l\'intégralité des présentes CGU. Si vous n\'acceptez pas ces conditions, vous ne devez pas utiliser le service.',
    ],
  },
  {
    id: 'editeur',
    title: '2. Éditeur du service',
    paragraphs: [
      'ARAS est une plateforme de rencontres en ligne destinée à favoriser des relations sincères, respectueuses et durables, dans un esprit inspiré par les valeurs de la Téranga.',
      'Pour toute question relative au service ou aux présentes CGU, vous pouvez nous contacter à l\'adresse : contact@aras.sn.',
    ],
  },
  {
    id: 'acces',
    title: '3. Accès au service et éligibilité',
    paragraphs: [
      'L\'utilisation d\'ARAS est réservée aux personnes âgées de 18 ans révolus. En vous inscrivant, vous certifiez sur l\'honneur remplir cette condition.',
      'ARAS se réserve le droit de refuser l\'accès au service, de suspendre ou de supprimer un compte en cas de non-respect des présentes CGU, sans préavis ni indemnité, dans les limites prévues par la loi applicable.',
    ],
  },
  {
    id: 'compte',
    title: '4. Création et gestion du compte',
    paragraphs: [
      'Pour accéder aux fonctionnalités d\'ARAS, vous devez créer un compte personnel en fournissant des informations exactes, complètes et à jour. Vous êtes seul responsable de la confidentialité de vos identifiants et de toute activité réalisée depuis votre compte.',
      'Vous vous engagez à informer ARAS sans délai en cas d\'utilisation non autorisée de votre compte. ARAS ne saurait être tenue responsable des conséquences d\'une négligence de votre part dans la protection de vos accès.',
      'Chaque utilisateur ne peut détenir qu\'un seul compte actif. Les comptes créés avec de fausses informations, au nom d\'un tiers ou dans un but frauduleux pourront être supprimés.',
    ],
  },
  {
    id: 'service',
    title: '5. Description du service',
    paragraphs: [
      'ARAS permet aux membres de créer un profil, de consulter d\'autres profils, d\'exprimer un intérêt, d\'échanger par messagerie lorsque l\'intérêt est réciproque, et de participer à des événements organisés par la plateforme.',
      'ARAS agit en qualité d\'intermédiaire technique de mise en relation. Elle ne garantit pas la conclusion d\'une relation, d\'une rencontre ou d\'un engagement entre membres.',
      'Certaines fonctionnalités peuvent être gratuites ou payantes. Les conditions tarifaires des offres Premium ou Elite sont présentées sur la page dédiée et peuvent évoluer.',
    ],
  },
  {
    id: 'conduite',
    title: '6. Règles de conduite',
    paragraphs: [
      'ARAS est un espace fondé sur le respect, la sincérité et la bienveillance. En utilisant la plateforme, vous vous engagez à adopter un comportement courtois envers les autres membres.',
    ],
    list: [
      'Ne pas créer de faux profil ni usurper l\'identité d\'une autre personne.',
      'Ne pas publier de contenus illicites, diffamatoires, haineux, discriminatoires, obscènes ou choquants.',
      'Ne pas harceler, menacer, intimider ou solliciter de manière insistante un autre membre.',
      'Ne pas demander d\'argent, de transferts ou de biens à d\'autres utilisateurs.',
      'Ne pas utiliser ARAS à des fins commerciales, publicitaires ou de prospection non autorisée.',
      'Ne pas tenter de contourner les mesures de sécurité ou d\'accéder aux données d\'autres membres.',
    ],
  },
  {
    id: 'moderation',
    title: '7. Modération et signalement',
    paragraphs: [
      'ARAS se réserve le droit de modérer les contenus, de suspendre ou de supprimer tout compte ne respectant pas les présentes CGU ou les valeurs de la communauté.',
      'Vous pouvez signaler un profil ou un comportement inapproprié depuis la plateforme ou en contactant contact@aras.sn. Notre équipe examine les signalements avec diligence, sans garantie de délai de traitement.',
    ],
  },
  {
    id: 'donnees',
    title: '8. Données personnelles',
    paragraphs: [
      'ARAS accorde une attention particulière à la protection de vos données personnelles. Les informations collectées lors de votre inscription et de votre utilisation du service sont traitées conformément à la réglementation applicable en matière de protection des données.',
      'Pour en savoir plus sur la collecte, l\'utilisation et vos droits relatifs à vos données, consultez notre politique de confidentialité ou contactez-nous à contact@aras.sn.',
    ],
  },
  {
    id: 'propriete',
    title: '9. Propriété intellectuelle',
    paragraphs: [
      'L\'ensemble des éléments composant ARAS (marque, logo, interface, textes, visuels, logiciels) est protégé par le droit de la propriété intellectuelle et reste la propriété exclusive d\'ARAS ou de ses partenaires.',
      'Toute reproduction, représentation ou exploitation non autorisée est strictement interdite. Les contenus que vous publiez sur votre profil restent votre propriété, mais vous accordez à ARAS une licence non exclusive permettant leur affichage dans le cadre du service.',
    ],
  },
  {
    id: 'responsabilite',
    title: '10. Responsabilité',
    paragraphs: [
      'ARAS met en œuvre des moyens raisonnables pour assurer la disponibilité et la sécurité du service, sans garantir un fonctionnement ininterrompu ou exempt d\'erreur.',
      'Les échanges entre membres relèvent de leur seule responsabilité. ARAS ne contrôle pas les comportements des utilisateurs en dehors de la plateforme et décline toute responsabilité en cas de litige entre membres, dans les limites autorisées par la loi.',
      'En cas de rencontre physique, nous vous encourageons à privilégier des lieux publics, à informer une personne de confiance et à faire preuve de prudence.',
    ],
  },
  {
    id: 'resiliation',
    title: '11. Résiliation',
    paragraphs: [
      'Vous pouvez supprimer votre compte à tout moment depuis les paramètres de votre espace personnel ou en nous contactant.',
      'ARAS peut suspendre ou résilier votre accès en cas de violation des CGU, de signalements répétés ou de comportement mettant en danger la communauté, sans préjudice des recours dont vous pourriez disposer.',
    ],
  },
  {
    id: 'modifications',
    title: '12. Modifications des CGU',
    paragraphs: [
      'ARAS se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés des changements significatifs par tout moyen approprié.',
      'La poursuite de l\'utilisation du service après entrée en vigueur des modifications vaut acceptation des nouvelles conditions.',
    ],
  },
  {
    id: 'droit',
    title: '13. Droit applicable et litiges',
    paragraphs: [
      'Les présentes CGU sont régies par le droit sénégalais, sous réserve des dispositions impératives applicables dans votre pays de résidence.',
      'En cas de différend, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents de Dakar seront saisis, sauf disposition légale contraire.',
    ],
  },
] as const;

export default function CguPage() {
  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[105px] lg:px-8 lg:pt-[130px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fbe8ec] text-[#ec3b78]">
            <FileText size={27} />
          </div>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[.22em] text-[#ec3b78]">Informations légales</p>
          <h1 className="font-display mt-4 text-4xl tracking-[-.045em] text-[#241c18] sm:text-6xl">
            Conditions générales <span className="italic text-[#1a6b68]">d&apos;utilisation</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[680px] text-[15px] leading-7 text-[#756960] sm:text-base">
            Les règles qui encadrent votre utilisation d&apos;ARAS. Nous avons rédigé ce document avec clarté et transparence, pour que chaque membre sache à quoi s&apos;engager.
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[.16em] text-[#9a8b82]">
            Dernière mise à jour : 14 septembre 2026
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-16">
          <aside className="lg:sticky lg:top-[100px] lg:self-start">
            <nav
              aria-label="Sommaire des conditions générales"
              className="rounded-2xl border border-[#eadfd5] bg-white p-5 shadow-[0_6px_22px_rgba(83,46,32,.05)]"
            >
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Sommaire</p>
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
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-[120px] rounded-2xl border border-[#eadfd5] bg-white p-6 shadow-[0_6px_22px_rgba(83,46,32,.05)] sm:p-8"
              >
                <h2 className="font-display text-2xl tracking-[-.03em] text-[#241c18] sm:text-3xl">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-[#756960] sm:text-[15px]">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {'list' in section && section.list && (
                    <ul className="grid gap-2 pl-1">
                      {section.list.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ec3b78]" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}

            <section className="rounded-2xl bg-[#241c18] p-6 text-white sm:p-8">
              <h2 className="font-display text-2xl tracking-[-.03em] sm:text-3xl">Une question sur ces conditions ?</h2>
              <p className="mt-3 max-w-[520px] text-sm leading-7 text-white/65 sm:text-[15px]">
                Notre équipe reste disponible pour vous éclairer sur l&apos;utilisation d&apos;ARAS et vos droits en tant que membre.
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
