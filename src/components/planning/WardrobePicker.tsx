import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Input, LoadingState, Screen } from '@/components/ui';
import { ItemPhoto } from '@/components/wardrobe/ItemPhoto';
import { listWardrobe, wardrobePageSize } from '@/services/supabase/wardrobe';
import type { WardrobeItem } from '@/types/wardrobe';
import { theme } from '@/constants/theme';

export function WardrobePicker({ userId, selected, onDone, onCancel }: {
  userId: string; selected: WardrobeItem[]; onDone: (items: WardrobeItem[]) => void; onCancel: () => void;
}) {
  const [chosen, setChosen] = useState(selected);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  return <Modal animationType="slide" onRequestClose={onCancel}>
    <Screen scroll={false} bottomInset contentStyle={{ flex: 1, gap: 16 }}>
      <AppText variant="heading">Choose your starting pieces</AppText>
      <AppText muted>Pick one or more. You can also start with a blank canvas.</AppText>
      <Input label="Search wardrobe" placeholder="Name, brand or colour" value={search} onChangeText={setSearch} maxLength={100} />
      <Results key={`${userId}:${query}`} userId={userId} query={query} chosen={chosen} toggle={item => setChosen(previous => previous.some(entry => entry.id === item.id) ? previous.filter(entry => entry.id !== item.id) : [...previous, item])} />
      <Button label={`Use ${chosen.length} ${chosen.length === 1 ? 'piece' : 'pieces'}`} onPress={() => onDone(chosen)} />
      <View style={styles.actions}>
        <Button label="Skip" variant="ghost" onPress={() => onDone([])} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  </Modal>;
}
function Results({ userId, query, chosen, toggle }: { userId: string; query: string; chosen: WardrobeItem[]; toggle: (item: WardrobeItem) => void }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);
  const offset = useRef(0);
  const lock = useRef(false);
  const active = useRef(true);
  const load = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const rows = await listWardrobe(userId, { search: query, category: null, favourites: false }, offset.current);
      if (!active.current) return;
      offset.current += rows.length;
      setItems(previous => [...previous, ...rows.filter(row => !previous.some(item => item.id === row.id))]);
      setMore(rows.length === wardrobePageSize);
    } catch { if (active.current) setError(true); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  };
  useEffect(() => {
    active.current = true;
    void load();
    return () => { active.current = false; };
    // Remounted for each user/search; pagination shares the same query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <FlatList style={{ flex: 1 }} data={items} keyExtractor={item => item.id} extraData={chosen}
    keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
    renderItem={({ item }) => {
      const selected = chosen.some(entry => entry.id === item.id);
      return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={item.name}
        onPress={() => toggle(item)} style={[styles.item, selected && styles.selected]}>
        <View style={{ width: 56 }}><ItemPhoto uri={item.image_url} imagePath={item.image_path} name={item.name} /></View>
        <View style={{ flex: 1 }}><AppText>{item.name}</AppText><AppText variant="caption" muted>{item.brand ?? item.primary_colour ?? item.category}</AppText></View>
        <AppText>{selected ? '✓' : '+'}</AppText>
      </Pressable>;
    }}
    ListEmptyComponent={!busy && !error ? <AppText muted>{query ? 'No matching pieces. Try another search.' : 'Your wardrobe is empty. Add pieces in My Wardrobe, or skip for now.'}</AppText> : null}
    ListFooterComponent={busy ? <LoadingState label="Loading wardrobe…" /> : error ? <View><AppText accessibilityRole="alert">Couldn’t load your wardrobe.</AppText><Button label="Retry" variant="secondary" onPress={() => void load()} /></View> : more ? <Button label="Load more" variant="secondary" onPress={() => void load()} /> : null} />;
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.line },
  selected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
});
