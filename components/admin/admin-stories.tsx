'use client';

import { useState } from 'react';
import { ShieldCheck, Trash2, Eye, Filter, Image as ImageIcon, Video } from 'lucide-react';

interface AdminStoriesProps {
  stories: any[];
  profiles: Record<string, any>;
  onDeleteStory: (storyId: string) => void;
}

export function AdminStories({ stories, profiles, onDeleteStory }: AdminStoriesProps) {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'expired'>('all');

  const now = new Date();
  const filteredStories = stories.filter((s) => {
    const matchesType = filterType === 'all' || s.media_type === filterType;
    const expiresAt = new Date(s.expires_at);
    const matchesActive = filterActive === 'all' ||
                        (filterActive === 'active' && expiresAt > now) ||
                        (filterActive === 'expired' && expiresAt <= now);
    return matchesType && matchesActive;
  });

  const storiesByUser = filteredStories.reduce((acc, story) => {
    if (!acc[story.user_id]) {
      acc[story.user_id] = [];
    }
    acc[story.user_id].push(story);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
          <ShieldCheck size={20} className="text-[#ec3b78]" />
          <p className="mt-2 font-display text-2xl font-semibold">{stories.length}</p>
          <p className="text-xs font-bold uppercase text-[#9a8b82]">Total stories</p>
        </div>
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
          <ImageIcon size={20} className="text-[#1a6b68]" />
          <p className="mt-2 font-display text-2xl font-semibold">{stories.filter((s) => s.media_type === 'image').length}</p>
          <p className="text-xs font-bold uppercase text-[#9a8b82]">Images</p>
        </div>
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
          <Video size={20} className="text-[#d89b52]" />
          <p className="mt-2 font-display text-2xl font-semibold">{stories.filter((s) => s.media_type === 'video').length}</p>
          <p className="text-xs font-bold uppercase text-[#9a8b82]">Vidéos</p>
        </div>
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <Eye size={20} className="text-[#ec3b78]" />
          <p className="mt-2 font-display text-2xl font-semibold">{Object.keys(storiesByUser).length}</p>
          <p className="text-xs font-bold uppercase text-[#9a8b82]">Utilisateurs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
        <div className="flex flex-wrap gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'image' | 'video')}
            className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
          >
            <option value="all">Tous les types</option>
            <option value="image">Images</option>
            <option value="video">Vidéos</option>
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'expired')}
            className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actives</option>
            <option value="expired">Expirées</option>
          </select>
        </div>
      </div>

      {/* Stories by User */}
      <div className="space-y-6">
        {Object.entries(storiesByUser).map(([userId, userStories]) => {
          const user = profiles[userId];
          return (
            <div key={userId} className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
              <div className="mb-4 flex items-center gap-3">
                {user && (
                  <img src={user.avatar_urls?.[0]} alt="" className="h-12 w-12 rounded-full object-cover" />
                )}
                <div>
                  <p className="text-lg font-bold text-[#241c18]">{user?.full_name || 'Utilisateur inconnu'}</p>
                  <p className="text-sm text-[#9a8b82]">{(userStories as any[]).length} story(s)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {(userStories as any[]).map((story) => (
                  <div key={story.id} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[#f3e9dc]">
                    {story.media_type === 'image' ? (
                      <img src={story.media_url} alt="Story" className="h-full w-full object-cover" />
                    ) : (
                      <video src={story.media_url} className="h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[10px] text-white">{new Date(story.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <button
                      onClick={() => onDeleteStory(story.id)}
                      className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredStories.length === 0 && (
        <div className="rounded-[26px] bg-white p-12 text-center shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <ShieldCheck size={48} className="mx-auto text-[#dfd2c6]" />
          <p className="mt-4 text-sm text-[#756960]">Aucune story pour le moment.</p>
        </div>
      )}
    </div>
  );
}

