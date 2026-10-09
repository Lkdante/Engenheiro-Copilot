// Configurações do app (salvas no aparelho) + tema dinâmico.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { storage } from "@/src/utils/storage";
import {
  darkPalette, lightPalette, scaledFontSize, withHighContrast,
  type FontSizes, type Palette,
} from "@/src/theme";

export type ThemeMode = "light" | "dark" | "system";
export type CardMode = "detalhado" | "compacto";
export type SortMode = "recentes" | "nome" | "termino";

export type Settings = {
  // Visibilidade
  theme: ThemeMode;
  cardMode: CardMode;
  sortBy: SortMode;
  showFinished: boolean;
  // Acessibilidade
  textScale: number; // 1, 1.15, 1.3
  highContrast: boolean;
  // Privacidade
  rememberSession: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  cardMode: "detalhado",
  sortBy: "recentes",
  showFinished: true,
  textScale: 1,
  highContrast: false,
  rememberSession: true,
};

const KEY = "app_settings";

export async function loadSettings(): Promise<Settings> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch { return DEFAULT_SETTINGS; }
}

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  colors: Palette;
  fontSize: FontSizes;
  isDark: boolean;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children, initial }: { children: ReactNode; initial: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial);
  const system = useColorScheme();

  useEffect(() => { setSettings(initial); }, [initial]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    storage.setItem(KEY, JSON.stringify(DEFAULT_SETTINGS));
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo<Ctx>(() => {
    const isDark = settings.theme === "dark" || (settings.theme === "system" && system === "dark");
    let colors = isDark ? darkPalette : lightPalette;
    if (settings.highContrast) colors = withHighContrast(colors, isDark);
    return { settings, update, reset, colors, fontSize: scaledFontSize(settings.textScale), isDark };
  }, [settings, system, update, reset]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <SettingsProvider>");
  return ctx;
}

/**
 * Cria um hook de estilos que reage ao tema:
 *   const useStyles = makeStyles((colors, fontSize) => ({ box: { backgroundColor: colors.surface } }));
 *   const styles = useStyles();
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: Palette, fontSize: FontSizes) => T) {
  const cache = new Map<string, T>();
  return function useStyles(): T {
    const { colors, fontSize, settings, isDark } = useTheme();
    const key = `${isDark}-${settings.highContrast}-${settings.textScale}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const created = StyleSheet.create(factory(colors, fontSize)) as T;
    cache.set(key, created);
    return created;
  };
}
