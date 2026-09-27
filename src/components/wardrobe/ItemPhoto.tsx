import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppText } from '@/components/ui';
import { theme } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { wardrobePhotoUrl } from '@/services/supabase/wardrobeImages';

export function ItemPhoto({ uri, name, imagePath, contain = false, fill = false }: { fill?: boolean; contain?: boolean; uri: string | null; name: string; imagePath?: string | null }) {
  const { user } = useAuth();
  if (imagePath) return user ? <PrivatePhoto key={`${user.id}:${imagePath}`} userId={user.id} path={imagePath} name={name} contain={contain} fill={fill} /> : <Photo uri={null} name={name} contain={contain} fill={fill} />;
  return <Photo key={uri} uri={uri} name={name} contain={contain} fill={fill} />;
}
function PrivatePhoto({ userId, path, name, contain, fill }: { fill: boolean; contain: boolean; userId: string; path: string; name: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => {
      void wardrobePhotoUrl(userId, path).then(url => { if (active) setUri(url); })
        .catch(() => { if (active) setUri(null); })
        .finally(() => { if (active) setLoading(false); });
    };
    refresh();
    // Signed links expire after 10 minutes; refresh while visible and on refocus.
    const timer = setInterval(refresh, 8 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [userId, path]));
  return <Photo key={uri} uri={uri} name={name} loading={loading} contain={contain} fill={fill} />;
}
function Photo({ uri, name, loading = false, contain = false, fill = false }: { fill?: boolean; contain?: boolean; uri: string | null; name: string; loading?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <View style={[styles.photo, fill && styles.fill]}>
    {loading ? <ActivityIndicator accessibilityLabel="Loading photo" color={theme.colors.accent} /> : uri && !failed ? <Image source={{ uri }} accessibilityLabel={name} resizeMode={contain ? "contain" : "cover"} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
      : <AppText muted variant="caption">Photo unavailable</AppText>}
  </View>;
}
const styles = StyleSheet.create({ fill: { flex: 1, aspectRatio: undefined, height: '100%' }, photo: { width: '100%', aspectRatio: 0.8, borderRadius: 20, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
