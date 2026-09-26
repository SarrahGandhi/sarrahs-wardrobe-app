import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText, Button, Chip, Input } from '@/components/ui';
import { categories, categoryLabels, fits, formalities, seasons, sleeves, type WardrobeEdit, type WardrobeItem } from '@/types/wardrobe';
import { attributeLabel, itemDraft, parseWardrobeDraft, textFields } from '@/utils/wardrobeForm';

export function ItemEditor({ item, busy, onSave, onCancel, creating = false }: { creating?: boolean; item: WardrobeItem; busy: boolean; onSave: (changes: WardrobeEdit) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(() => itemDraft(item));
  const [category, setCategory] = useState(item.category);
  const [fit, setFit] = useState(item.fit);
  const [formality, setFormality] = useState(item.formality);
  const [sleeve, setSleeve] = useState(item.sleeve_length);
  const [season, setSeason] = useState(item.season);
  const [favourite, setFavourite] = useState(item.favourite);
  const [error, setError] = useState<string | null>(null);
  return <View style={styles.form}>
    <AppText variant="heading">{creating ? "Item details" : "Edit your piece"}</AppText>
    {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    {textFields.filter(([key]) => creating ? ['name', 'brand', 'subcategory', 'primary_colour', 'secondary_colours', 'material', 'style_tags'].includes(key) : !(item.image_path && key === 'image_url')).map(([key, label, max]) => <Input key={key} label={label} value={draft[key]} maxLength={max} editable={!busy}
      keyboardType={key === 'warmth_level' ? 'number-pad' : key.endsWith('_url') ? 'url' : 'default'}
      autoCapitalize={key.endsWith('_url') ? 'none' : 'sentences'} autoCorrect={!key.endsWith('_url')}
      hint={['secondary_colours', 'material', 'style_tags'].includes(key) ? 'Separate values with commas.' : undefined}
      onChangeText={value => setDraft(current => ({ ...current, [key]: value }))} />)}
    <Choices label="Category" values={categories} selected={category} onSelect={value => setCategory(value!)} busy={busy} labels={categoryLabels} />
    <Choices label="Fit" values={fits} selected={fit} onSelect={setFit} busy={busy} optional />
    <Choices label="Formality" values={formalities} selected={formality} onSelect={setFormality} busy={busy} optional />
    <Choices label="Sleeve length" values={sleeves} selected={sleeve} onSelect={setSleeve} busy={busy} optional />
    <AppText>Seasons · select all that apply</AppText>
    <View style={styles.choices}>{seasons.map(value => <Chip key={value} label={attributeLabel(value)} disabled={busy} selected={season.includes(value)} onPress={() => setSeason(current => current.includes(value) ? current.filter(v => v !== value) : [...current, value])} />)}</View>
    <Chip label="Favourite" selected={favourite} disabled={busy} onPress={() => setFavourite(value => !value)} />
    <Button label={creating ? "Save to wardrobe" : "Save changes"} loading={busy} onPress={() => {
      try { const fields = parseWardrobeDraft(draft); setError(null); onSave({ ...fields, category, fit, formality, sleeve_length: sleeve, season, favourite }); }
      catch (e) { setError(e instanceof Error ? e.message : 'Check your entries.'); }
    }} />
    <Button label={creating ? "Back to photo" : "Cancel editing"} variant="ghost" disabled={busy} onPress={onCancel} />
  </View>;
}
function Choices<T extends string>({ label, values, selected, onSelect, busy, optional, labels }: { label: string; values: readonly T[]; selected: T | null; onSelect: (value: T | null) => void; busy: boolean; optional?: boolean; labels?: Record<T, string> }) {
  return <View style={styles.form}><AppText>{label}</AppText><View style={styles.choices}>
    {optional ? <Chip label="Not specified" selected={selected === null} disabled={busy} onPress={() => onSelect(null)} /> : null}
    {values.map(value => <Chip key={value} label={labels?.[value] ?? attributeLabel(value)} selected={selected === value} disabled={busy} onPress={() => onSelect(value)} />)}
  </View></View>;
}
const styles = StyleSheet.create({ form: { gap: 16 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
