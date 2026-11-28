type VisionFeature = { type: 'FACE_DETECTION' | 'SAFE_SEARCH_DETECTION' | 'WEB_DETECTION'; maxResults?: number };
type VisionEntity = { description?: string; score?: number };
type VisionResponse = {
  error?: { message?: string };
  faceAnnotations?: Array<{ detectionConfidence?: number }>;
  safeSearchAnnotation?: { adult?: string; spoof?: string; medical?: string; violence?: string; racy?: string };
  webDetection?: { webEntities?: VisionEntity[]; fullMatchingImages?: Array<{ url?: string }>; partialMatchingImages?: Array<{ url?: string }> };
};

export type PhotoModerationFinding = { name: string; confidence?: number };
export type PhotoModerationResult = {
  flagged: boolean;
  reason: 'aucune_personne_detectee' | 'contenu_inapproprie' | 'possible_image_web' | null;
  faceCount: number;
  safeSearch: NonNullable<VisionResponse['safeSearchAnnotation']>;
  webEntities: VisionEntity[];
  celebrityCandidates: string[];
  findings: PhotoModerationFinding[];
};

const LIKELIHOOD: Record<string, number> = { UNKNOWN: 0, VERY_UNLIKELY: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, VERY_LIKELY: 5 };

export async function analyzeProfilePhoto(input: { base64?: string; imageUri?: string; includeWebDetection?: boolean }): Promise<PhotoModerationResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!apiKey) throw new Error('GOOGLE_VISION_API_KEY is not configured.');
  if (!input.base64 && !input.imageUri) throw new Error('Vision image input is missing.');

  const features: VisionFeature[] = [
    { type: 'FACE_DETECTION', maxResults: 20 },
    { type: 'SAFE_SEARCH_DETECTION', maxResults: 1 },
  ];
  if (input.includeWebDetection) features.push({ type: 'WEB_DETECTION', maxResults: 20 });
  const image = input.base64 ? { content: input.base64 } : { source: { imageUri: input.imageUri } };
  const url = new URL('https://vision.googleapis.com/v1/images:annotate');
  url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image, features }] }),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Google Vision request failed.');
  }
  if (!response.ok) {
    // Do not return or log the request URL: it contains the API key.
    const status = response.status;
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Google Vision returned HTTP ${status}.`);
  }

  const payload = await response.json() as { responses?: VisionResponse[] };
  const result = payload.responses?.[0];
  if (!result || result.error) throw new Error('Google Vision could not analyze the image.');

  const faceCount = result.faceAnnotations?.length ?? 0;
  const safeSearch = result.safeSearchAnnotation ?? {};
  const adult = LIKELIHOOD[safeSearch.adult ?? 'UNKNOWN'] ?? 0;
  const spoof = LIKELIHOOD[safeSearch.spoof ?? 'UNKNOWN'] ?? 0;
  const violence = LIKELIHOOD[safeSearch.violence ?? 'UNKNOWN'] ?? 0;
  const racy = LIKELIHOOD[safeSearch.racy ?? 'UNKNOWN'] ?? 0;
  const unsafe = adult >= 4 || violence >= 4 || racy >= 5 || spoof >= 4;
  const webDetection = result.webDetection;
  const webEntities = (webDetection?.webEntities ?? []).filter((entity) => Boolean(entity.description)).slice(0, 20);
  const hasStrongWebMatch = Boolean((webDetection?.fullMatchingImages?.length ?? 0) + (webDetection?.partialMatchingImages?.length ?? 0));
  const celebrityCandidates = hasStrongWebMatch
    ? webEntities.filter((entity) => (entity.score ?? 0) >= 0.75).map((entity) => entity.description!).slice(0, 5)
    : [];

  const findings: PhotoModerationFinding[] = [
    { name: `Visages détectés : ${faceCount}` },
    ...Object.entries(safeSearch).map(([category, likelihood]) => ({ name: `SafeSearch · ${category} : ${likelihood}` })),
    ...celebrityCandidates.map((name) => ({ name: `Correspondance Web possible · ${name}` })),
  ];
  const reason = faceCount === 0
    ? 'aucune_personne_detectee'
    : unsafe
      ? 'contenu_inapproprie'
      : celebrityCandidates.length > 0
        ? 'possible_image_web'
        : null;

  return { flagged: reason !== null, reason, faceCount, safeSearch, webEntities, celebrityCandidates, findings };
}
