'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, MapPin, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type Gender = 'Homme' | 'Femme';

function ageFromBirthdate(value: string) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    if (!response.ok) return '';
    const data = await response.json();
    return data?.display_name || '';
  } catch {
    return '';
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [birthdate, setBirthdate] = useState('');
  const [age, setAge] = useState(0);
  const [locationLabel, setLocationLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [primaryPhoto, setPrimaryPhoto] = useState('');
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);

  const isAdult = useMemo(() => age >= 18, [age]);
  const canContinue = Boolean(name.trim() && gender && birthdate && isAdult && locationLabel && primaryPhoto);

  useEffect(() => {
    if (!user) router.push('/connexion');
  }, [user, router]);

  useEffect(() => {
    if (!birthdate) {
      setAge(0);
      return;
    }
    setAge(ageFromBirthdate(birthdate));
  }, [birthdate]);

  const detectLocation = async () => {
    setMessage('');
    if (!navigator.geolocation) {
      setMessage('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        const label = await reverseGeocode(latitude, longitude);
        setLocationLabel(label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      () => setMessage('Nous n’avons pas pu récupérer votre localisation.')
    );
  };

  const uploadPhoto = async (file: File) => {
    if (!user) return '';
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handlePrimaryUpload = async (file?: File | null) => {
    if (!file) return;
    setLoading(true);
    try {
      const url = await uploadPhoto(file);
      setPrimaryPhoto(url);
      setMessage('Photo ajoutée avec succès.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur lors de l’upload.');
    } finally {
      setLoading(false);
    }
  };

  const handleExtraUploads = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoading(true);
    try {
      const remaining = 6 - (primaryPhoto ? 1 : 0) - extraPhotos.length;
      const selected = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      for (const file of selected) {
        uploaded.push(await uploadPhoto(file));
      }
      setExtraPhotos((prev) => [...prev, ...uploaded]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur lors de l’ajout des photos.');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!isAdult) {
      setMessage('Vous devez avoir au moins 18 ans pour continuer.');
      return;
    }
    setLoading(true);
    setMessage('');

    const photos = [primaryPhoto, ...extraPhotos].filter(Boolean);
    const payload = {
      full_name: name.trim(),
      gender,
      birthdate,
      city: locationLabel.split(',')[0] || locationLabel,
      zone: locationLabel,
      location_label: locationLabel,
      lat,
      lng,
      avatar_urls: photos.length > 0 ? photos : undefined,
      photos,
      profile_status: 'completed',
      onboarding_completed: true,
      is_verified: true,
      is_active: true,
    };

    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...payload }, { onConflict: 'id' });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push('/decouverte');
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 py-12">
      <div className="mx-auto max-w-3xl rounded-[32px] bg-white p-6 shadow-[0_20px_60px_rgba(83,46,32,.08)] sm:p-10">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Finaliser le profil</p>
        <h1 className="font-display mt-3 text-4xl tracking-[-.04em]">Bienvenue chez ARAS</h1>
        <p className="mt-2 text-sm leading-6 text-[#756960]">
          Prenons quelques instants pour créer un profil sérieux, complet et prêt à rencontrer.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="block text-xs font-extrabold text-[#625852]">
            Comment t’appelles-tu ?
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
              placeholder="Ton prénom"
            />
          </label>

          <div className="block text-xs font-extrabold text-[#625852]">
            Tu es ?
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['Homme', 'Femme'] as Gender[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGender(option)}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    gender === option ? 'border-[#ec3b78] bg-[#fae4e2] text-[#c92e63]' : 'border-[#dfd2c6] bg-[#fbf8f2] text-[#756960]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-extrabold text-[#625852]">
            Ta date de naissance
            <input
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              type="date"
              className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
            />
            {birthdate && (
              <p className={`mt-2 text-[11px] font-bold ${isAdult ? 'text-[#1a6b68]' : 'text-[#c92e63]'}`}>
                {isAdult ? 'Âge validé : vous avez bien 18 ans ou plus.' : 'Vous devez avoir au moins 18 ans pour continuer.'}
              </p>
            )}
          </label>

          <div className="block text-xs font-extrabold text-[#625852]">
            Où habites-tu ?
            <button
              type="button"
              onClick={detectLocation}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm font-bold text-[#756960] transition hover:border-[#ec3b78]"
            >
              <MapPin size={15} /> Activer la géolocalisation
            </button>
            {locationLabel && <p className="mt-2 text-[11px] font-bold text-[#1a6b68]">{locationLabel}</p>}
          </div>

          <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-extrabold text-[#625852]">
              Photo de profil
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePrimaryUpload(e.target.files?.[0])}
                className="mt-2 w-full rounded-xl border border-dashed border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm"
              />
              {primaryPhoto && <p className="mt-2 text-[11px] font-bold text-[#1a6b68]">Photo principale ajoutée.</p>}
            </label>

            <label className="block text-xs font-extrabold text-[#625852]">
              Ajouter plus de photos
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleExtraUploads(e.target.files)}
                className="mt-2 w-full rounded-xl border border-dashed border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm"
              />
              <p className="mt-2 text-[11px] font-bold text-[#9a8b82]">Jusqu’à 6 photos au total.</p>
            </label>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] bg-[#fbf8f2] p-5">
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#9a682f]">Résumé du profil</p>
          <div className="mt-4 grid gap-3 text-sm text-[#756960]">
            <p><span className="font-bold text-[#241c18]">Nom :</span> {name || '—'}</p>
            <p><span className="font-bold text-[#241c18]">Genre :</span> {gender || '—'}</p>
            <p><span className="font-bold text-[#241c18]">Âge :</span> {birthdate ? `${age} ans` : '—'}</p>
            <p><span className="font-bold text-[#241c18]">Localisation :</span> {locationLabel || '—'}</p>
            <p><span className="font-bold text-[#241c18]">Photos :</span> {1 + extraPhotos.length} / 6</p>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-[#fae4e2] px-4 py-3 text-sm text-[#c92e63]">
            {message}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={saveProfile}
            disabled={loading || !canContinue}
            className="flex-1 rounded-full bg-[#ec3b78] px-6 py-4 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Commencer l’aventure
          </button>
          <button
            type="button"
            className="flex-1 rounded-full border border-[#dfd2c6] bg-white px-6 py-4 text-sm font-extrabold text-[#756960]"
          >
            Prêt à rencontrer ?
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-[#9a8b82]">
          Un petit profil authentique ouvre la porte à de vraies rencontres.
        </p>
      </div>
    </main>
  );
}
