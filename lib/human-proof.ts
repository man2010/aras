import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 20 * 60 * 1000;

function getSecret() {
  return (
    process.env.HUMAN_PROOF_SECRET?.trim() ||
    process.env.TURNSTILE_SECRET_KEY?.trim() ||
    ''
  );
}

/** Preuve signée après vérification Turnstile (valide ~20 min, pour le flux OTP). */
export function issueHumanProof(humanVerified: boolean): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const exp = Date.now() + TTL_MS;
  const payload = `${humanVerified ? '1' : '0'}:${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}:${sig}`;
}

export function parseHumanProof(proof: string): boolean | null {
  const secret = getSecret();
  if (!secret) return null;

  const parts = proof.split(':');
  if (parts.length !== 3) return null;

  const [flag, expRaw, sig] = parts;
  if (flag !== '0' && flag !== '1') return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;

  const payload = `${flag}:${expRaw}`;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return flag === '1';
}
