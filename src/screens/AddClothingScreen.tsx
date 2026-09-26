import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { PageHeading } from '@/components/PageHeading';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { ItemPhoto } from '@/components/wardrobe/ItemPhoto';
import { ItemEditor } from '@/components/wardrobe/ItemEditor';
import { useAuth } from '@/providers/AuthProvider';
import { CameraPermissionError, chooseWardrobePhoto, prepareWardrobePhoto, takeWardrobePhoto, type SelectedPhoto } from '@/services/wardrobe/photo';
import { createWardrobeItem, discardWardrobePhoto, uploadWardrobePhoto } from '@/services/supabase/wardrobeImages';
import { analyzeWardrobeImage } from '@/services/supabase/clothingAnalysis';
import { applyClothingSuggestions } from '@/utils/clothingSuggestions';
import type { WardrobeEdit, WardrobeItem } from '@/types/wardrobe';

export function AddClothingScreen() {
  const { user } = useAuth();
  return user ? <AddItemFlow key={user.id} userId={user.id} /> : null;
}
function AddItemFlow({ userId }: { userId: string }) {
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [details, setDetails] = useState(false);
  const [hasDetails, setHasDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [suggestedCategory, setSuggestedCategory] = useState<WardrobeItem['category'] | null>(null);
  const analysisAbort = useRef<AbortController | null>(null);
  const analyzedPath = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [draftId] = useState(() => Crypto.randomUUID());
  const photoId = useRef(draftId);
  const uploaded = useRef<string | null>(null);
  const saved = useRef(false);
  const saveAttempted = useRef(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [draft, setDraft] = useState<WardrobeItem>(() => ({
    id: draftId, user_id: userId, image_path: null, image_url: null, product_url: null,
    name: '', brand: null, category: 'top', subcategory: null, primary_colour: null,
    secondary_colours: [], pattern: null, material: [], fit: null, season: [], formality: null,
    style_tags: [], warmth_level: null, sleeve_length: null, neckline: null, favourite: false,
    archived_at: null, created_at: '', updated_at: '',
  }));
  useEffect(() => {
    mounted.current = true;
    // Recover Android results if the OS recreated the activity while the picker was open.
    if (Platform.OS === 'android') void ImagePicker.getPendingResultAsync().then(result => {
      if (mounted.current && result && 'assets' in result && !result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
    }).catch(() => { /* A new selection remains available. */ });
    return () => {
      mounted.current = false;
      analysisAbort.current?.abort();
      // Never delete a photo after an ambiguous save response: the row may exist.
      if (uploaded.current && !saved.current && !saveAttempted.current) void discardWardrobePhoto(userId, uploaded.current).catch(() => {});
    };
  }, [userId]);
  async function pick(camera: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setSettings(false);
    try {
      const result = await (camera ? takeWardrobePhoto() : chooseWardrobePhoto());
      if (!mounted.current || result.canceled || !result.assets[0]) return;
      if (uploaded.current) {
        await discardWardrobePhoto(userId, uploaded.current);
        uploaded.current = null;
        setPhotoUploaded(false);
      }
      photoId.current = Crypto.randomUUID();
      setPhoto(result.assets[0]); setDetails(false); setHasDetails(false);
      setAnalysisNotice(null); setSuggestedCategory(null); analyzedPath.current = null;
      // A replacement image must not inherit the previous image's suggestions.
      setDraft(current => ({ ...current, name: '', brand: null, category: 'top',
        subcategory: null, primary_colour: null, secondary_colours: [], pattern: null,
        material: [], fit: null, season: [], formality: null, style_tags: [],
        warmth_level: null, sleeve_length: null, neckline: null }));
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof CameraPermissionError ? e.message : 'Couldn’t open or replace this photo. Please try again.');
        setSettings(e instanceof CameraPermissionError && !e.canAskAgain);
      }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function upload() {
    if (!photo || lock.current) return;
    lock.current = true; setBusy(true); setError(null); setStatus('Preparing your photo…');
    try {
      if (!uploaded.current) {
        const base64 = await prepareWardrobePhoto(photo);
        if (!mounted.current) return;
        setStatus('Uploading your photo…');
        const path = await uploadWardrobePhoto(userId, photoId.current, base64);
        if (!mounted.current) { await discardWardrobePhoto(userId, path); return; }
        uploaded.current = path;
        setPhotoUploaded(true);
      }
      const path = uploaded.current;
      if (path && analyzedPath.current !== path) {
        const controller = new AbortController();
        analysisAbort.current = controller;
        setAnalyzing(true); setStatus('Analyzing item');
        try {
          const suggestions = await analyzeWardrobeImage(path, controller.signal);
          if (mounted.current && !controller.signal.aborted) {
            setDraft(current => applyClothingSuggestions(current, suggestions));
            setSuggestedCategory(suggestions.category);
            setAnalysisNotice(suggestions.category
              ? 'AI suggestions — review and edit every detail. Materials and warmth are estimates. Nothing is saved until you confirm.'
              : 'We couldn’t identify a clear wardrobe item. Please enter its details manually.');
          }
        } catch {
          if (mounted.current) setAnalysisNotice(controller.signal.aborted
            ? 'Enter the details yourself. Nothing is saved until you confirm.'
            : 'Analysis wasn’t available. You can enter all details manually and save your item.');
        } finally {
          analyzedPath.current = path;
          analysisAbort.current = null;
          if (mounted.current) setAnalyzing(false);
        }
      }
      if (mounted.current) { setHasDetails(true); setDetails(true); }
    } catch { if (mounted.current) setError('Your photo couldn’t upload. Check your connection and retry, or choose a smaller photo.'); }
    finally { lock.current = false; if (mounted.current) { setBusy(false); setStatus(''); } }
  }
  async function save(fields: WardrobeEdit) {
    if (!uploaded.current || lock.current) return;
    lock.current = true; saveAttempted.current = true; setAttemptedSave(true); setBusy(true); setError(null);
    setDraft(current => ({ ...current, ...fields }));
    try {
      const item = await createWardrobeItem(userId, draftId, uploaded.current, fields);
      saved.current = true;
      if (mounted.current) router.replace({ pathname: '/wardrobe-items/[id]', params: { id: item.id } });
    } catch { if (mounted.current) setError('Your item couldn’t be saved. Your photo and details are still here—please retry.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function close() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (uploaded.current && !saveAttempted.current) {
        await discardWardrobePhoto(userId, uploaded.current); uploaded.current = null;
      }
      if (router.canGoBack()) router.back();
      else router.replace('/wardrobe');
    } catch { setError('Couldn’t discard the uploaded photo. Check your connection and try again.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <Screen bottomInset>
    <Button label="Close" variant="ghost" disabled={busy} onPress={() => void close()} />
    <PageHeading eyebrow="GROW YOUR COLLECTION" title={details ? 'Make it yours.' : 'Add a wardrobe item'} description={details ? 'Tell us about your piece.' : 'Start with a photo of something you love.'} />
    {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    {settings && Platform.OS !== 'web' ? <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings().catch(() => setError('Open Settings on your device to allow camera access.'))} /> : null}
    {photo ? <ItemPhoto uri={photo.uri} name="Selected wardrobe photo" /> : null}
    {analysisNotice && details ? <AppText accessibilityLiveRegion="polite">{analysisNotice}</AppText> : null}
    {analyzing ? <>
      <AppText accessibilityLiveRegion="polite">Analyzing item</AppText>
      <Button label="Enter details manually" variant="secondary" onPress={() => analysisAbort.current?.abort()} />
    </> : null}
    {hasDetails ? <View style={{ display: details ? 'flex' : 'none' }}><ItemEditor item={draft} busy={busy} creating suggestedCategory={suggestedCategory} onSave={fields => void save(fields)} onCancel={() => { setDetails(false); setError(null); }} /></View> : null}
    {!details ? <>
      {attemptedSave ? <AppText>Please retry saving before changing the photo.</AppText> : null}
      <Card>
        <Button label={photo ? 'Retake Photo' : 'Take Photo'} icon="camera-outline" disabled={busy || attemptedSave} onPress={() => void pick(true)} />
        <Button label={photo ? 'Choose Another Photo' : 'Choose From Photos'} icon="images-outline" variant="secondary" disabled={busy || attemptedSave} onPress={() => void pick(false)} />
        {!photo ? <>
          <Button label="Search Online · Coming soon" icon="search-outline" variant="ghost" disabled />
          <Button label="Paste Product Link · Coming soon" icon="link-outline" variant="ghost" disabled />
        </> : null}
      </Card>
      {photo ? <Button label={status || (photoUploaded ? 'Continue to details' : 'Upload photo & continue')} loading={busy} onPress={() => void upload()} /> : null}
      {photo ? <AppText variant="caption" muted>Your photo is stored privately. After upload, it is sent securely for AI suggestions. You review everything before saving.</AppText> : null}
    </> : null}
  </Screen>;
}
