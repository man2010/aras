import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const supportEmail = 'terangalovesn@gmail.com';

function createEmailTemplate(name: string, email: string, subject: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau message - ARAS</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f6f4;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ec3b78 0%, #c92e63 100%); padding: 30px; text-align: center;">
      <img src="https://aras.sn/aras-logo.jpeg" alt="ARAS Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px;" />
      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 2px;">ARAS</h1>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="margin: 0 0 20px 0; color: #241c18; font-size: 24px; font-weight: bold;">Nouveau message de contact</h2>
      
      <div style="background-color: #fdf9f4; border-left: 4px solid #ec3b78; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; color: #625852; font-size: 14px; font-weight: bold;">De :</p>
        <p style="margin: 0 0 20px 0; color: #241c18; font-size: 16px; font-weight: 600;">${name}</p>
        
        <p style="margin: 0 0 10px 0; color: #625852; font-size: 14px; font-weight: bold;">Email :</p>
        <p style="margin: 0 0 20px 0; color: #241c18; font-size: 16px;">${email}</p>
        
        <p style="margin: 0 0 10px 0; color: #625852; font-size: 14px; font-weight: bold;">Sujet :</p>
        <p style="margin: 0 0 20px 0; color: #241c18; font-size: 16px; font-weight: 600;">${subject}</p>
      </div>

      <div style="background-color: #f8f6f4; padding: 25px; border-radius: 8px; border: 1px solid #dfd2c6;">
        <p style="margin: 0 0 15px 0; color: #625852; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Message :</p>
        <p style="margin: 0; color: #241c18; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #241c18; padding: 25px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px; font-weight: bold;">ARAS</p>
      <p style="margin: 0; color: #d8d5d2; font-size: 12px;">© 2026 ARAS. Tous droits réservés.</p>
      <div style="margin-top: 15px;">
        <a href="https://aras.sn" style="color: #ec3b78; text-decoration: none; font-size: 14px; font-weight: 600;">Visiter notre site</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  if (!name || !email || !subject || !message || message.length > 5000) {
    return NextResponse.json({ error: 'Informations invalides.' }, { status: 400 });
  }

  // Vérification des variables d'environnement
  console.log('GMAIL_EMAIL:', process.env.GMAIL_EMAIL ? 'Configuré' : 'Non configuré');
  console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Configuré' : 'Non configuré');

  if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
    console.error('Variables d\'environnement Gmail manquantes');
    return NextResponse.json({ error: 'Configuration email manquante.' }, { status: 503 });
  }

  // Configuration nodemailer avec Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const htmlContent = createEmailTemplate(name, email, subject, message);

  try {
    console.log('Tentative d\'envoi d\'email...');
    await transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to: supportEmail,
      replyTo: email,
      subject: `[ARAS] ${subject}`,
      html: htmlContent,
      text: `Message de ${name} (${email})\n\nSujet: ${subject}\n\n${message}`
    });
    console.log('Email envoyé avec succès');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erreur d\'envoi email:', error);
    return NextResponse.json({ error: 'Échec de l\'envoi.' }, { status: 502 });
  }
}
