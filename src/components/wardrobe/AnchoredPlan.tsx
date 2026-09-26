import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { AppText, Button, Card, EmptyState, Input, LoadingState } from '@/components/ui';
import { ItemPhoto } from './ItemPhoto';
import { useWardrobeItem } from '@/hooks/useWardrobeItem';
import { saveAnchoredPlan } from '@/services/supabase/wardrobe';

export function AnchoredPlan({ id, userId }: { id: string; userId: string }) {
  const { item, error, loading, retry } = useWardrobeItem(id);
  const [occasion, setOccasion] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  if (loading) return <LoadingState label="Loading your starting piece…" />;
  if (error || !item) return <EmptyState icon="shirt-outline" title="Starting piece unavailable" description="Refresh or choose another piece from your wardrobe." action={{ label: 'Retry', onPress: retry }} />;
  return <Card>
    <AppText variant="eyebrow">BUILD AROUND THIS PIECE</AppText>
    <ItemPhoto imagePath={item.image_path} uri={item.image_url} name={item.name} />
    <AppText variant="heading">{item.name}</AppText>
    <Input label="Occasion" placeholder="Coffee with friends" value={occasion} onChangeText={value => { setOccasion(value); setMessage(null); }} maxLength={200} editable={!busy} />
    <Input label="What do you have in mind?" value={instructions} onChangeText={value => { setInstructions(value); setMessage(null); }} maxLength={4000} multiline editable={!busy} />
    {failure ? <AppText accessibilityRole="alert">{failure}</AppText> : null}
    {message ? <AppText accessibilityLiveRegion="polite">{message}</AppText> : null}
    <Button label="Save outfit brief" loading={busy} disabled={!!message} onPress={() => {
      if (lock.current) return;
      if (!occasion.trim()) { setFailure('Add an occasion for your outfit.'); return; }
      lock.current = true; setBusy(true); setFailure(null);
      void saveAnchoredPlan(userId, id, occasion, instructions).then(() => setMessage('Your brief is saved with this piece as its starting point. Outfit generation is coming soon.'))
        .catch(() => setFailure('Your brief couldn’t be saved. Check your connection and make sure the piece is still in your wardrobe.'))
        .finally(() => { lock.current = false; setBusy(false); });
    }} />
    <Button label="Choose another piece" variant="ghost" disabled={busy} onPress={() => router.push('/wardrobe')} />
  </Card>;
}
