import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isValidPhone, normalizePhone } from '@/lib/phone';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: unknown };
    const phone = String(body.phone ?? '').trim();
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'La vérification est momentanément indisponible.' }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const normalizedPhone = normalizePhone(phone);
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        return NextResponse.json({ error: 'La vérification est momentanément indisponible.' }, { status: 503 });
      }
      if (data.users.some((user) => user.phone && normalizePhone(user.phone) === normalizedPhone)) {
        return NextResponse.json({ ok: true });
      }
      if (data.users.length < 1000) break;
    }

    return NextResponse.json({ error: 'Aucun compte ARAS n’est associé à ce numéro de téléphone.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'La vérification est momentanément indisponible.' }, { status: 503 });
  }
}
