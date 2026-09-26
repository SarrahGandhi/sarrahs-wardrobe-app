import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PageHeading } from '@/components/PageHeading';
import { AppText, Button, Chip, EmptyState, IconButton, Input, LoadingState, Screen } from '@/components/ui';
import { ItemPhoto } from '@/components/wardrobe/ItemPhoto';
import { useAuth } from '@/providers/AuthProvider';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { listWardrobe, updateWardrobeItem, wardrobeError, wardrobePageSize } from '@/services/supabase/wardrobe';
import { categories, categoryLabels, type WardrobeCategory, type WardrobeItem } from '@/types/wardrobe';

export function WardrobeScreen() {
  const { user } = useAuth();
  // Remount on account changes; never show another account's previous results.
  return user ? <WardrobeCollection key={user.id} userId={user.id} /> : null;
}
function WardrobeCollection({ userId }: { userId: string }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<WardrobeCategory | null>(null);
  const [favourites, setFavourites] = useState(false);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const pendingIds = useRef(new Set<string>());
  const generation = useRef(0);
  const fetching = useRef(false);
  const offset = useRef(0);
  const { wide, largeText } = useResponsiveLayout();
  const columns = largeText ? 1 : wide ? 3 : 2;
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async (reset: boolean) => {
    if (!reset && fetching.current) return;
    if (reset) { generation.current++; offset.current = 0; setItems([]); setMore(false); }
    const version = generation.current;
    fetching.current = true; setLoading(true); setError(null);
    try {
      const data = await listWardrobe(userId, { search: query, category, favourites }, offset.current);
      if (version !== generation.current) return;
      offset.current += data.length;
      setItems(previous => reset ? data : [...previous, ...data.filter(item => !previous.some(old => old.id === item.id))]);
      setMore(data.length === wardrobePageSize);
    } catch { if (version === generation.current) setError('Your wardrobe couldn’t load. Check your connection and retry.'); }
    finally { if (version === generation.current) { fetching.current = false; setLoading(false); } }
  }, [userId, query, category, favourites]);
  const latestLoad = useRef(load);
  const focused = useRef(false);
  useEffect(() => { latestLoad.current = load; }, [load]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load(true);
    return () => { focused.current = false; generation.current++; fetching.current = false; };
  }, [load]));
  async function favourite(item: WardrobeItem) {
    if (pendingIds.current.size) return;
    pendingIds.current.add(item.id); setPending([...pendingIds.current]);
    const version = generation.current;
    try {
      await updateWardrobeItem(userId, item.id, { favourite: !item.favourite });
      // Reload to keep pagination offsets correct when a favourite leaves the filter.
      if (focused.current) await latestLoad.current(true);
    } catch (e) { if (version === generation.current) setError(wardrobeError(e)); }
    finally { pendingIds.current.delete(item.id); setPending([...pendingIds.current]); }
  }
  const filtered = !!query || !!category || favourites;
  return <Screen scroll={false} contentStyle={styles.screen}>
    <FlatList key={columns} data={items} numColumns={columns} keyExtractor={item => item.id}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      columnWrapperStyle={columns > 1 ? styles.row : undefined} contentContainerStyle={styles.list}
      refreshing={loading && items.length === 0} onRefresh={() => void load(true)}
      ListHeaderComponent={<View style={styles.header}>
        <PageHeading eyebrow="THE COLLECTION" title="My wardrobe" description="Rediscover what you love to wear." />
        <Button label="Add Item" icon="add-outline" onPress={() => router.push("/add-clothing")} />
        <Input label="Search your wardrobe" placeholder="Name, brand or colour" value={search} onChangeText={setSearch} maxLength={120} returnKeyType="search" />
        <View style={styles.filters}><Chip label="All" selected={!category} onPress={() => setCategory(null)} />
          {categories.map(value => <Chip key={value} label={categoryLabels[value]} selected={category === value} onPress={() => setCategory(value)} />)}
          <Chip label="Favourites only" selected={favourites} onPress={() => setFavourites(v => !v)} />
        </View>
        {error ? <View><AppText accessibilityRole="alert">{error}</AppText><Button label="Retry" variant="ghost" onPress={() => void load(true)} /></View> : null}
      </View>}
      renderItem={({ item }) => <View style={{ width: `${100 / columns}%`, paddingHorizontal: 6, paddingBottom: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.name}`} onPress={() => router.push({ pathname: '/wardrobe-items/[id]', params: { id: item.id } })}>
          <ItemPhoto imagePath={item.image_path} uri={item.image_url} name={item.name} />
          <AppText numberOfLines={2} style={styles.name}>{item.name}</AppText>
        </Pressable>
        <IconButton icon={item.favourite ? 'heart' : 'heart-outline'} accessibilityLabel={`${item.favourite ? 'Remove' : 'Add'} ${item.name} ${item.favourite ? 'from' : 'to'} favourites`} disabled={pending.length > 0} onPress={() => void favourite(item)} style={styles.heart} />
      </View>}
      ListEmptyComponent={loading ? <LoadingState label="Loading your pieces…" /> : error ? null : <EmptyState icon="shirt-outline" title={filtered ? 'No matching pieces' : 'Your collection starts here'} description={filtered ? 'Try another search or clear your filters.' : 'Your wardrobe is empty. Your added pieces will appear here.'} action={filtered ? { label: 'Clear filters', onPress: () => { setSearch(''); setQuery(''); setCategory(null); setFavourites(false); } } : { label: 'Add Item', onPress: () => router.push('/add-clothing') }} />}
      ListFooterComponent={items.length ? loading ? <LoadingState label="Loading…" /> : more ? <Button label="Load more pieces" variant="secondary" onPress={() => void load(false)} /> : null : null}
    />
  </Screen>;
}
const styles = StyleSheet.create({ screen: { flex: 1, paddingBottom: 0, paddingTop: 0 }, list: { paddingTop: 24, paddingBottom: 32 }, header: { gap: 20, paddingBottom: 24 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, row: { marginHorizontal: -6 }, name: { paddingTop: 10, fontWeight: '600' }, heart: { position: 'absolute', top: 8, right: 14 }, });
