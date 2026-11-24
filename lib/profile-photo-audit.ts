import {
  DetectLabelsCommand,
  DetectModerationLabelsCommand,
  RekognitionClient,
  RecognizeCelebritiesCommand,
} from '@aws-sdk/client-rekognition';
import type { SupabaseClient } from '@supabase/supabase-js';

type ProfileRow = { id: string; avatar_urls: string[] | null };
type AuditResult = { profile_id: string; photo_url: string; scan_status: 'flagged' | 'compliant' | 'error'; review_status?: 'pending' | 'warned' | 'blocked' | 'cleared'; reviewed_at?: string | null; reviewed_by?: string | null; reason: string | null; celebrity_names: string[]; findings: unknown[]; scanned_at: string };

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PROFILES_PER_RUN = 1500;

function validPhotoUrl(value: string, supabaseUrl: string) {
  try {
    const url = new URL(value);
    const base = new URL(supabaseUrl);
    return url.protocol === 'https:' && url.origin === base.origin && url.pathname.includes('/storage/v1/object/public/avatars/');
  } catch {
    return false;
  }
}

async function analyzePhoto(rekognition: RekognitionClient, profileId: string, photoUrl: string, supabaseUrl: string): Promise<AuditResult> {
  const scannedAt = new Date().toISOString();
  const base = { profile_id: profileId, photo_url: photoUrl, scanned_at: scannedAt };
  try {
    if (!validPhotoUrl(photoUrl, supabaseUrl)) {
      return { ...base, scan_status: 'error', reason: 'source_non_prise_en_charge', celebrity_names: [], findings: [] };
    }
    const response = await fetch(photoUrl, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok) throw new Error(`photo_http_${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('photo_size_invalid');
    const image = { Bytes: Buffer.from(bytes) };
    const [celebrities, labels, moderation] = await Promise.all([
      rekognition.send(new RecognizeCelebritiesCommand({ Image: image })),
      rekognition.send(new DetectLabelsCommand({ Image: image, MaxLabels: 30, MinConfidence: 65 })),
      rekognition.send(new DetectModerationLabelsCommand({ Image: image, MinConfidence: 75 })),
    ]);
    const labelRows = (labels.Labels ?? []).map((label) => ({ name: label.Name ?? '', confidence: Math.round(label.Confidence ?? 0) }));
    const moderationRows = (moderation.ModerationLabels ?? []).map((label) => ({ name: label.Name ?? '', parent: label.ParentName ?? '', confidence: Math.round(label.Confidence ?? 0) }));
    const celebrityNames = (celebrities.CelebrityFaces ?? []).map((face) => face.Name).filter((name): name is string => Boolean(name));
    const lowerLabels = labelRows.map((label) => label.name.toLocaleLowerCase('en'));
    const hasPerson = labelRows.some((label) => /^(person|human)$/i.test(label.name) && label.confidence >= 75);
    const hasFace = Boolean(celebrities.UnrecognizedFaces?.length || celebrities.CelebrityFaces?.length);
    const illustration = lowerLabels.some((name) => /cartoon|drawing|illustration|animation|comic|fictional character/.test(name));
    const unsafe = moderationRows.some((label) => /explicit nudity|sexual activity|graphic violence|violent activities|visually disturbing/i.test(`${label.name} ${label.parent}`) && label.confidence >= 80);
    const reason = celebrityNames.length ? 'personnalite_publique'
      : illustration ? 'illustration'
        : !hasPerson || !hasFace ? 'aucune_personne_detectee'
          : unsafe ? 'contenu_inapproprie' : null;
    return {
      ...base,
      scan_status: reason ? 'flagged' : 'compliant',
      reason,
      celebrity_names: celebrityNames,
      findings: [...labelRows.filter((label) => label.confidence >= 75), ...moderationRows],
    };
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'UnknownError';
    console.error('[profile-photo-audit] Rekognition/photo scan failed:', name);
    return { ...base, scan_status: 'error', reason: 'analyse_indisponible', celebrity_names: [], findings: [] };
  }
}

export async function scanProfilePhotos(admin: SupabaseClient) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  if (!supabaseUrl) throw new Error('Supabase URL manquante.');
  const rekognition = new RekognitionClient({ region: 'us-east-1' });
  const { data: run, error: runError } = await admin.from('profile_photo_audit_runs').insert({ status: 'running' }).select('id').single();
  if (runError || !run) throw new Error(`Démarrage de l’analyse impossible : ${runError?.message ?? 'run manquant'}`);
  let profilesScanned = 0;
  let photosScanned = 0;
  let flagged = 0;
  let errors = 0;
  const pageSize = 250;
  try {
  for (let offset = 0; offset < MAX_PROFILES_PER_RUN; offset += pageSize) {
    const { data, error } = await admin.from('profiles').select('id,avatar_urls').order('created_at', { ascending: true }).range(offset, Math.min(offset + pageSize - 1, MAX_PROFILES_PER_RUN - 1));
    if (error) throw new Error(`Lecture des profils impossible : ${error.message}`);
    const profiles = (data ?? []) as ProfileRow[];
    if (!profiles.length) break;
    profilesScanned += profiles.length;
    const photos = profiles.flatMap((profile) => Array.from(new Set((profile.avatar_urls ?? []).filter((url): url is string => typeof url === 'string' && url.startsWith('https://')))).map((url) => ({ profileId: profile.id, url })));
    for (let index = 0; index < photos.length; index += 4) {
      const batch = photos.slice(index, index + 4);
      const results = await Promise.all(batch.map((photo) => analyzePhoto(rekognition, photo.profileId, photo.url, supabaseUrl)));
      photosScanned += results.length;
      flagged += results.filter((result) => result.scan_status === 'flagged').length;
      errors += results.filter((result) => result.scan_status === 'error').length;
      const { data: previous, error: previousError } = await admin.from('profile_photo_audits').select('profile_id,photo_url,review_status,reviewed_at,reviewed_by').in('profile_id', Array.from(new Set(batch.map((photo) => photo.profileId)))).in('photo_url', batch.map((photo) => photo.url));
      if (previousError) throw new Error(`Lecture des décisions précédentes impossible : ${previousError.message}`);
      const priorByPhoto = new Map((previous ?? []).map((row) => [`${row.profile_id}:${row.photo_url}`, row]));
      const resultsWithReview = results.map((result) => {
        const prior = priorByPhoto.get(`${result.profile_id}:${result.photo_url}`);
        return { ...result, review_status: prior?.review_status ?? 'pending', reviewed_at: prior?.reviewed_at ?? null, reviewed_by: prior?.reviewed_by ?? null };
      });
      const { error: saveError } = await admin.from('profile_photo_audits').upsert(resultsWithReview, { onConflict: 'profile_id,photo_url' });
      if (saveError) throw new Error(`Enregistrement des analyses impossible : ${saveError.message}`);
    }
    if (profiles.length < pageSize) break;
  }
  const result = { profilesScanned, photosScanned, flagged, errors, profileLimit: MAX_PROFILES_PER_RUN, truncated: profilesScanned >= MAX_PROFILES_PER_RUN };
  const { error: finishError } = await admin.from('profile_photo_audit_runs').update({ status: 'completed', profiles_scanned: profilesScanned, photos_scanned: photosScanned, flagged_count: flagged, error_count: errors, finished_at: new Date().toISOString() }).eq('id', run.id);
  if (finishError) throw new Error(`Enregistrement du résultat impossible : ${finishError.message}`);
  return result;
  } catch (error) {
    await admin.from('profile_photo_audit_runs').update({ status: 'failed', profiles_scanned: profilesScanned, photos_scanned: photosScanned, flagged_count: flagged, error_count: errors, finished_at: new Date().toISOString() }).eq('id', run.id);
    throw error;
  }
}
