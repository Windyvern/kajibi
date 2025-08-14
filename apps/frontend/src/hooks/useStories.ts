
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Story } from '@/types/story';

export const useStories = () => {
  return useQuery({
    queryKey: ['stories'],
    queryFn: async (): Promise<Story[]> => {
      console.log('Fetching stories from Supabase...');
      
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .order('published_at', { ascending: false });

      if (storiesError) {
        console.error('Error fetching stories:', storiesError);
        throw storiesError;
      }

      console.log('Fetched stories:', storiesData);

      // Fetch panels for all stories
      const storyIds = storiesData.map(story => story.id);
      const { data: panelsData, error: panelsError } = await supabase
        .from('story_panels')
        .select('*')
        .in('story_id', storyIds)
        .order('order_index', { ascending: true });

      if (panelsError) {
        console.error('Error fetching panels:', panelsError);
        throw panelsError;
      }

      console.log('Fetched panels:', panelsData);

      // Transform database data to match our Story interface
      const stories: Story[] = storiesData.map(story => ({
        id: story.id,
        title: story.title,
        author: story.author,
        subtitle: story.subtitle || undefined,
        handle: story.handle || undefined,
        publishedAt: story.published_at,
        thumbnail: story.thumbnail || undefined,
        thumbnailPanelId: story.thumbnail_panel_id || undefined,
        tags: story.tags || undefined,
        address: story.address || undefined,
        description: story.description || undefined,
        geo: story.latitude && story.longitude ? {
          lat: parseFloat(story.latitude.toString()),
          lng: parseFloat(story.longitude.toString())
        } : undefined,
        panels: panelsData
          .filter(panel => panel.story_id === story.id)
          .map(panel => ({
            id: panel.id,
            type: panel.type as "text" | "image" | "video" | "quote",
            title: panel.title || undefined,
            content: panel.content || undefined,
            media: panel.media || undefined,
            duration: panel.duration || undefined,
            orderIndex: panel.order_index
          }))
      }));

      console.log('Transformed stories:', stories);
      return stories;
    },
  });
};
