import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, EmptyState, IconButton, LoadingState, Screen } from '@/components/ui';
import { OutfitCollage } from '@/components/outfits/OutfitCollage';
import { ItemPhoto } from '@/components/wardrobe/ItemPhoto';
import { useOutfits } from '@/providers/OutfitProvider';
import { useAuth } from '@/providers/AuthProvider';
import { listSavedLooks, saveLook } from '@/services/supabase/savedLooks';
import type { CompleteLook } from '@/types/outfit';
import type { WardrobeCategory } from '@/types/wardrobe';
const groups: { label: string; categories: WardrobeCategory[] }[] = [
  { label: 'The clothing', categories: ['top', 'bottom', 'dress', 'outerwear'] },
  { label: 'Shoes', categories: ['shoes'] }, { label: 'Bag', categories: ['bag'] },
  { label: 'Jewellery & accessories', categories: ['jewellery', 'accessory'] },
];
export function CompleteLookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LookDetail key={id} id={id} />;
}
function LookDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const outfits = useOutfits();
  const [loaded, setLoaded] = useState<CompleteLook | null>(null);
  const cached = outfits.entries.find(entry => entry.id === id);
  const entry = cached ?? loaded;
  const [loading, setLoading] = useState(!cached);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (cached || !user) return;
    let active = true;
    void listSavedLooks(user.id).then(entries => { if (active) setLoaded(entries.find(look => look.id === id) ?? null); })
      .catch(() => { if (active) setError('Couldn’t load this look. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cached, id, user, retry]);
  const back = () => router.canGoBack() ? router.back() : router.replace('/saved');
  const save = async () => {
    if (!entry || !user || lock.current || entry.saved) return;
    lock.current = true; setBusy(true); setError(null);
    try { await saveLook(user.id, entry); outfits.markSaved(entry.id); setLoaded({ ...entry, saved: true }); }
    catch { setError('Couldn’t save your look. Check your connection and try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const edit = () => { if (entry) { outfits.requestEdit(entry); router.dismissTo({ pathname: '/plan', params: { anchorItemId: '' } }); } };
  const another = () => {
    const alternatives = outfits.entries.filter(look => look.planId === entry?.planId);
    const next = alternatives[(alternatives.findIndex(look => look.id === id) + 1) % alternatives.length];
    if (next && next.id !== id) router.replace({ pathname: '/complete-look/[id]', params: { id: next.id } });
    else edit();
  };
  const parts = entry ? [...entry.look.items, ...entry.look.accessories] : [];
  return <Screen bottomInset>
    <View style={styles.top}><IconButton icon="arrow-back" accessibilityLabel="Back to outfits" onPress={back} /><AppText variant="eyebrow">COMPLETE LOOK</AppText><View style={{ width: 48 }} /></View>
    {loading ? <LoadingState label="Opening your look…" /> : entry ? <>
      <View style={styles.heading}><AppText variant="caption" muted>{entry.draft.occasion}</AppText><AppText variant="title">{entry.look.title}</AppText></View>
      <OutfitCollage entry={entry} />
      <Button label={entry.saved ? 'Look Saved' : 'Save Look'} icon={entry.saved ? 'bookmark' : 'bookmark-outline'} disabled={entry.saved} loading={busy} onPress={() => void save()} />
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      {entry.saved ? <AppText variant="caption" accessibilityLiveRegion="polite" muted>Saved to your lookbook.</AppText> : null}
      {groups.map(group => {
        const items = parts.flatMap(part => {
          const item = entry.wardrobe.find(item => item.id === part.wardrobe_item_id);
          return item && group.categories.includes(item.category) ? [item] : [];
        });
        return <View key={group.label} style={styles.section}><AppText variant="heading">{group.label}</AppText>
          {items.length ? items.map(item => <View key={item.id} style={styles.item}><View style={styles.thumbnail}><ItemPhoto uri={item.image_url} imagePath={item.image_path} name={item.name} contain /></View><AppText style={styles.itemName}>{item.name}</AppText></View>) : <AppText muted variant="caption">None needed for this look.</AppText>}
        </View>;
      })}
      {parts.some(part => !entry.wardrobe.some(item => item.id === part.wardrobe_item_id)) ? <AppText muted>Some wardrobe pieces are no longer available.</AppText> : null}
      <Card><AppText variant="eyebrow" muted>FINISHING TOUCHES</AppText><AppText variant="heading">Hairstyle</AppText><AppText>{entry.look.hairstyle}</AppText><AppText variant="heading">Makeup</AppText><AppText>{entry.look.makeup}</AppText></Card>
      <Card><AppText variant="heading">Why this works</AppText><AppText muted>{entry.look.why_this_works}</AppText></Card>
      <Button label="Change Something" variant="secondary" disabled={busy} onPress={edit} />
      <Button label="Another Look" variant="ghost" icon="refresh-outline" disabled={busy} onPress={another} />
    </> : <EmptyState icon="bookmark-outline" title="Look unavailable" description={error ?? 'Generate a new outfit to find your next favourite.'} action={{ label: error ? 'Try again' : 'Plan an outfit', onPress: () => { if (error) { setLoading(true); setError(null); setRetry(value => value + 1); } else router.replace('/plan'); } }} />}
  </Screen>;
}
const styles = StyleSheet.create({ top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { gap: 6 }, section: { gap: 12 }, item: { flexDirection: 'row', alignItems: 'center', gap: 16 }, thumbnail: { width: 64 }, itemName: { flex: 1 } });
