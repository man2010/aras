export type Profile = {
  id: string;
  user_id: string | null;
  display_name: string;
  age: number;
  city: string;
  bio: string;
  photo_url: string;
  interests: string[];
  profession: string;
  is_verified: boolean;
  is_featured: boolean;
  created_at: string;
  gender?: string | null;
  birthdate?: string | null;
  zone?: string | null;
  avatar_urls?: string[];
  is_online?: boolean;
  is_premium?: boolean;
  last_seen_at?: string | null;
  height?: number | null;
};

export type EventItem = {
  id: string;
  title: string;
  description: string;
  location: string;
  event_date: string;
  price_fcfa: number;
  capacity: number;
  image_url: string;
  category: string;
  is_featured: boolean;
};

export type Testimonial = {
  id: string;
  author_name: string;
  author_photo: string;
  couple_photo: string;
  story: string;
  city: string;
  relationship_duration: string;
};

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  last_message?: string | null;
  unread_count_user_1?: number;
  unread_count_user_2?: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  is_read?: boolean;
  created_at: string;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
};
