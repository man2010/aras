'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toProfile, type ProfileRow } from '@/lib/adapters';
import type { Profile } from '@/lib/types';

export default function DecouvertePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/espace');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (user) return;

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const mappedProfiles = (data as ProfileRow[]).map(toProfile);
        setProfiles(mappedProfiles);
      }
      setLoading(false);
    })();
  }, [user]);

  const getFirstNameInitial = (displayName: string) => {
    const firstName = displayName.trim().split(/\s+/)[0] || 'A';
    return firstName.charAt(0).toUpperCase();
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[76px] lg:px-8 lg:pt-[76px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="h-8 w-40 animate-pulse rounded-full bg-[#e7d9ce]" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[76px] lg:px-8 lg:pt-[76px]">
      <div className="mx-auto max-w-[1120px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.22em] text-[#ec3b78]">À découvrir</p>
              <h2 className="mt-2 font-display text-3xl tracking-[-.04em] text-[#241c18]">Nos profils</h2>
            </div>
          </div>

          {loading ? (
            <div className="overflow-hidden pb-3">
              <div className="discovery-marquee-track flex w-max gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="min-w-[260px] animate-pulse rounded-[28px] border border-[#e5d6c9] bg-white p-5 shadow-[0_10px_30px_rgba(83,46,32,.04)]">
                  <div className="h-16 w-16 rounded-full bg-[#efe2d7]" />
                  <div className="mt-5 h-4 w-24 rounded-full bg-[#efe2d7]" />
                  <div className="mt-3 h-8 w-20 rounded-full bg-[#efe2d7]" />
                  <div className="mt-5 h-3 w-32 rounded-full bg-[#efe2d7]" />
                </div>
              ))}
              </div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-[28px] bg-white p-10 text-center shadow-[0_12px_35px_rgba(83,46,32,.05)]">
              <p className="text-lg font-bold text-[#241c18]">Aucun profil n&apos;est disponible pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-hidden pb-3">
              <div className="discovery-marquee-track flex w-max gap-4">
              {[...profiles, ...profiles].map((profile, index) => (
                <article
                  key={`${profile.id}-${index}`}
                  className="min-w-[260px] rounded-[28px] border border-[#e9d9ce] bg-white p-5 shadow-[0_10px_30px_rgba(83,46,32,.04)] transition hover:shadow-[0_18px_40px_rgba(83,46,32,.1)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#ec3b78] to-[#d89b52] text-2xl font-black text-white">
                      {getFirstNameInitial(profile.display_name)}
                    </div>
                    {profile.is_verified && (
                      <span className="rounded-full bg-[#e5f0ed] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.14em] text-[#1a6b68]">
                        Vérifié
                      </span>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#9a8b82]">Profil</p>
                    <h3 className="mt-2 font-display text-4xl leading-none text-[#241c18]">
                      {getFirstNameInitial(profile.display_name)}
                    </h3>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-[#756960]">
                    <p className="flex items-center gap-2">
                      <MapPin size={14} className="text-[#1a6b68]" />
                      {profile.city}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ec3b78]" />
                      {profile.age} ans
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {profile.profession ? (
                      <span className="rounded-full bg-[#f3e9dc] px-2.5 py-1 text-[10px] font-bold text-[#9a682f]">
                        {profile.profession}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#eef6f3] px-2.5 py-1 text-[10px] font-bold text-[#1a6b68]">
                        Nouvelle rencontre
                      </span>
                    )}
                  </div>

                  <Link
                    href="/inscription"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1a6b68] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#125552]"
                  >
                    Voir le profil <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
