import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppText } from '@/components/ui';
import { theme } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { wardrobePhotoUrl } from '@/services/supabase/wardrobeImages';

export function ItemPhoto({ uri, name, imagePath }: { uri: string | null; name: string; imagePath?: string | null }) {
  const { user } = useAuth();
  if (imagePath) return user ? <PrivatePhoto key={`${user.id}:${imagePath}`} userId={user.id} path={imagePath} name={name} /> : <Photo uri={null} name={name} />;
  return <Photo key={uri} uri={uri} name={name} />;
}
function PrivatePhoto({ userId, path, name }: { userId: string; path: string; name: string }) {
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
  return <Photo key={uri} uri={uri} name={name} loading={loading} />;
}
function Photo({ uri, name, loading = false }: { uri: string | null; name: string; loading?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <View style={styles.photo}>
    {loading ? <ActivityIndicator accessibilityLabel="Loading photo" color={theme.colors.accent} /> : uri && !failed ? <Image source={{ uri }} accessibilityLabel={name} resizeMode="cover" style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
      : <AppText muted variant="caption">Photo unavailable</AppText>}
  </View>;
}
const styles = StyleSheet.create({ photo: { width: '100%', aspectRatio: 0.8, borderRadius: 20, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
