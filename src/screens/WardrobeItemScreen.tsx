import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, Button, Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { ItemPhoto } from '@/components/wardrobe/ItemPhoto';
import { ItemEditor } from '@/components/wardrobe/ItemEditor';
import { useAuth } from '@/providers/AuthProvider';
import { useWardrobeItem } from '@/hooks/useWardrobeItem';
import { deleteWardrobeItem, updateWardrobeItem, wardrobeError } from '@/services/supabase/wardrobe';
import { attributeLabel, textFields } from '@/utils/wardrobeForm';
import { categoryLabels, type WardrobeEdit, type WardrobeItem } from '@/types/wardrobe';

export function WardrobeItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return user ? <ItemDetail key={`${user.id}:${id}`} userId={user.id} id={typeof id === 'string' ? id : ''} /> : null;
}
function ItemDetail({ id, userId }: { id: string; userId: string }) {
  const resource = useWardrobeItem(id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const back = () => router.canGoBack() ? router.back() : router.replace('/wardrobe');
  async function update(changes: Partial<WardrobeEdit>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setMessage(null);
    try { resource.replace(await updateWardrobeItem(userId, id, changes)); setEditing(false); setMessage('Changes saved.'); }
    catch (e) { setError(wardrobeError(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await deleteWardrobeItem(userId, id); router.replace('/wardrobe'); }
    catch (e) { setError(wardrobeError(e)); setConfirmDelete(false); }
    finally { lock.current = false; setBusy(false); }
  }
  const item = resource.item;
  return <Screen bottomInset>
    <Button label="Back to wardrobe" variant="ghost" disabled={busy} onPress={back} />
    {resource.loading ? <LoadingState label="Loading your piece…" /> : resource.error ? <EmptyState icon="cloud-offline-outline" title="Couldn’t load this piece" description="Check your connection and try again." action={{ label: 'Retry', onPress: resource.retry }} /> : !item ? <EmptyState icon="shirt-outline" title="Piece unavailable" description="It may have been removed or isn’t part of your wardrobe." /> : <>
      <AppText variant="title">{item.name}</AppText>
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      {message ? <AppText accessibilityLiveRegion="polite">{message}</AppText> : null}
      {editing ? <ItemEditor item={item} busy={busy} onSave={changes => void update(changes)} onCancel={() => { setEditing(false); setError(null); }} /> : <>
        <ItemPhoto imagePath={item.image_path} uri={item.image_url} name={item.name} />
        <Button label={item.favourite ? 'Remove from favourites' : 'Add to favourites'} icon={item.favourite ? 'heart' : 'heart-outline'} variant="secondary" disabled={busy} onPress={() => void update({ favourite: !item.favourite })} />
        <Card>
          <Attribute label="Category" value={categoryLabels[item.category]} />
          {textFields.filter(([key]) => key !== 'name' && key !== 'image_url').map(([key, label]) => <Attribute key={key} label={label} value={item[key]} />)}
          {(['fit', 'season', 'formality', 'sleeve_length'] as const).map(key => <Attribute key={key} label={attributeLabel(key)} value={item[key]} />)}
          <Attribute label="Added" value={new Date(item.created_at).toLocaleDateString()} />
          <Attribute label="Updated" value={new Date(item.updated_at).toLocaleDateString()} />
        </Card>
        <Button label="Build an outfit around this" disabled={busy} onPress={() => router.push({ pathname: '/plan', params: { anchorItemId: id } })} />
        <Button label="Edit" variant="secondary" disabled={busy} onPress={() => { setEditing(true); setConfirmDelete(false); setMessage(null); }} />
        {confirmDelete ? <Card>
          <AppText variant="heading">Delete this piece?</AppText>
          <AppText>This permanently removes it from your wardrobe. This cannot be undone.</AppText>
          <Button label="Delete permanently" loading={busy} onPress={() => void remove()} />
          <Button label="Keep piece" variant="ghost" disabled={busy} onPress={() => setConfirmDelete(false)} />
        </Card> : <Button label="Delete" variant="ghost" disabled={busy} onPress={() => { setError(null); setMessage(null); setConfirmDelete(true); }} />}
      </>}
    </>}
  </Screen>;
}
function Attribute({ label, value }: { label: string; value: WardrobeItem[keyof WardrobeItem] }) {
  const content = Array.isArray(value) ? value.map(attributeLabel).join(', ') : value === null || value === '' ? 'Not specified' : String(value);
  return <View style={styles.attribute}><AppText variant="caption" muted>{label}</AppText><AppText selectable>{content || 'Not specified'}</AppText></View>;
}
const styles = StyleSheet.create({ attribute: { gap: 3, paddingVertical: 6 } });
