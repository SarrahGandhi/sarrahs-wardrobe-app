import type { ImageSourcePropType } from "react-native";

/** Presentation-only fixture; not a Supabase or generated-outfit contract. */
export interface PreviewLook {
  id: string;
  title: string;
  occasion: string;
  savedLabel: string;
  image: ImageSourcePropType;
  imageDescription: string;
  notes: string;
  pieces: readonly string[];
}
