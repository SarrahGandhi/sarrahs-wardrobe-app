import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type SelectedPhoto = { uri: string; width: number; height: number };
export class CameraPermissionError extends Error {
  constructor(public canAskAgain: boolean) {
    super(canAskAgain ? 'Allow camera access to photograph your clothing, or choose an existing photo.' : 'Camera access is off. Enable it in Settings, or choose an existing photo.');
  }
}
export async function takeWardrobePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new CameraPermissionError(permission.canAskAgain);
  return ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
}
export function chooseWardrobePhoto() {
  // System photo picker grants access only to the selected photo. No broad library
  // permission required; also works with iOS limited-library access.
  return ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1, exif: false });
}
export async function prepareWardrobePhoto(photo: SelectedPhoto) {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > 1600) {
    context.resize(photo.width >= photo.height ? { width: 1600 } : { height: 1600 });
  }
  try {
    const rendered = await context.renderAsync();
    try {
      const output = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!output.base64) throw new Error('Could not prepare this photo. Try another image.');
      return output.base64;
    } finally { rendered.release(); }
  } finally { context.release(); }
}
