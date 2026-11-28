import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { analyzeProfilePhoto } from '@/lib/google-vision-moderation';

export const runtime = 'nodejs';
export const maxDuration = 45;

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function hasValidImageSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  return false;
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

  let moderation;
  try {
    moderation = await analyzeProfilePhoto({ base64: Buffer.from(bytes).toString('base64'), includeWebDetection: true });
  } catch (error) {
    console.error('[profile-photos] Google Vision moderation unavailable:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'La vérification automatique est momentanément indisponible. Réessaie dans quelques instants.' }, { status: 503 });
  }
  if (moderation.flagged) {
    const rejection = moderation.reason === 'aucune_personne_detectee'
      ? 'La photo doit montrer clairement au moins une personne.'
      : moderation.reason === 'contenu_inapproprie'
        ? 'Cette photo ne respecte pas les règles de la communauté. Choisis une autre image.'
        : 'Cette image semble déjà publiée sur le Web. Choisis une photo personnelle.';
    return NextResponse.json({ error: rejection }, { status: 422 });
  }

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
