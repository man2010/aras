'use client';

import { useState } from 'react';
import { Camera, X, Video, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Story } from '@/lib/types';
import { toStory, type StoryRow } from '@/lib/adapters';

interface StoryManagerProps {
  userId: string;
  stories: Story[];
  onStoriesChange: (stories: Story[]) => void;
}

export function StoryManager({ userId, stories, onStoriesChange }: StoryManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      alert('Seules les images et vidéos sont autorisées');
      return;
    }

    const maxSize = mediaType === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`Le fichier est trop volumineux. Maximum: ${mediaType === 'video' ? '50MB' : '10MB'}`);
      return;
    }

    setMediaFile(file);
    const preview = URL.createObjectURL(file);
    setMediaPreview(preview);
  };

  const uploadStory = async () => {
    if (!mediaFile) return;

    setUploading(true);

    try {
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${userId}/story_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, mediaFile);

      if (uploadError) {
        console.error('Erreur upload:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('stories').insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: mediaType,
        caption: caption || null,
      });

      if (dbError) {
        console.error('Erreur DB:', dbError);
        throw dbError;
      }

      setShowCreateModal(false);
      setCaption('');
      setMediaFile(null);
      setMediaPreview(null);
      
      const { data: storiesData } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (storiesData) {
        onStoriesChange((storiesData as StoryRow[]).map(toStory));
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      alert('Erreur lors de l\'upload de la story. Veuillez réessayer.');
    } finally {
      setUploading(false);
    }
  };

  const deleteStory = async (storyId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette story ?')) return;

    const { error } = await supabase.from('stories').delete().eq('id', storyId);
    if (!error) {
      const { data: storiesData } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (storiesData) {
        onStoriesChange((storiesData as StoryRow[]).map(toStory));
      }
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl">Mes stories</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-full bg-[#e9515f] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#c83d50]"
        >
          <Camera size={14} /> Créer une story
        </button>
      </div>

      {stories.length === 0 ? (
        <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <Camera size={36} className="mx-auto text-[#dfd2c6]" />
          <p className="mt-4 font-display text-xl">Aucune story pour l'instant</p>
          <p className="mt-2 text-sm text-[#756960]">Partagez des moments de votre journée avec vos matches.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {stories.map((story) => (
            <div key={story.id} className="group relative aspect-[9/16] overflow-hidden rounded-[22px] bg-white shadow-[0_8px_30px_rgba(83,46,32,.05)]">
              {story.media_type === 'image' ? (
                <img src={story.media_url} alt="Story" className="h-full w-full object-cover" />
              ) : (
                <video src={story.media_url} className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                {story.caption && <p className="text-xs text-white line-clamp-2">{story.caption}</p>}
                <p className="mt-1 text-[10px] text-white/70">
                  {new Date(story.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => deleteStory(story.id)}
                className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CREATE STORY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl sm:text-2xl">Créer une story</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 sm:mt-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-[#625852] mb-2">Type de média</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMediaType('image')}
                    className={`flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-extrabold transition ${mediaType === 'image' ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}
                  >
                    <ImageIcon size={14} /> Image
                  </button>
                  <button
                    onClick={() => setMediaType('video')}
                    className={`flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-extrabold transition ${mediaType === 'video' ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}
                  >
                    <Video size={14} /> Vidéo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#625852] mb-2">Média</label>
                <div className="relative rounded-xl border-2 border-dashed border-[#dfd2c6] bg-[#fbf8f2] p-4 sm:p-8 text-center min-h-[200px]">
                  {mediaPreview ? (
                    <div className="relative">
                      {mediaType === 'image' ? (
                        <img src={mediaPreview} alt="Preview" className="mx-auto max-h-48 sm:max-h-64 rounded-lg" />
                      ) : (
                        <video src={mediaPreview} className="mx-auto max-h-48 sm:max-h-64 rounded-lg" controls />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setMediaFile(null); setMediaPreview(null); }}
                        className="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Camera size={32} className="mx-auto text-[#dfd2c6]" />
                      <p className="mt-2 text-xs sm:text-sm text-[#756960]">Cliquez pour sélectionner un fichier</p>
                      <p className="text-[10px] sm:text-xs text-[#9a8b82]">Image (max 10MB) ou Vidéo (max 50MB)</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                    onChange={handleMediaSelect}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#625852] mb-2">Caption (optionnel)</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ajoutez une description..."
                  rows={3}
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#e9515f]"
                />
              </div>
            </div>

            <button
              onClick={uploadStory}
              disabled={!mediaFile || uploading}
              className="mt-4 sm:mt-6 w-full rounded-full bg-[#e9515f] py-3 text-sm font-extrabold text-white transition hover:bg-[#c83d50] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Upload en cours...' : 'Publier la story'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
