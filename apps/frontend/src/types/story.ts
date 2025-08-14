
export interface StoryPanelData {
  id: string;
  type: "text" | "image" | "video" | "quote";
  title?: string;
  content?: string;
  media?: string; // URL or ID for images/videos
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
  panels: StoryPanelData[];
  thumbnail?: string;
  thumbnailPanelId?: string; // Which panel to use as map marker
  tags?: string[];
  address?: string;
  description?: string;
  geo?: {
    lat: number;
    lng: number;
  };
}
