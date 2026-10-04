'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Camera, Check, Cigarette, ClipboardList, Heart, Languages, MapPin, MessageCircle, Plus, Sparkles, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type Gender = 'Homme' | 'Femme';
type Step = 0 | 1 | 2 | 3 | 4 | 5;
type MaritalStatus = { label: string; value: string };

const INTEREST_OPTIONS = ['Musique', 'Voyages', 'Cuisine', 'Sport', 'Lecture', 'Cinéma', 'Danse', 'Art', 'Photographie', 'Mode', 'Tech', 'Nature', 'Yoga', 'Gaming', 'Animaux'];
const LANGUAGE_OPTIONS = ['Français', 'Wolof', 'Pulaar', 'Sérère', 'Diola', 'Mandingue', 'Soninké', 'Manjak', 'Mancagne', 'Préfère ne rien dire', 'Anglais', 'Arabe'];
const RELIGION_OPTIONS = ['Islam', 'Christianisme', 'Préfère ne rien dire'];
const PREFERENCE_OPTIONS = ['Gueer', 'Gueweul', 'Laobé', 'Tègg', 'Oudé', 'Rabb', 'Gnégho', 'Préfère ne rien dire'];
const MARITAL_OPTIONS: MaritalStatus[] = [
  { label: 'Célibataire', value: 'single' }, { label: 'Marié(e)', value: 'married' },
  { label: 'Divorcé(e)', value: 'divorced' }, { label: 'Veuf/Veuve', value: 'widowed' },
];
const SMOKING_OPTIONS = ['Non fumeur', 'Fumeur'];

function ageFromBirthdate(value: string) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function ChoiceGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <p className="text-sm font-bold text-[#625852] dark:text-white/80">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2 rounded-2xl bg-[#f8f9fd] p-3 dark:bg-white/[0.04]">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${active ? 'border-[#ec3b78] bg-[#ffedf4] text-[#d63373] dark:border-[#ff7ab3] dark:bg-[#3a1e2a] dark:text-[#f9bfd2]' : 'border-[#dfdfe7] bg-white text-[#756960] hover:border-[#ec3b78] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white/75'}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [profession, setProfession] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [religion, setReligion] = useState('');
  const [caste, setCaste] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [smokingHabit, setSmokingHabit] = useState('');
  const [bio, setBio] = useState('');

  const steps = ['Profil', 'Localisation', 'Photo principale', 'Photos', 'Infos facultatives', 'Aperçu'];
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
      profession: profession.trim() || null,
      interests,
      languages,
      religion: religion || null,
      caste: caste || null,
      marital_status: maritalStatus || null,
      smoking_habit: smokingHabit || null,
      bio: bio.trim(),
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
    if (step === 5) {
      saveProfile();
      return;
    }

    if (!stepReady) {
      setMessage('Veuillez compléter cette étape avant de continuer.');
      return;
    }

    setMessage('');
    setStep((prev) => Math.min(prev + 1, 5) as Step);
  };

  const skipStep = () => {
    setMessage('');
    setStep((prev) => Math.min(prev + 1, 5) as Step);
  };

  const prevStep = () => {
    setMessage('');
    setStep((prev) => Math.max(prev - 1, 0) as Step);
  };

  if (!user) return null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8f9fd] px-3 py-5 text-[#241c18] transition-colors dark:bg-[#0d0d10] dark:text-white sm:px-6 sm:py-10 lg:px-10">
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleSelectFile(event.target.files?.[0])}
      />

      <div className="mx-auto max-w-6xl rounded-[24px] border border-[#eadfd5] bg-[#f8f9fd] p-4 shadow-[0_24px_70px_rgba(83,46,32,0.10)] dark:border-white/10 dark:bg-[#111214] dark:shadow-[0_40px_120px_rgba(0,0,0,0.55)] sm:rounded-[30px] sm:p-6 lg:p-8">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-[#eadfd5] pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:pb-6">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d63373] dark:text-[#ff7ab3]">Finaliser le profil</p>
            <h1 className="mt-2 font-display text-3xl tracking-[-0.05em] text-[#241c18] dark:text-white sm:mt-3 sm:text-4xl lg:text-5xl">Bienvenue chez ARAS</h1>
          </div>
          <div className="self-start rounded-full border border-[#eadfd5] bg-[#f8f9fd] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#625852] dark:border-white/10 dark:bg-white/5 dark:text-white/80 sm:self-auto sm:px-4 sm:text-xs sm:tracking-[0.18em]">
            Étape {step + 1} / {steps.length}
          </div>
        </div>

        <div className="mt-5 flex gap-1.5 sm:mt-6 sm:gap-2">
          {steps.map((label, index) => (
            <div key={label} className="min-w-0 flex-1">
              <div className="mb-2 flex h-7 items-center text-[9px] font-extrabold uppercase leading-tight tracking-normal text-[#756960] dark:text-white/50 sm:h-auto sm:text-[10px] sm:tracking-[0.12em]">
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{index + 1}. {label === 'Photo principale' ? 'Photo' : label === 'Aperçu' ? 'Aperçu' : label}</span>
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

        <div className="mt-6 rounded-[22px] border border-[#eadfd5] bg-white p-4 sm:mt-8 sm:rounded-[28px] sm:p-6 lg:p-8 dark:border-white/10 dark:bg-[#17181b]">
          {step === 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffedf4] text-[#ff3e81]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff7ab3]">Identité</p>
                  <h2 className="text-xl font-display text-[#241c18] dark:text-white sm:text-2xl">Parlons un peu de toi</h2>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm font-bold text-[#625852] dark:text-white/80">
                  Comment t’appelles-tu ?
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full min-w-0 rounded-2xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3.5 text-base text-[#241c18] outline-none transition placeholder:text-[#9a8b82] focus:border-[#ec3b78] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white dark:placeholder:text-white/35 dark:focus:border-[#ff7ab3]"
                    placeholder="Ton prénom"
                  />
                </label>

                <div className="block text-sm font-bold text-[#625852] dark:text-white/80">
                  Tu es ?
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['Homme', 'Femme'] as Gender[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGender(option)}
                        className={`rounded-2xl border px-4 py-3.5 text-sm font-bold transition ${
                          gender === option ? 'border-[#ec3b78] bg-[#ffedf4] text-[#d63373] dark:border-[#ff7ab3]' : 'border-[#dfd2c6] bg-[#f8f9fd] text-[#625852] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white/70'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-sm font-bold text-[#625852] dark:text-white/80">
                  Ta date de naissance
                  <input
                    value={birthdate}
                    onChange={(event) => setBirthdate(event.target.value)}
                    type="date"
                    className="mt-2 w-full min-w-0 rounded-2xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3.5 text-base text-[#241c18] outline-none transition focus:border-[#ec3b78] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white dark:focus:border-[#ff7ab3]"
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
                  <h2 className="text-xl font-display text-[#241c18] dark:text-white sm:text-2xl">Où habites-tu ?</h2>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={detectLocation}
                  className="flex min-w-0 items-center justify-center gap-3 rounded-2xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-4 text-center text-sm font-bold text-[#241c18] transition hover:border-[#1d857a] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white dark:hover:border-[#7fe4cb]"
                >
                  <MapPin size={16} className="text-[#7fe4cb]" />
                  Activer la géolocalisation
                </button>

                <div className="min-w-0 rounded-2xl border border-dashed border-[#dfd2c6] bg-[#f8f9fd] p-4 dark:border-white/10 dark:bg-[#1d1f24]">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#756960] dark:text-white/50">Localisation actuelle</p>
                  <p className="mt-3 break-words text-sm text-[#625852] dark:text-white/80">
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
                  <h2 className="text-xl font-display text-[#241c18] dark:text-white sm:text-2xl">Ajoute ta photo de profil</h2>
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
                  <h2 className="text-xl font-display text-[#241c18] dark:text-white sm:text-2xl">Ajoute jusqu’à 6 photos</h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
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

              <div className="rounded-2xl border border-[#eadfd5] bg-[#f8f9fd] p-4 text-sm text-[#625852] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white/65">
                Tu as ajouté {photoCount} photo{photoCount > 1 ? 's' : ''} optionnelle{photoCount > 1 ? 's' : ''} sur 6.
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf7f4] text-[#1d857a]"><Sparkles size={18} /></div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7fe4cb]">Informations facultatives</p>
                  <h2 className="text-xl font-display text-[#241c18] dark:text-white sm:text-2xl">Quelques détails sur toi</h2>
                  <p className="mt-1 text-xs font-medium text-[#9a8b82]">Tu peux choisir tes réponses ou passer cette étape.</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-bold text-[#625852] dark:text-white/80">
                  Profession
                  <input value={profession} onChange={(event) => setProfession(event.target.value)} placeholder="Ta profession (facultatif)" className="mt-2 w-full min-w-0 rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3 text-sm font-normal outline-none focus:border-[#ec3b78] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white" />
                </label>
                <label className="block text-sm font-bold text-[#625852] dark:text-white/80 sm:col-span-2">
                  Bio
                  <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={3} maxLength={500} placeholder="Présente-toi en quelques mots (facultatif)" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3 text-sm font-normal outline-none focus:border-[#ec3b78] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white" />
                </label>

                <div className="sm:col-span-2">
                  <ChoiceGroup label="Tes passions" options={INTEREST_OPTIONS} selected={interests} onToggle={(value) => setInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} />
                </div>
                <div className="sm:col-span-2">
                  <ChoiceGroup label="Langues parlées" options={LANGUAGE_OPTIONS} selected={languages} onToggle={(value) => setLanguages((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} />
                </div>
                <div>
                  <ChoiceGroup label="Religion" options={RELIGION_OPTIONS} selected={religion ? [religion] : []} onToggle={(value) => setReligion((current) => current === value ? '' : value)} />
                </div>
                <div>
                  <ChoiceGroup label="Préférences" options={PREFERENCE_OPTIONS} selected={caste ? [caste] : []} onToggle={(value) => setCaste((current) => current === value ? '' : value)} />
                </div>
                <div>
                  <ChoiceGroup label="Situation" options={MARITAL_OPTIONS.map((option) => option.label)} selected={MARITAL_OPTIONS.filter((option) => option.value === maritalStatus).map((option) => option.label)} onToggle={(label) => setMaritalStatus((current) => {
                    const option = MARITAL_OPTIONS.find((item) => item.label === label);
                    return option?.value === current ? '' : option?.value ?? '';
                  })} />
                </div>
                <div>
                  <ChoiceGroup label="Fumeur" options={SMOKING_OPTIONS} selected={smokingHabit ? [smokingHabit] : []} onToggle={(value) => setSmokingHabit((current) => current === value ? '' : value)} />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf7f4] text-[#1d857a]">
                  <Check size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7fe4cb]">Aperçu du profil</p>
                  <h2 className="text-xl font-display text-[#241c18] dark:text-white sm:text-2xl">Ton profil est prêt</h2>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-[#eadfd5] bg-white shadow-[0_20px_60px_rgba(35,38,55,.12)] dark:border-white/10 dark:bg-[#17181b]">
                <div className="relative aspect-[4/3] max-h-[560px] bg-[#e4e6ed] dark:bg-[#24242c] sm:aspect-[16/9]">
                  {primaryPhoto ? <img src={primaryPhoto} alt={`Photo de ${name}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-8xl font-black text-[#9a8b82]">{(name || 'A').charAt(0).toUpperCase()}</div>}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/75 to-transparent" />
                  <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7">
                    <h3 className="break-words font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">{name || 'Ton profil'}{birthdate ? `, ${age}` : ''}</h3>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80"><MapPin size={15} className="shrink-0" />{locationLabel.split(',')[0] || 'Localisation non renseignée'}</p>
                    {gender && <span className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">{gender}</span>}
                  </div>
                </div>

                <main className="space-y-7 p-5 sm:p-7">
                  <section>
                    <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#241c18] dark:text-white"><MessageCircle size={19} className="text-[#ec1689]" />À propos</h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#626779] dark:text-white/75">{bio.trim() || 'Tu n’as pas encore ajouté de description.'}</p>
                  </section>

                  <section>
                    <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#241c18] dark:text-white"><span className="text-xl text-amber-500">✦</span>Centres d’intérêt</h3>
                    {interests.length ? <div className="mt-3 flex flex-wrap gap-2">{interests.map((interest) => <span key={interest} className="rounded-full border border-[#dfe1e8] bg-[#f0f1f5] px-3.5 py-2 text-xs font-semibold text-[#3e414d] dark:border-white/15 dark:bg-white/[0.08] dark:text-white/85">{interest}</span>)}</div> : <p className="mt-3 text-sm text-[#747888] dark:text-white/55">Aucun centre d’intérêt renseigné.</p>}
                  </section>

                  <section>
                    <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#241c18] dark:text-white"><ClipboardList size={19} className="text-[#ec1689]" />Informations</h3>
                    <div className="mt-2 divide-y divide-[#e5e6ec] dark:divide-white/10">{[
                      { label: 'Genre', value: gender, Icon: Users },
                      { label: 'Profession', value: profession, Icon: Briefcase },
                      { label: 'Religion', value: religion, Icon: BookOpen },
                      { label: 'Préférences', value: caste, Icon: Heart },
                      { label: 'Situation', value: MARITAL_OPTIONS.find((option) => option.value === maritalStatus)?.label ?? '', Icon: Heart },
                      { label: 'Langues', value: languages.join(', '), Icon: Languages },
                      { label: 'Tabac', value: smokingHabit, Icon: Cigarette },
                    ].filter(({ value }) => Boolean(value)).map(({ label, value, Icon }) => <div key={label} className="flex min-w-0 items-center gap-3 py-4"><Icon size={19} className="shrink-0 text-[#d72d7a] dark:text-[#ec3b91]" /><span className="min-w-0 flex-1 text-sm text-[#666a78] dark:text-white/65">{label}</span><span className="max-w-[58%] break-words text-right text-sm font-bold text-[#262733] dark:text-white/90">{value}</span></div>)}</div>
                  </section>
                </main>
              </div>
            </div>
          )}
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-[#f2bdcc] bg-[#fff0f3] px-4 py-3 text-sm text-[#a82455] dark:border-[#ffb4d0] dark:bg-[#2a151d] dark:text-[#ffd9e7]">
            {message}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[#756960] dark:text-white/60">
            <Check size={16} className="text-[#7fe4cb]" />
            Profil authentique et prêt à rencontrer
          </div>

          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:gap-3">
            {step > 0 && step < 5 && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#dfd2c6] bg-[#f8f9fd] px-5 py-3 text-sm font-bold text-[#625852] transition hover:border-[#ec3b78] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white dark:hover:border-white/20 sm:w-auto"
              >
                <ArrowLeft size={16} />
                Retour
              </button>
            )}

            {(step === 3 || step === 4) && (
              <button
                type="button"
                onClick={skipStep}
                disabled={loading}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#dfd2c6] bg-white px-5 py-3 text-sm font-bold text-[#756960] transition hover:border-[#ec3b78] dark:border-white/10 dark:bg-[#1d1f24] dark:text-white/70 sm:w-auto"
              >
                Passer
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              disabled={loading || !stepReady}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ec3b78] to-[#ff7ab3] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#ff3e81]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {step === 5 ? 'Terminer' : step === 4 ? 'Continuer' : 'Suivant'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
