import type { Conversation, EventItem, Message, Profile, Story } from './types';

export type ProfileRow = {
  id: string;
  updated_at: string | null;
  full_name: string | null;
  gender: string | null;
  birthdate: string | null;
  city: string | null;
  zone: string | null;
  bio: string | null;
  interests: string[] | null;
  languages: string[] | null;
  religion: string | null;
  caste: string | null;
  marital_status: string | null;
  smoking_habit: string | null;
  avatar_urls: string[] | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean | null;
  is_online: boolean | null;
  last_seen_at: string | null;
  is_verified: boolean | null;
  is_premium: boolean | null;
  view_count: number | null;
  show_age: boolean | null;
  show_online_status: boolean | null;
  show_distance: boolean | null;
  created_at: string;
  height: number | null;
  profession: string | null;
};

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string;
  city: string;
  image_url: string | null;
  total_places: number;
  remaining_places: number;
  price: number | null;
  created_at: string | null;
};

export type MatchRow = {
  id: string;
  user_1_id: string;
  user_2_id: string;
  created_at: string;
  updated_at: string | null;
  last_message: string | null;
  unread_count_user_1: number | null;
  unread_count_user_2: number | null;
};

export type MessageRow = {
  id: string;
  match_id: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean | null;
  created_at: string;
};

export type StoryRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
};

const fallbackPhoto = 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600';

function ageFromBirthdate(birthdate: string | null) {
  if (!birthdate) return 25;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return 25;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    user_id: row.id,
    display_name: row.full_name || 'Membre ARAS',
    age: ageFromBirthdate(row.birthdate),
    city: row.city || 'Ville non renseignée',
    bio: row.bio || '',
    photo_url: row.avatar_urls?.[0] || fallbackPhoto,
    interests: row.interests || [],
    profession: row.profession || '',
    is_verified: Boolean(row.is_verified),
    is_featured: Boolean(row.is_premium),
    created_at: row.created_at,
    gender: row.gender,
    birthdate: row.birthdate,
    zone: row.zone,
    avatar_urls: row.avatar_urls || [],
    is_online: Boolean(row.is_online),
    is_premium: Boolean(row.is_premium),
    last_seen_at: row.last_seen_at,
    height: row.height,
  };
}

export function toEvent(row: EventRow): EventItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    location: `${row.location}${row.city ? ` · ${row.city}` : ''}`,
    event_date: row.date,
    price_fcfa: Number(row.price || 0),
    capacity: row.remaining_places ?? row.total_places,
    image_url: row.image_url || 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=1200',
    category: 'Rencontre',
    is_featured: true,
  };
}

export function toConversation(row: MatchRow): Conversation {
  return {
    id: row.id,
    user_a: row.user_1_id,
    user_b: row.user_2_id,
    created_at: row.created_at,
    last_message: row.last_message,
    unread_count_user_1: row.unread_count_user_1 || 0,
    unread_count_user_2: row.unread_count_user_2 || 0,
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversation_id: row.match_id || '',
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    content: row.content,
    is_read: Boolean(row.is_read),
    created_at: row.created_at,
  };
}

export function toStory(row: StoryRow): Story {
  return {
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url,
    media_type: row.media_type as 'image' | 'video',
    caption: row.caption || undefined,
    created_at: row.created_at,
    expires_at: row.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_active: row.is_active !== undefined ? row.is_active : true,
  };
}
