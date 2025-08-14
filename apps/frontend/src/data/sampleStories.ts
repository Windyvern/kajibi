
import { Story } from "@/types/story";

export const sampleStories: Story[] = [
  {
    id: "story-1",
    title: "Urban Photography Journey",
    author: "Alex Chen",
    handle: "@alex.photography",
    subtitle: "Street Photography Collective",
    publishedAt: "2024-01-15T10:00:00Z",
    thumbnail: "photo-1518770660439-4636190af475",
    thumbnailPanelId: "panel-2",
    tags: ["photography", "urban", "street", "art"],
    address: "SoHo, New York, NY",
    description: "Join me on a photographic journey through the heart of the metropolis, where every corner tells a story. This collection captures the raw energy and beauty of urban life, from the golden hour light painting buildings to the constant motion of city dwellers navigating their daily routines.",
    geo: {
      lat: 40.7236,
      lng: -74.0046
    },
    panels: [
      {
        id: "panel-1",
        type: "text",
        title: "Welcome to the City",
        content: "Join me on a photographic journey through the heart of the metropolis, where every corner tells a story.",
        duration: 6,
        orderIndex: 0
      },
      {
        id: "panel-2",
        type: "image",
        title: "Morning Light",
        content: "The city awakens as golden hour paints the buildings in warm hues.",
        media: "photo-1518770660439-4636190af475",
        duration: 8,
        orderIndex: 1
      },
      {
        id: "panel-3",
        type: "image",
        title: "Street Life",
        content: "Capturing the energy and movement of people navigating their daily routines.",
        media: "photo-1461749280684-dccba630e2f6",
        duration: 7,
        orderIndex: 2
      },
      {
        id: "panel-4",
        type: "quote",
        content: "In every walk with nature, one receives far more than they seek.",
        title: "John Muir",
        duration: 5,
        orderIndex: 3
      },
      {
        id: "panel-5",
        type: "image",
        title: "Reflections",
        content: "Architecture creates beautiful patterns when reflected in glass and water.",
        media: "photo-1518005020951-eccb494ad742",
        duration: 6,
        orderIndex: 4
      }
    ]
  },
  {
    id: "story-2",
    title: "Tech Innovation Spotlight",
    author: "Sarah Martinez",
    handle: "@sarah.tech",
    subtitle: "Innovation Reporter",
    publishedAt: "2024-01-20T14:30:00Z",
    thumbnail: "photo-1488590528505-98d2b5aba04b",
    thumbnailPanelId: "panel-7",
    tags: ["technology", "innovation", "startup", "future"],
    address: "Silicon Valley, CA",
    description: "Exploring breakthrough technologies that are reshaping our world and daily experiences. From AI-powered solutions to sustainable tech innovations, discover the cutting-edge developments that will define our future.",
    geo: {
      lat: 37.4419,
      lng: -122.1430
    },
    panels: [
      {
        id: "panel-6",
        type: "text",
        title: "The Future is Here",
        content: "Exploring breakthrough technologies that are reshaping our world and daily experiences.",
        duration: 5,
        orderIndex: 0
      },
      {
        id: "panel-7",
        type: "image",
        title: "Digital Workspace",
        content: "Modern technology enables seamless collaboration across global teams.",
        media: "photo-1488590528505-98d2b5aba04b",
        duration: 7,
        orderIndex: 1
      },
      {
        id: "panel-8",
        type: "image",
        title: "Innovation Hub",
        content: "Where creativity meets technology to solve tomorrow's challenges.",
        media: "photo-1581091226825-a6a2a5aee158",
        duration: 6,
        orderIndex: 2
      },
      {
        id: "panel-9",
        type: "text",
        title: "Looking Forward",
        content: "The intersection of artificial intelligence and human creativity opens unlimited possibilities.",
        duration: 8,
        orderIndex: 3
      }
    ]
  },
  {
    id: "story-3",
    title: "Nature's Tranquility",
    author: "Emma Thompson",
    handle: "@emma.nature",
    subtitle: "Landscape Photographer",
    publishedAt: "2024-01-25T09:15:00Z",
    thumbnail: "photo-1500673922987-e212871fec22",
    thumbnailPanelId: "panel-10",
    tags: ["nature", "landscape", "peaceful", "meditation"],
    address: "Yosemite National Park, CA",
    description: "Find peace in the gentle rhythm of nature's own meditation. This collection captures serene moments in some of the world's most beautiful natural settings, reminding us to slow down and appreciate the world around us.",
    geo: {
      lat: 37.8651,
      lng: -119.5383
    },
    panels: [
      {
        id: "panel-10",
        type: "image",
        title: "Serene Waters",
        content: "Find peace in the gentle rhythm of nature's own meditation.",
        media: "photo-1500673922987-e212871fec22",
        duration: 10,
        orderIndex: 0
      },
      {
        id: "panel-11",
        type: "quote",
        content: "Nature does not hurry, yet everything is accomplished.",
        title: "Lao Tzu",
        duration: 6,
        orderIndex: 1
      },
      {
        id: "panel-12",
        type: "text",
        title: "Mindful Moments",
        content: "In nature's embrace, we rediscover the rhythm of our own hearts and the clarity of our minds.",
        duration: 7,
        orderIndex: 2
      }
    ]
  }
];
