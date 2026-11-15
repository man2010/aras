import { supabase } from '@/lib/supabase';

const MAX_COMPRESSED_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;

async function prepareImage(file: File): Promise<File> {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    throw new Error('Seules les photos JPG, JPEG ou PNG sont acceptées.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La photo ne doit pas dépasser 5 Mo.');
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Préparation de la photo impossible.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Préparation de la photo impossible.')), 'image/jpeg', 0.84);
    });
    if (blob.size > MAX_COMPRESSED_IMAGE_BYTES) throw new Error('Cette photo est trop lourde après compression. Choisis une image moins volumineuse.');
    return new File([blob], 'profile-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch (error) {
    if (error instanceof Error && error.message !== 'Préparation de la photo impossible.') throw error;
    if (file.size > MAX_COMPRESSED_IMAGE_BYTES) throw new Error('Cette photo ne peut pas être compressée sur cet appareil. Choisis une image de moins de 4 Mo.');
    return file;
  }
}

export async function uploadProfilePhoto(file: File): Promise<string> {
  const prepared = await prepareImage(file);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) throw new Error('Session expirée. Reconnecte-toi puis réessaie.');

  const body = new FormData();
  body.set('photo', prepared);
  const response = await fetch('/api/profile-photos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !result.url) throw new Error(result.error || 'La vérification de la photo a échoué. Réessaie.');
  return result.url;
}
