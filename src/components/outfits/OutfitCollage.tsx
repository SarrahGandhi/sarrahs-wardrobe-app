import { StyleSheet, View } from 'react-native';
import { ItemPhoto } from '@/components/wardrobe/ItemPhoto';
import { AppText } from '@/components/ui';
import { theme } from '@/constants/theme';
import type { CompleteLook } from '@/types/outfit';
export function OutfitCollage({ entry }: { entry: CompleteLook }) {
  const parts = [...entry.look.items, ...entry.look.accessories];
  const clothing = parts.filter(part => {
    const item = entry.wardrobe.find(item => item.id === part.wardrobe_item_id);
    return item && ['top', 'bottom', 'dress', 'outerwear'].includes(item.category);
  });
  const finishing = parts.filter(part => !clothing.includes(part));
  const render = (part: typeof parts[number]) => {
    const item = entry.wardrobe.find(item => item.id === part.wardrobe_item_id);
    return <View key={part.wardrobe_item_id} style={styles.tile}>{item ? <ItemPhoto uri={item.image_url} imagePath={item.image_path} name={item.name} contain fill /> : <AppText variant="caption" muted>Piece unavailable</AppText>}</View>;
  };
  return <View style={styles.collage}>
    <View style={styles.clothing}>{clothing.map(render)}</View>
    {finishing.length ? <View style={styles.finishing}>{finishing.map(render)}</View> : null}
  </View>;
}
const styles = StyleSheet.create({
  collage: { height: 380, flexDirection: 'row', gap: 10, padding: 12, borderRadius: 24, backgroundColor: theme.colors.blush },
  clothing: { flex: 1.65, gap: 10 }, finishing: { flex: 1, gap: 10, justifyContent: 'center' },
  tile: { flex: 1, overflow: 'hidden', borderRadius: 20 },
});
