
export interface StoryPanelData {
  id: string;
  type: "text" | "image" | "video" | "quote";
  title?: string;
  content?: string;
  media?: string; // URL or ID for images/videos
  altText?: string;
  caption?: string;
  slug?: string; // stable slug for deep-linking panels
  duration?: number; // in seconds
  orderIndex: number;
}

export interface Story {
  id: string;
  title: string;
  author: string;
  subtitle?: string;
  handle?: string;
  publishedAt: string;
  firstVisit?: string;
  lastVisit?: string;
  panels: StoryPanelData[];
  thumbnail?: string;
  thumbnailPanelId?: string; // Which panel to use as map marker
  rating?: number;
  // Optional shop category (e.g., Café, Glacier, Restaurant thaïlandais)
  category?: string;
  // Optional primary type label (legacy single-type field)
  type?: string;
  // Optional type labels (from types taxonomy)
  types?: string[];
  // Optional prize tags; UI shows up to 3 badges if present
  prizes?: Array<{
    id: string;
    name: string;
    slug?: string;
    iconUrl?: string;
    textColor?: string;
    bgColor?: string;
  }>;
  username?: string;
  avatarUrl?: string;
  tags?: string[];
  address?: string;
  description?: string;
  lists?: Array<{
    id: string;
    name: string;
    slug?: string;
    thumbnail?: string;
  }>;
  geo?: {
    lat: number;
    lng: number;
  };
}
