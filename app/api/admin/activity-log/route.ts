import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function parseClient(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? 'Microsoft Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'Navigateur inconnu';
  const operatingSystem = /Windows NT/.test(userAgent) ? 'Windows'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'Système inconnu';
  const device = /iPad|Tablet/.test(userAgent) ? 'Tablette' : /Mobile|iPhone|Android/.test(userAgent) ? 'Mobile' : 'Ordinateur';
  return { browser, operatingSystem, device };
}

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !anonKey) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Journal d’activité indisponible.' }, { status: 503 });

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await auth.auth.getUser(accessToken);
  if (error || !user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  const userAgent = request.headers.get('user-agent') || '';
  const parsed = parseClient(userAgent);
  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || request.headers.get('x-nf-geo-country-code');
  const region = request.headers.get('x-vercel-ip-country-region') || request.headers.get('x-nf-geo-region');
  const city = request.headers.get('x-vercel-ip-city') || request.headers.get('x-nf-geo-city');
  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: insertError } = await admin.from('admin_activity_logs').insert({
    user_id: user.id,
    kind: 'login',
    country,
    region,
    city,
    browser: parsed.browser,
    operating_system: parsed.operatingSystem,
    device: parsed.device,
    user_agent: userAgent,
    page: 'Connexion email/téléphone',
  });
  if (insertError) return NextResponse.json({ error: 'Connexion enregistrée, mais le journal n’a pas pu être mis à jour.' }, { status: 500 });
  return NextResponse.json({ recorded: true });
}
