import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { getWardrobeItem } from '@/services/supabase/wardrobe';
import type { WardrobeItem } from '@/types/wardrobe';

export function useWardrobeItem(id: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; item: WardrobeItem | null; error: boolean } | null>(null);
  const key = `${userId}:${id}:${attempt}`;
  useFocusEffect(useCallback(() => {
    let active = true;
    setResult(null);
    if (userId) void getWardrobeItem(userId, id).then(item => {
      if (active) setResult({ key, item, error: false });
    }).catch(() => { if (active) setResult({ key, item: null, error: true }); });
    return () => { active = false; };
  }, [userId, id, key]));
  const current = result?.key === key ? result : null;
  return { item: current?.item ?? null, loading: !!userId && !current, error: current?.error ?? false,
    retry: () => setAttempt(n => n + 1),
    replace: (item: WardrobeItem) => setResult({ key, item, error: false }) };
}
