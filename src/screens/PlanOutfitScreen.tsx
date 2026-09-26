import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { PageHeading } from '@/components/PageHeading';
import { AppText, Button, Card, Chip, Input, Screen } from '@/components/ui';
import { WardrobePicker } from '@/components/planning/WardrobePicker';
import { getWardrobeItem } from '@/services/supabase/wardrobe';
import { recommendOutfits, type OutfitResult } from '@/services/supabase/outfitRecommendations';
import { saveOutfitPlan } from '@/services/supabase/outfitPlans';
import { occasions, preferenceChips, planInputs, type PlanDraft } from '@/utils/outfitPlan';
import type { WardrobeItem } from '@/types/wardrobe';

export function PlanOutfitScreen() {
  const { anchorItemId } = useLocalSearchParams<{ anchorItemId?: string }>();
  const { user } = useAuth();
  return user ? <PlanForm key={`${user.id}:${anchorItemId ?? ''}`} userId={user.id} anchorItemId={anchorItemId} /> : null;
}
function PlanForm({ userId, anchorItemId }: { userId: string; anchorItemId?: string }) {
  const [draft, setDraft] = useState<PlanDraft>({ occasion: '', description: '', temperature: '', condition: '', setting: null, instructions: '', preferences: [] });
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolvedAnchor, setResolvedAnchor] = useState<string | null>(null);
  const anchorLoading = !!anchorItemId && resolvedAnchor !== anchorItemId;
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<OutfitResult | null>(null);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const requestId = useRef<string | null>(null);
  const lock = useRef(false);
  const edited = () => { requestId.current = null; setSaved(false); setResult(null); setError(null); };
  const update = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => { edited(); setDraft(previous => ({ ...previous, [key]: value })); };
  useEffect(() => {
    if (!anchorItemId) return;
    let active = true;
    void getWardrobeItem(userId, anchorItemId).then(item => {
      if (!active) return;
      if (!item) throw new Error('Unavailable');
      setItems(previous => previous.some(entry => entry.id === item.id) ? previous : [...previous, item]);
      requestId.current = null; setSaved(false); setAnchorError(null);
    }).catch(() => { if (active) setAnchorError('That starting piece is unavailable. Choose another piece or skip.'); })
      .finally(() => { if (active) setResolvedAnchor(anchorItemId); });
    return () => { active = false; };
  }, [userId, anchorItemId]);
  const submit = async () => {
    if (lock.current || saved) return;
    try { planInputs(draft); } catch (failure) { setError((failure as Error).message); return; }
    lock.current = true; setBusy(true); setError(null); setResult(null);
    try {
      controller.current?.abort();
      const active = new AbortController(); controller.current = active;
      requestId.current ??= randomUUID();
      await saveOutfitPlan(requestId.current, draft, items.map(item => item.id));
      const generated = await recommendOutfits(userId, draft, items.map(item => item.id), active.signal);
      if (!active.signal.aborted) { setResult(generated.result); setWardrobe(generated.wardrobe); setSaved(generated.result.status === 'ok'); }
    }
    catch (failure) { if (!controller.current?.signal.aborted) setError(failure instanceof Error ? failure.message : 'We couldn’t generate outfits. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const changeItems = (chosen: WardrobeItem[]) => { edited(); setItems(chosen); setAnchorError(null); setPicker(false); };
  return <Screen>
    <PageHeading eyebrow="PLAN AN OUTFIT" title="What’s the occasion?" description="A little direction is all we need. Only the occasion is required." />
    <View style={styles.section}>
      <AppText variant="heading">Occasion</AppText>
      <View style={styles.chips}>{occasions.map(label => <Chip key={label} label={label} selected={draft.occasion === label} disabled={busy} onPress={() => update('occasion', label)} />)}</View>
      <Input label={draft.occasion === 'Other' ? 'Describe the occasion · required' : 'A little more about it · optional'} placeholder="A relaxed dinner by the sea" value={draft.description} onChangeText={value => update('description', value)} maxLength={180} editable={!busy} />
    </View>
    <View style={styles.section}>
      <AppText variant="heading">Weather <AppText muted>· optional</AppText></AppText>
      <Input label="Temperature (°C)" placeholder="e.g. 22 or −5" value={draft.temperature} onChangeText={value => update('temperature', value)} maxLength={7} editable={!busy} />
      <Input label="Condition" placeholder="Sunny, rainy, breezy…" value={draft.condition} onChangeText={value => update('condition', value)} maxLength={500} editable={!busy} />
      <View style={styles.chips}>{(['indoor', 'outdoor', 'both'] as const).map(value => <Chip key={value} label={{ indoor: 'Indoor', outdoor: 'Outdoor', both: 'Both' }[value]} selected={draft.setting === value} disabled={busy} onPress={() => update('setting', draft.setting === value ? null : value)} />)}</View>
    </View>
    <View style={styles.section}>
      <AppText variant="heading">What feels like you?</AppText>
      <Input label="Preferences · optional" placeholder="Tell me what you're thinking..." hint={'“I want to wear jeans.” “No heels.” “Something feminine.” “Use my black boots.”'} multiline value={draft.instructions} onChangeText={value => update('instructions', value)} maxLength={4000} editable={!busy} />
      <View style={styles.chips}>{preferenceChips.map(label => <Chip key={label} label={label} selected={draft.preferences.includes(label)} disabled={busy} onPress={() => update('preferences', draft.preferences.includes(label) ? draft.preferences.filter(value => value !== label) : [...draft.preferences, label])} />)}</View>
    </View>
    <View style={styles.section}>
      <AppText variant="heading">Start with a favourite</AppText>
      <AppText muted>Have a piece in mind? Choose one or more, or skip.</AppText>
      {anchorLoading ? <AppText accessibilityLiveRegion="polite">Loading starting piece…</AppText> : null}
      {anchorError ? <AppText accessibilityRole="alert">{anchorError}</AppText> : null}
      <View style={styles.chips}>{items.map(item => <Chip key={item.id} label={`${item.name} ×`} selected disabled={busy} onPress={() => changeItems(items.filter(entry => entry.id !== item.id))} />)}</View>
      <Button label="Choose something from my wardrobe" variant="secondary" disabled={busy || anchorLoading} onPress={() => setPicker(true)} />
      <Button label="Skip" variant="ghost" disabled={busy || anchorLoading} onPress={() => changeItems([])} />
    </View>
    <View style={styles.section}>
      {error ? <AppText accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</AppText> : null}
      {result?.status === 'impossible' ? <Card><AppText variant="heading">Let’s adjust the plan</AppText><AppText accessibilityLiveRegion="polite">{result.reason}</AppText></Card> : null}
      {result?.recommendations.map(look => <Card key={look.title}>
        <AppText variant="heading">{look.title}</AppText>
        {look.items.map(part => <AppText key={part.wardrobe_item_id}>{wardrobe.find(item => item.id === part.wardrobe_item_id)?.name} · {part.role}</AppText>)}
        <AppText variant="heading">Accessories</AppText>
        {look.accessories.length ? look.accessories.map(part => <AppText key={part.wardrobe_item_id}>{wardrobe.find(item => item.id === part.wardrobe_item_id)?.name} · {part.role}</AppText>) : <AppText muted>Keep it simple — no accessories.</AppText>}
        <AppText>Hair · {look.hairstyle}</AppText>
        <AppText>Makeup · {look.makeup}</AppText>
        <AppText>{look.why_this_works}</AppText>
      </Card>)}
      <Button label={busy ? 'Styling your outfits…' : 'Style Me'} icon="sparkles-outline" style={{ minHeight: 60 }} loading={busy} disabled={saved || anchorLoading} onPress={() => void submit()} />
      <AppText variant="caption" muted>Three ways to wear your wardrobe, styled around your requirements.</AppText>
    </View>
    {picker ? <WardrobePicker userId={userId} selected={items} onDone={changeItems} onCancel={() => setPicker(false)} /> : null}
  </Screen>;
}
const styles = StyleSheet.create({ section: { gap: 14 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
