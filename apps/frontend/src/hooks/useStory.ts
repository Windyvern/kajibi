
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Story } from '@/types/story';

export const useStory = (storyId: string) => {
  return useQuery({
    queryKey: ['story', storyId],
    queryFn: async (): Promise<Story | null> => {
      console.log('Fetching story from Supabase:', storyId);
      
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .maybeSingle();

      if (storyError) {
        console.error('Error fetching story:', storyError);
        throw storyError;
      }

      if (!storyData) {
        console.log('Story not found:', storyId);
        return null;
      }

      console.log('Fetched story:', storyData);

      // Fetch panels for this story
      const { data: panelsData, error: panelsError } = await supabase
        .from('story_panels')
        .select('*')
        .eq('story_id', storyId)
        .order('order_index', { ascending: true });

      if (panelsError) {
        console.error('Error fetching panels:', panelsError);
        throw panelsError;
      }

      console.log('Fetched panels for story:', panelsData);

      // Transform database data to match our Story interface
      const story: Story = {
        id: storyData.id,
        title: storyData.title,
        author: storyData.author,
        subtitle: storyData.subtitle || undefined,
        handle: storyData.handle || undefined,
        publishedAt: storyData.published_at,
        thumbnail: storyData.thumbnail || undefined,
        thumbnailPanelId: storyData.thumbnail_panel_id || undefined,
        tags: storyData.tags || undefined,
        address: storyData.address || undefined,
        description: storyData.description || undefined,
        geo: storyData.latitude && storyData.longitude ? {
          lat: parseFloat(storyData.latitude.toString()),
          lng: parseFloat(storyData.longitude.toString())
        } : undefined,
        panels: panelsData.map(panel => ({
          id: panel.id,
          type: panel.type as "text" | "image" | "video" | "quote",
          title: panel.title || undefined,
          content: panel.content || undefined,
          media: panel.media || undefined,
          duration: panel.duration || undefined,
          orderIndex: panel.order_index
        }))
      };

      console.log('Transformed story:', story);
      return story;
    },
    enabled: !!storyId,
  });
};
