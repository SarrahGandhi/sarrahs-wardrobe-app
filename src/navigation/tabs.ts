import type { IconName } from "@/types/ui";

interface TabDefinition {
  name: "index" | "wardrobe" | "plan" | "saved" | "profile";
  title: string;
  icon: IconName;
  activeIcon: IconName;
}
export const tabs: readonly TabDefinition[] = [
  { name: "index", title: "Home", icon: "home-outline", activeIcon: "home" },
  {
    name: "wardrobe",
    title: "Wardrobe",
    icon: "shirt-outline",
    activeIcon: "shirt",
  },
  {
    name: "plan",
    title: "Plan",
    icon: "sparkles-outline",
    activeIcon: "sparkles",
  },
  {
    name: "saved",
    title: "Saved",
    icon: "bookmark-outline",
    activeIcon: "bookmark",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    activeIcon: "person",
  },
];
