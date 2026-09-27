import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, IconButton, Screen } from '@/components/ui';
import { PageHeading } from '@/components/PageHeading';
import { OutfitCollage } from './OutfitCollage';
import { theme } from '@/constants/theme';
import type { CompleteLook } from '@/types/outfit';
export function OutfitResults({ entries, onEdit, onRegenerate, busy, error }: { entries: CompleteLook[]; onEdit: () => void; onRegenerate: () => void; busy: boolean; error: string | null }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const cardWidth = Math.max(1, width - 22);
  const step = cardWidth + 12;
  const select = (next: number) => { setIndex(next); scroll.current?.scrollTo({ x: next * step, animated: true }); };
  return <Screen>
    <PageHeading eyebrow="STYLED FOR YOU" title="Three ways to wear it" description={entries[0]?.draft.occasion ?? ''} />
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? <ScrollView key={width} ref={scroll} horizontal snapToInterval={step} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track} onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(entries.length - 1, Math.round(event.nativeEvent.contentOffset.x / step))))}>
        {entries.map((entry, position) => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Open ${entry.look.title}, look ${position + 1} of 3`} onPress={() => router.push({ pathname: '/complete-look/[id]', params: { id: entry.id } })} style={({ pressed }) => [styles.card, { width: cardWidth, opacity: pressed ? 0.8 : 1 }]}>
          <OutfitCollage entry={entry} />
          <View style={styles.caption}><AppText variant="eyebrow" muted>0{position + 1} / YOUR WARDROBE</AppText><AppText variant="heading">{entry.look.title}</AppText><AppText variant="caption" muted>View the complete look ↗</AppText></View>
        </Pressable>)}
      </ScrollView> : null}
    </View>
    <View style={styles.pagination}>
      <IconButton icon="chevron-back" accessibilityLabel="Previous outfit" disabled={index === 0} onPress={() => select(index - 1)} />
      <AppText variant="caption" accessibilityLiveRegion="polite">{index + 1} / {entries.length} · Swipe to explore</AppText>
      <IconButton icon="chevron-forward" accessibilityLabel="Next outfit" disabled={index === entries.length - 1} onPress={() => select(index + 1)} />
    </View>
    {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    <Button label={busy ? 'Styling new looks…' : 'Another Look'} loading={busy} onPress={onRegenerate} icon="refresh-outline" />
    <Button label="Change Something" variant="ghost" disabled={busy} onPress={onEdit} />
  </Screen>;
}
const styles = StyleSheet.create({ track: { gap: 12, paddingRight: 22 }, card: { borderRadius: 28, padding: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }, caption: { padding: 14, gap: 6 }, pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } });
