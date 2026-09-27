import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { PageHeading } from '@/components/PageHeading';
import { AppText, Button, EmptyState, LoadingState, Screen } from '@/components/ui';
import { OutfitCollage } from '@/components/outfits/OutfitCollage';
import { useAuth } from '@/providers/AuthProvider';
import { listSavedLooks } from '@/services/supabase/savedLooks';
import type { CompleteLook } from '@/types/outfit';
export function SavedScreen() {
  const { user } = useAuth();
  const [looks, setLooks] = useState<CompleteLook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!user) return;
    void retry; // Re-run the focused read after an explicit retry.
    let active = true;
    setLoading(true); setError(false);
    void listSavedLooks(user.id).then(entries => { if (active) setLooks(entries); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, retry]));
  return <Screen>
    <PageHeading eyebrow="THE LOOKBOOK" title="Worth repeating" description="Your wardrobe. Your favourite combinations." />
    {loading ? <LoadingState label="Opening your lookbook…" /> : error ? <><AppText accessibilityRole="alert">Couldn’t load your saved looks.</AppText><Button label="Try again" onPress={() => setRetry(value => value + 1)} /></> : looks.length ? <View style={styles.list}>{looks.map(entry => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Open saved ${entry.look.title}`} onPress={() => router.push({ pathname: '/complete-look/[id]', params: { id: entry.id } })} style={styles.card}>
      <OutfitCollage entry={entry} /><AppText variant="heading">{entry.look.title}</AppText><AppText variant="caption" muted>{entry.draft.occasion} · View complete look ↗</AppText>
    </Pressable>)}</View> : <EmptyState icon="bookmark-outline" title="Keep a good look" description="Save an outfit you love and find it here, ready to wear again." action={{ label: 'Plan an outfit', onPress: () => router.push('/plan') }} />}
  </Screen>;
}
const styles = StyleSheet.create({ list: { gap: 28 }, card: { gap: 10 } });
