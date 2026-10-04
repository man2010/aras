import { NextResponse } from 'next/server';

const ALLOWED_CONTACT_METHODS = new Set(['SMS', 'Appel', 'WhatsApp', 'E-mail']);

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const fields = ['name', 'gender', 'birthdate', 'location', 'maritalStatus', 'religion', 'ageRange', 'preferredLocation', 'expectations', 'contact', 'preferredContact'] as const;
    const values = Object.fromEntries(fields.map((field) => [field, String(body[field] ?? '').trim()]));

    if (fields.some((field) => field !== 'religion' && !values[field])
      || !body.privacyConsent || !body.paymentConsent
      || !['Femme', 'Homme'].includes(values.gender)
      || !ALLOWED_CONTACT_METHODS.has(values.preferredContact)
      || values.expectations.length > 2000
      || values.contact.length > 160) {
      return NextResponse.json({ error: 'Vérifiez les champs obligatoires et les deux consentements.' }, { status: 400 });
    }

    const waveUrl = process.env.WAVE_GOLDEN_PAYMENT_URL;
    if (!waveUrl) {
      return NextResponse.json({ error: 'Le paiement Wave Golden n’est pas encore configuré. Contactez ARAS pour finaliser votre demande.' }, { status: 503 });
    }
    const parsedWaveUrl = new URL(waveUrl);
    if (parsedWaveUrl.protocol !== 'https:' || parsedWaveUrl.hostname !== 'pay.wave.com') {
      return NextResponse.json({ error: 'Le lien de paiement Wave configuré est invalide.' }, { status: 503 });
    }

    if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({ error: 'Le traitement des demandes Golden est momentanément indisponible.' }, { status: 503 });
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_APP_PASSWORD },
    });
    const message = [
      'Nouvelle demande membre Golden (paiement à vérifier manuellement)',
      `Prénom ou pseudo : ${values.name}`,
      `Genre : ${values.gender}`,
      `Date de naissance : ${values.birthdate}`,
      `Ville / Pays : ${values.location}`,
      `Situation matrimoniale : ${values.maritalStatus}`,
      `Religion : ${values.religion || 'Non renseignée'}`,
      `Tranche d'âge souhaitée : ${values.ageRange}`,
      `Ville / distance recherchée : ${values.preferredLocation}`,
      `Attentes : ${values.expectations}`,
      `Contact : ${values.contact}`,
      `Moyen préféré : ${values.preferredContact}`,
      'Consentement confidentialité : accepté',
      'Consentement paiement non remboursable : accepté',
    ].join('\n');

    await transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to: 'terangalovesn@gmail.com',
      subject: '[ARAS] Demande membre Golden',
      text: message,
    });

    return NextResponse.json({ checkoutUrl: parsedWaveUrl.toString() });
  } catch {
    return NextResponse.json({ error: 'Impossible de préparer votre demande. Réessayez plus tard.' }, { status: 500 });
  }
}
