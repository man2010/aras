'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Camera, Check, MapPin, Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type Gender = 'Homme' | 'Femme';
type Step = 0 | 1 | 2 | 3 | 4;

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
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>(0);
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
  const [extraPhotos, setExtraPhotos] = useState<Array<string | null>>(Array(6).fill(null));
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const steps = ['Profil', 'Localisation', 'Photo principale', 'Photos', 'Aperçu'];
  const isAdult = useMemo(() => age >= 18, [age]);
  const photoCount = extraPhotos.filter((photo) => Boolean(photo)).length;

  const stepReady = useMemo(() => {
    if (step === 0) return Boolean(name.trim() && gender && birthdate && isAdult);
    if (step === 1) return true;
    if (step === 2) return Boolean(primaryPhoto);
    if (step === 3) return true;
    return true;
  }, [step, name, gender, birthdate, isAdult, primaryPhoto]);

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

  const handleSelectFile = async (file?: File | null) => {
    if (!file) return;
    setLoading(true);
    setMessage('');

    try {
      const url = await uploadPhoto(file);
      if (pendingSlot === null) {
        setPrimaryPhoto(url);
      } else {
        setExtraPhotos((prev) => {
          const next = [...prev];
          next[pendingSlot] = url;
          return next;
        });
      }
      setMessage('Photo ajoutée avec succès.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur lors de l’upload.');
    } finally {
      setLoading(false);
      setPendingSlot(null);
      if (hiddenFileInputRef.current) hiddenFileInputRef.current.value = '';
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!isAdult) {
      setMessage('Vous devez avoir au moins 18 ans pour continuer.');
      return;
    }
    if (!primaryPhoto) {
      setMessage('Veuillez ajouter une photo de profil avant de continuer.');
      return;
    }

    setLoading(true);
    setMessage('');

    const photos = [primaryPhoto, ...extraPhotos.filter(Boolean)] as string[];
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

  const nextStep = () => {
    if (step === 4) {
      saveProfile();
      return;
    }

    if (!stepReady) {
      setMessage('Veuillez compléter cette étape avant de continuer.');
      return;
    }

    setMessage('');
    setStep((prev) => Math.min(prev + 1, 4) as Step);
  };

  const prevStep = () => {
    setMessage('');
    setStep((prev) => Math.max(prev - 1, 0) as Step);
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0d0d10] px-4 py-10 text-white sm:px-6 lg:px-10">
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleSelectFile(event.target.files?.[0])}
      />

      <div className="mx-auto max-w-6xl rounded-[30px] border border-white/10 bg-[#111214] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.55)] sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#ff7ab3]">Finaliser le profil</p>
            <h1 className="mt-3 font-display text-4xl tracking-[-0.05em] text-white lg:text-5xl">Bienvenue chez ARAS</h1>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
            Étape {step + 1} / {steps.length}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {steps.map((label, index) => (
            <div key={label} className="flex-1">
              <div className="mb-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">
                <span>{label}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${index <= step ? 'bg-gradient-to-r from-[#ff7ab3] to-[#ffb4d0]' : 'bg-white/5'}`}
                  style={{ width: `${index < step ? 100 : index === step ? 70 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-[#17181b] p-4 sm:p-6 lg:p-8">
          {step === 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffedf4] text-[#ff3e81]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff7ab3]">Identité</p>
                  <h2 className="text-2xl font-display text-white">Parlons un peu de toi</h2>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm font-bold text-white/80">
                  Comment t’appelles-tu ?
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1d1f24] px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/35 focus:border-[#ff7ab3]"
                    placeholder="Ton prénom"
                  />
                </label>

                <div className="block text-sm font-bold text-white/80">
                  Tu es ?
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['Homme', 'Femme'] as Gender[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGender(option)}
                        className={`rounded-2xl border px-4 py-3.5 text-sm font-bold transition ${
                          gender === option ? 'border-[#ff7ab3] bg-[#ffedf4] text-[#d63373]' : 'border-white/10 bg-[#1d1f24] text-white/70'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-sm font-bold text-white/80">
                  Ta date de naissance
                  <input
                    value={birthdate}
                    onChange={(event) => setBirthdate(event.target.value)}
                    type="date"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1d1f24] px-4 py-3.5 text-base text-white outline-none transition focus:border-[#ff7ab3]"
                  />
                  {birthdate && (
                    <p className={`mt-2 text-xs font-bold ${isAdult ? 'text-[#7fe4cb]' : 'text-[#ff9fb6]'}`}>
                      {isAdult ? 'Âge validé : tu as bien 18 ans ou plus.' : 'Tu dois avoir au moins 18 ans pour continuer.'}
                    </p>
                  )}
                </label>

              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf7f4] text-[#1d857a]">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7fe4cb]">Localisation</p>
                  <h2 className="text-2xl font-display text-white">Où habites-tu ?</h2>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={detectLocation}
                  className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#1d1f24] px-4 py-4 text-sm font-bold text-white transition hover:border-[#7fe4cb]"
                >
                  <MapPin size={16} className="text-[#7fe4cb]" />
                  Activer la géolocalisation
                </button>

                <div className="rounded-2xl border border-dashed border-white/10 bg-[#1d1f24] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Localisation actuelle</p>
                  <p className="mt-3 text-sm text-white/80">
                    {locationLabel || 'Tu peux passer cette étape si tu préfères remplir ta ville plus tard.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffedf4] text-[#ff3e81]">
                  <Camera size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff7ab3]">Photo principale</p>
                  <h2 className="text-2xl font-display text-white">Ajoute ta photo de profil</h2>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setPendingSlot(null);
                    hiddenFileInputRef.current?.click();
                  }}
                  className="group relative flex h-52 w-52 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-[#ff7ab3] bg-[#1d1f24] transition hover:border-[#ffb4d0]"
                >
                  {primaryPhoto ? (
                    <img src={primaryPhoto} alt="Photo principale" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-white/70">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ffedf4] text-[#ff3e81]">
                        <Camera size={24} />
                      </div>
                      <span className="text-sm font-bold">Clique pour ajouter</span>
                    </div>
                  )}

                  <div className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#ff3e81] text-white shadow-lg shadow-[#ff3e81]/30 transition group-hover:scale-105">
                    <Plus size={20} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#4d86ff]">
                  <Plus size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#91b4ff]">Photos optionnelles</p>
                  <h2 className="text-2xl font-display text-white">Ajoute jusqu’à 6 photos</h2>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {extraPhotos.map((photo, index) => (
                  <button
                    key={`slot-${index}`}
                    type="button"
                    onClick={() => {
                      setPendingSlot(index);
                      hiddenFileInputRef.current?.click();
                    }}
                    className="group relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-white/10 bg-[#1d1f24] transition hover:border-[#91b4ff]"
                  >
                    {photo ? (
                      <img src={photo} alt={`Photo optionnelle ${index + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-white/55">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#edf4ff] text-[#4d86ff]">
                          <Plus size={22} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-[0.18em]">Ajouter</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#1d1f24] p-4 text-sm text-white/65">
                Tu as ajouté {photoCount} photo{photoCount > 1 ? 's' : ''} optionnelle{photoCount > 1 ? 's' : ''} sur 6.
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf7f4] text-[#1d857a]">
                  <Check size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7fe4cb]">Aperçu du profil</p>
                  <h2 className="text-2xl font-display text-white">Ton profil est prêt</h2>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-[#1d1f24] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.35)] sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#ff7ab3] bg-[#ffedf4] text-2xl font-black text-[#d63373] shadow-lg shadow-[#ff7ab3]/20">
                      {primaryPhoto ? (
                        <img src={primaryPhoto} alt={name || 'Photo de profil'} className="h-full w-full object-cover" />
                      ) : (
                        <span>{(name || 'A').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-4xl tracking-[-0.04em] text-white">
                        {name || 'Ton profil'}{birthdate ? `, ${age}` : ''}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white/70">
                        {gender && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{gender}</span>}
                        {locationLabel && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{locationLabel.split(',')[0]}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-full border border-[#7fe4cb]/30 bg-[#112f2d] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#7fe4cb]">
                    Profil vérifié
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {extraPhotos.map((photo, index) => (
                    <div key={`preview-${index}`} className="overflow-hidden rounded-[22px] border border-white/10 bg-[#1d1f24]">
                      {photo ? (
                        <img src={photo} alt={`Photo optionnelle ${index + 1}`} className="h-40 w-full object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center text-sm font-bold uppercase tracking-[0.18em] text-white/30">
                          Photo {index + 1}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-[#ffb4d0] bg-[#2a151d] px-4 py-3 text-sm text-[#ffd9e7]">
            {message}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Check size={16} className="text-[#7fe4cb]" />
            Profil authentique et prêt à rencontrer
          </div>

          <div className="flex gap-3">
            {step > 0 && step < 4 && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1d1f24] px-5 py-3 text-sm font-bold text-white transition hover:border-white/20"
              >
                <ArrowLeft size={16} />
                Retour
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              disabled={loading || !stepReady}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff3e81] to-[#ff7ab3] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#ff3e81]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === 4 ? 'Terminer' : 'Suivant'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
