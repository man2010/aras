import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  DetectLabelsCommand,
  DetectModerationLabelsCommand,
  RekognitionClient,
  RecognizeCelebritiesCommand,
} from '@aws-sdk/client-rekognition';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 45;

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function hasValidImageSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  return false;
}

function moderationMessage(reason: string) {
  if (reason === 'not_a_person') return 'La photo doit montrer une personne. Les objets, chaussures et accessoires seuls ne sont pas acceptés.';
  if (reason === 'not_a_photo') return 'Les illustrations, personnages dessinés et images artificielles ne sont pas acceptés.';
  if (reason === 'public_figure') return 'Les photos de célébrités ou de personnages connus ne sont pas acceptées. Ajoute une photo personnelle.';
  return 'La photo n’a pas pu être validée. Choisis une photo personnelle nette où une personne est clairement visible.';
}

async function withRekognitionRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      const retryable = name === 'ThrottlingException' || name === 'ProvisionedThroughputExceededException' || name === 'InternalServerError';
      if (!retryable || attempt >= attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    }
  }
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!supabaseUrl || !anonKey || !accessToken) {
    return NextResponse.json({ error: 'Session requise. Reconnecte-toi puis réessaie.' }, { status: 401 });
  }

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: 'Session invalide. Reconnecte-toi puis réessaie.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Le service photo est momentanément indisponible.' }, { status: 503 });

  let photo: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    photo = form.get('photo');
  } catch {
    return NextResponse.json({ error: 'Fichier photo invalide.' }, { status: 400 });
  }
  if (!(photo instanceof File)) return NextResponse.json({ error: 'Choisis une photo à envoyer.' }, { status: 400 });
  if (photo.size === 0 || photo.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'La photo doit faire moins de 4 Mo.' }, { status: 413 });
  if (photo.type !== 'image/jpeg' && photo.type !== 'image/png') return NextResponse.json({ error: 'Seules les photos JPG, JPEG ou PNG sont acceptées.' }, { status: 415 });

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!hasValidImageSignature(bytes, photo.type)) return NextResponse.json({ error: 'Le fichier envoyé n’est pas une image JPG ou PNG valide.' }, { status: 415 });

  const rekognition = new RekognitionClient({
    region: 'us-east-1',
    // In production Amplify supplies temporary credentials through its SSR Compute role.
    // Locally, the AWS SDK reads the standard AWS profile/credential chain.
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  let rejectedReason: string | null = null;
  try {
    const image = { Bytes: Buffer.from(bytes) };
    const options = { abortSignal: controller.signal };
    const [celebrityResult, labelResult, moderationResult] = await Promise.all([
      withRekognitionRetry(() => rekognition.send(new RecognizeCelebritiesCommand({ Image: image }), options)),
      withRekognitionRetry(() => rekognition.send(new DetectLabelsCommand({ Image: image, MaxLabels: 30, MinConfidence: 65 }), options)),
      withRekognitionRetry(() => rekognition.send(new DetectModerationLabelsCommand({ Image: image, MinConfidence: 75 }), options)),
    ]);

    const labels = labelResult.Labels ?? [];
    const labelNames = labels.map((label) => (label.Name ?? '').toLocaleLowerCase('en'));
    const hasPersonLabel = labels.some((label) => /^(person|human)$/.test((label.Name ?? '').toLocaleLowerCase('en')) && (label.Confidence ?? 0) >= 75);
    const hasFace = Boolean(celebrityResult.UnrecognizedFaces?.length || celebrityResult.CelebrityFaces?.length);
    const isCelebrity = (celebrityResult.CelebrityFaces ?? []).some((celebrity) => (celebrity.MatchConfidence ?? celebrity.Face?.Confidence ?? 0) >= 80);
    const isIllustration = labelNames.some((name) => /cartoon|drawing|illustration|animation|comic|fictional character/.test(name));
    const unsafeImage = (moderationResult.ModerationLabels ?? []).some((label) => {
      const name = `${label.Name ?? ''} ${label.ParentName ?? ''}`.toLocaleLowerCase('en');
      return /explicit nudity|sexual activity|graphic violence|violent activities|visually disturbing/.test(name) && (label.Confidence ?? 0) >= 80;
    });

    if (isCelebrity) rejectedReason = 'public_figure';
    else if (isIllustration) rejectedReason = 'not_a_photo';
    else if (!hasFace || !hasPersonLabel) rejectedReason = 'not_a_person';
    else if (unsafeImage) rejectedReason = 'unclear';
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'UnknownError';
    console.error('[profile-photos] Rekognition moderation failed:', name);
    return NextResponse.json(
      { error: 'La vérification des photos est momentanément indisponible. Réessaie dans quelques instants.' },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (rejectedReason) return NextResponse.json({ error: moderationMessage(rejectedReason), reason: rejectedReason }, { status: 422 });

  const fileExtension = photo.type === 'image/png' ? 'png' : 'jpg';
  const filePath = `${authData.user.id}/profile-${crypto.randomUUID()}.${fileExtension}`;
  const { error: uploadError } = await admin.storage.from('avatars').upload(filePath, bytes, {
    contentType: photo.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: 'La photo validée n’a pas pu être enregistrée. Réessaie.' }, { status: 503 });

  const { data } = admin.storage.from('avatars').getPublicUrl(filePath);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
