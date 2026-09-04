'use client';

import { useState } from 'react';
import { X, Play } from 'lucide-react';
import type { Story, Profile } from '@/lib/types';

interface StoriesCarouselProps {
  matches: Profile[];
  stories: Story[];
  profileMap: Record<string, Profile>;
}

export function StoriesCarousel({ matches, stories, profileMap }: StoriesCarouselProps) {
  const [selectedStory, setSelectedStory] = useState<{ story: Story; profile: Profile } | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  // Group stories by user
  const storiesByUser = stories.reduce((acc, story) => {
    if (!acc[story.user_id]) {
      acc[story.user_id] = [];
    }
    acc[story.user_id].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  // Get users with stories
  const usersWithStories = Object.keys(storiesByUser)
    .filter(userId => profileMap[userId])
    .map(userId => ({
      user: profileMap[userId],
      stories: storiesByUser[userId],
    }));

  if (usersWithStories.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-4 pb-2">
          {usersWithStories.map(({ user, stories: userStories }) => (
            <button
              key={user.id}
              onClick={() => { setSelectedStory({ story: userStories[0], profile: user }); setCurrentStoryIndex(0); }}
              className="shrink-0 flex flex-col items-center gap-2"
            >
              <div className="relative">
                <div className="h-16 w-16 overflow-hidden rounded-full border-3 border-[#e9515f] bg-gradient-to-br from-[#e9515f] to-[#d89b52] p-0.5">
                  <div className="h-full w-full overflow-hidden rounded-full border-2 border-white">
                    <img src={user.photo_url} alt={user.display_name} className="h-full w-full object-cover" />
                  </div>
                </div>
                {userStories.length > 1 && (
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#e9515f] text-[10px] font-extrabold text-white">
                    {userStories.length}
                  </div>
                )}
              </div>
              <p className="text-xs font-extrabold text-[#241c18] max-w-[64px] truncate">{user.display_name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* STORY VIEWER MODAL */}
      {selectedStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <button
            onClick={() => setSelectedStory(null)}
            className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          >
            <X size={24} />
          </button>

          <div className="relative h-full w-full max-w-md">
            {/* Progress bars */}
            <div className="absolute top-4 left-4 right-4 z-10 flex gap-1">
              {usersWithStories
                .find(u => u.user.id === selectedStory.profile.id)
                ?.stories.map((_, index) => (
                  <div
                    key={index}
                    className="flex-1 h-1 rounded-full bg-white/30"
                  >
                    <div
                      className="h-full rounded-full bg-white transition-all duration-300"
                      style={{ width: index < currentStoryIndex ? '100%' : '0%' }}
                    />
                  </div>
                ))}
            </div>

            {/* Story content */}
            <div className="relative h-full w-full bg-black">
              {selectedStory.story.media_type === 'image' ? (
                <img src={selectedStory.story.media_url} alt="Story" className="h-full w-full object-contain" />
              ) : (
                <video src={selectedStory.story.media_url} className="h-full w-full object-contain" autoPlay />
              )}

              {/* Profile info overlay */}
              <div className="absolute top-12 left-4 right-4 flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white">
                  <img src={selectedStory.profile.photo_url} alt={selectedStory.profile.display_name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-extrabold text-white">{selectedStory.profile.display_name}</p>
                  <p className="text-xs text-white/70">
                    {new Date(selectedStory.story.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Caption */}
              {selectedStory.story.caption && (
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-sm text-white">{selectedStory.story.caption}</p>
                </div>
              )}

              {/* Navigation */}
              <button
                onClick={() => {
                  const userStories = usersWithStories.find(u => u.user.id === selectedStory.profile.id)?.stories || [];
                  if (currentStoryIndex < userStories.length - 1) {
                    setCurrentStoryIndex(currentStoryIndex + 1);
                    setSelectedStory({ story: userStories[currentStoryIndex + 1], profile: selectedStory.profile });
                  } else {
                    setSelectedStory(null);
                  }
                }}
                className="absolute right-0 top-0 h-full w-1/3"
              />
              <button
                onClick={() => {
                  if (currentStoryIndex > 0) {
                    setCurrentStoryIndex(currentStoryIndex - 1);
                    const userStories = usersWithStories.find(u => u.user.id === selectedStory.profile.id)?.stories || [];
                    setSelectedStory({ story: userStories[currentStoryIndex - 1], profile: selectedStory.profile });
                  }
                }}
                className="absolute left-0 top-0 h-full w-1/3"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
