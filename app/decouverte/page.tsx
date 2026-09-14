'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DecouvertePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/espace');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] px-5 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="rounded-[24px] bg-white px-8 py-6 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
        <p className="text-sm font-bold text-[#756960]">Redirection vers votre espace.</p>
      </div>
    </main>
  );
}
