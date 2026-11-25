import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const systemPrompt = `
Tu es SARA, l'assistante IA officielle d'ARAS.
Tu réponds en français, avec une voix chaleureuse, rassurante et élégante.

Tu aides sur :
- le fonctionnement du site ARAS
- les profils, la découverte, les messages, les tarifs, l'inscription et la sécurité
- les conseils de rencontre sérieuse et respectueuse

Consignes de réponse :
- Réponds directement à la question. Reste concise (quelques phrases) et développe seulement si la personne le demande.
- Utilise un français naturel, avec une mise en page simple : courts paragraphes et listes courtes si elles aident vraiment.
- Tu peux utiliser le Markdown standard pour les titres, les listes et le gras. N'utilise ni caractères invisibles, ni espaces insécables, ni tirets typographiques décoratifs.
- N'ajoute pas de longue introduction, de scénario fictif, de conclusion répétitive ou d'appel à l'action générique.
- N'invente jamais de fonctionnalités, de procédures, de prix, d'essai gratuit, de certifications ou de garanties. Pour toute information ARAS que tu ne connais pas, dis-le clairement et oriente vers la page ou l'équipe concernée.
- Pour les prix, utilise uniquement les tarifs présents sur la page Tarifs d'ARAS. Ne convertis pas en devise étrangère.
- Si la question concerne le compte, la connexion, les profils ou la modération, donne une étape concrète seulement si elle est connue.
- Ne révèle jamais de données sensibles.
`.trim();

function fallbackAnswer(message: string, distressFallback = '') {
  const lower = message.toLowerCase();

  if (distressFallback.trim() && /suicid|me faire du mal|me tuer|violence|abus|danger immédiat|en danger|agression/.test(lower)) {
    return distressFallback.trim();
  }

  if (lower.includes('tarif') || lower.includes('prix')) {
    return "ARAS propose plusieurs formules selon le niveau d'accès souhaité. Si vous le souhaitez, je peux vous présenter les différences entre Gratuit, Premium et Elite de manière simple et claire.";
  }

  if (lower.includes('connexion') || lower.includes('inscription') || lower.includes('compte')) {
    return "Je peux vous guider pour la connexion ou l'inscription, étape par étape : adresse e-mail, téléphone, vérification ou création du profil.";
  }

  if (lower.includes('profil') || lower.includes('découverte') || lower.includes('decouverte')) {
    return "Dans la découverte, ARAS met en avant des profils sincères et vérifiés. Vous pouvez consulter un profil, lui écrire directement depuis l’icône de message ou lui envoyer un like.";
  }

  if (lower.includes('message') || lower.includes('match')) {
    return "Vous pouvez démarrer une discussion directement depuis un profil en appuyant sur l’icône de message. Les discussions apparaissent ensuite dans la rubrique Messages.";
  }

  return "Je suis SARA, l'assistante ARAS. Je peux vous aider sur les profils, la découverte, les messages, les tarifs, l'inscription et la connexion. Indiquez-moi simplement votre besoin.";
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = (await request.json()) as { message?: string; history?: ChatMessage[] };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: 'Message manquant.' }, { status: 400 });
    }

    let configuredPrompt = systemPrompt;
    let configuredDistressFallback = '';
    let configuredDaily = { free: 5, premium: 20, elite: 50 };
    let userId: string | null = null;
    const admin = getSupabaseAdmin();
    if (admin) {
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (token) {
        const { data: authData } = await admin.auth.getUser(token);
        userId = authData.user?.id ?? null;
      }
      const { data: settings } = await admin.from('settings').select('key,value').in('key', ['sara_enabled', 'sara_system_instructions', 'sara_distress_fallback', 'sara_daily_free', 'sara_daily_premium', 'sara_daily_elite']);
      const values = Object.fromEntries((settings ?? []).map((row) => [row.key, row.value]));
      if (values.sara_enabled === 'false') {
        await recordUsage(admin, 'disabled', null, startedAt, userId);
        return NextResponse.json({ answer: 'SARA est momentanément indisponible. Vous pouvez contacter l’équipe ARAS depuis la page Contact.' });
      }
      if (values.sara_system_instructions?.trim()) configuredPrompt = `${systemPrompt}\n\nInstructions complémentaires de l’équipe ARAS :\n${values.sara_system_instructions.trim()}`;
      configuredDistressFallback = values.sara_distress_fallback || '';
      if (values.sara_distress_fallback?.trim()) configuredPrompt += `\n\nEn cas de détresse exprimée par la personne, réponds avec tact et utilise ce message de soutien défini par l’équipe :\n${values.sara_distress_fallback.trim()}`;
      configuredDaily = {
        free: readDailyLimit(values.sara_daily_free, 5),
        premium: readDailyLimit(values.sara_daily_premium, 20),
        elite: readDailyLimit(values.sara_daily_elite, 50),
      };
      if (userId) {
        const now = new Date();
        const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
        const [{ data: subscription }, { count, error: quotaError }] = await Promise.all([
          admin.from('user_subscriptions').select('plan_code').eq('user_id', userId).eq('status', 'active').or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`).or(`starts_at.is.null,starts_at.lte.${now.toISOString()}`).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          admin.from('sara_usage_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('outcome', ['answered', 'fallback']).gte('created_at', dayStart),
        ]);
        if (quotaError) console.error('[sarah] Could not check daily quota:', quotaError.message);
        else {
          const planCode = subscription?.plan_code;
          const tier = planCode === 'premium' ? 'premium' : ['elite', 'golden'].includes(planCode ?? '') ? 'elite' : 'free';
          if ((count ?? 0) >= configuredDaily[tier]) {
            await recordUsage(admin, 'disabled', null, startedAt, userId);
            return NextResponse.json({ answer: 'Tu as atteint ta limite de messages SARA pour aujourd’hui. Elle sera réinitialisée demain.' }, { status: 429 });
          }
        }
      }
    }

    const usesCloud = Boolean(process.env.OLLAMA_API_KEY);
    const baseUrl =
      process.env.OLLAMA_BASE_URL || (usesCloud ? 'https://ollama.com/api' : 'http://127.0.0.1:11434/api');
    const model = process.env.OLLAMA_MODEL || (usesCloud ? 'gpt-oss:120b' : 'llama3.1');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: configuredPrompt },
            ...(Array.isArray(body.history) ? body.history.slice(-6) : []),
            { role: 'user', content: message },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        await response.text();
        await recordUsage(admin, 'fallback', model, startedAt, userId);
        return NextResponse.json(
          {
            answer: fallbackAnswer(message, configuredDistressFallback),
          },
          { status: 200 }
        );
      }

      const data = (await response.json()) as {
        message?: { content?: string };
        response?: string;
      };

      const answer = data.message?.content || data.response || fallbackAnswer(message, configuredDistressFallback);
      await recordUsage(admin, 'answered', model, startedAt, userId);
      return NextResponse.json({ answer });
    } catch {
      await recordUsage(admin, 'fallback', model, startedAt, userId);
      return NextResponse.json({
        answer: fallbackAnswer(message, configuredDistressFallback),
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

function readDailyLimit(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(500, parsed)) : fallback;
}

async function recordUsage(admin: ReturnType<typeof getSupabaseAdmin>, outcome: 'answered' | 'fallback' | 'disabled' | 'error', model: string | null, startedAt: number, userId: string | null = null) {
  if (!admin) return;
  const { error } = await admin.from('sara_usage_events').insert({ outcome, model, elapsed_ms: Math.max(0, Date.now() - startedAt), user_id: userId });
  if (error) console.error('[sarah] Could not record aggregate usage:', error.message);
}
