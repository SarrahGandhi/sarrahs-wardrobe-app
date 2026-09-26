import type { ComponentProps } from "react";
import type Ionicons from "@expo/vector-icons/Ionicons";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export type ButtonVariant = "primary" | "secondary" | "ghost";
