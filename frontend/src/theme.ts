// Design tokens. Dark-first (navy/black + blue/cyan) with a light palette and an
// in-app toggle (Escuro / Claro / Sistema) persisted in storage.
//
// Usage:
//   const useStyles = makeStyles((colors) => ({ card: { backgroundColor: colors.surfaceSecondary } }));
//   const { colors } = useTheme();  // for non-style color props
// Never write color literals in components; add keys here instead.

import { useMemo, useSyncExternalStore } from "react";
import { StyleSheet, useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";

export type ColorScheme = "light" | "dark";
export type ThemePreference = ColorScheme | "system";

const dark = {
  surface: "#0B0D1F",
  onSurface: "#F2F4FF",
  surfaceSecondary: "#151937",
  onSurfaceSecondary: "#E3E6FF",
  surfaceTertiary: "#1F2447",
  onSurfaceTertiary: "#C3C8F0",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0B0D1F",
  muted: "#8A90C2",
  backdrop: "rgba(4,6,20,0.7)",
  rackRail: "#090B1A",
  canvasGrid: "#1A1E42",

  brand: "#2BE36F",
  onBrand: "#03230F",
  brandPrimary: "#2BE36F", // Zatriz green CTA
  onBrandPrimary: "#03230F",
  brandSecondary: "#1FB85A", // deeper green
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#0F3A22", // subtle fills
  onBrandTertiary: "#7FF0A8",
  accent: "#2DD4F5", // cyan for charts / highlights
  onAccent: "#04202B",
  gradientStart: "#1FB85A",
  gradientEnd: "#2BE36F",

  success: "#3DF58C",
  onSuccess: "#03301A",
  warning: "#FFC857",
  onWarning: "#332600",
  error: "#FF5470",
  onError: "#3A000E",
  info: "#4F7CFF",
  onInfo: "#FFFFFF",

  border: "#262C5C",
  borderStrong: "#3C4390",
  divider: "#1C2148",

  mapNorte: "#1F6F5F",
  mapNordeste: "#7A3E8F",
  mapCentro: "#8A6A1F",
  mapSudeste: "#1F4F8F",
  mapSul: "#8F2F4F",
};

const light: typeof dark = {
  surface: "#F3F5FF",
  onSurface: "#0F1230",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1B1F4B",
  surfaceTertiary: "#E8EBFA",
  onSurfaceTertiary: "#3A3F6E",
  surfaceInverse: "#0F1230",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7199",
  backdrop: "rgba(15,18,48,0.45)",
  rackRail: "#D8DCF2",
  canvasGrid: "#DDE1F5",

  brand: "#17A74A",
  onBrand: "#FFFFFF",
  brandPrimary: "#17A74A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#0E8A5F",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#DDF7E6",
  onBrandTertiary: "#0F6B32",
  accent: "#1E6FE8",
  onAccent: "#FFFFFF",
  gradientStart: "#17A74A",
  gradientEnd: "#2BE36F",

  success: "#12995A",
  onSuccess: "#FFFFFF",
  warning: "#C77A00",
  onWarning: "#FFFFFF",
  error: "#D6294B",
  onError: "#FFFFFF",
  info: "#1E6FE8",
  onInfo: "#FFFFFF",

  border: "#D9DDF2",
  borderStrong: "#B9BFE3",
  divider: "#E6E9F8",

  mapNorte: "#8FD3C2",
  mapNordeste: "#D4A6E8",
  mapCentro: "#F0D08A",
  mapSudeste: "#9DBCF0",
  mapSul: "#F0A3BC",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: Record<ColorScheme, ThemeColors> = { light, dark };

export const fonts = {
  display: "Rajdhani-Bold",
  displayMedium: "Rajdhani-SemiBold",
  text: "IBMPlexSans",
};

// ---- theme preference store --------------------------------------------------
const PREF_KEY = "ns_theme_pref";
let preference: ThemePreference = defaultScheme;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getThemePreference() {
  return preference;
}

export function setThemePreference(p: ThemePreference) {
  preference = p;
  storage.setItem(PREF_KEY, p);
  listeners.forEach((l) => l());
}

export async function loadThemePreference() {
  const saved = await storage.getItem<ThemePreference>(PREF_KEY, defaultScheme);
  if (saved === "light" || saved === "dark" || saved === "system") {
    preference = saved;
    listeners.forEach((l) => l());
  }
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference, () => preference);
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const pref = useThemePreference();
  const scheme: ColorScheme = pref === "system" ? (system === "light" ? "light" : "dark") : pref;
  return { scheme, colors: themes[scheme] };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
