import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { Toaster } from "@/src/components/Toaster";
import { LoadingScreen } from "@/src/components/LoadingScreen";
import { INITIAL_STEPS, progressOf, runNetworkSteps, type LoadStep } from "@/src/preload";
import { ConfirmHost } from "@/src/components/ConfirmHost";
import { clearAuth, setObraMissingHandler, setUnauthorizedHandler } from "@/src/api";
import { SettingsProvider, loadSettings, useTheme, type Settings } from "@/src/settings";
import { NATIVE_FONT_FILES, lightPalette } from "@/src/theme";
import { useFonts } from "expo-font";
import { Platform } from "react-native";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  // Fonte de texto: Inter embutida no celular; no navegador usa a Aptos instalada no PC
  const [textLoaded, textError] = useFonts(Platform.OS === "web" ? {} : NATIVE_FONT_FILES);
  const loaded = iconsLoaded && textLoaded;
  const error = iconsError || textError;
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      // Privacidade: "Manter conectado" desligado -> sessão não sobrevive a reabrir o app
      if (!s.rememberSession) await clearAuth();
      setSettings(s);
    })();
  }, []);

  // ---------------------------------------------------------------- carregamento REAL
  // Cada etapa (fontes, configurações, servidor/sessão, obras) avança a barra quando termina de verdade.
  const [steps, setSteps] = useState<LoadStep[]>(INITIAL_STEPS);
  const updateStep = useCallback((id: string, patch: Partial<LoadStep>) => {
    setSteps((prev) => prev.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  }, []);

  useEffect(() => {
    if (loaded || error) updateStep("fontes", { state: error ? "falhou" : "ok" });
  }, [loaded, error, updateStep]);

  useEffect(() => {
    if (!settings) return;
    updateStep("config", { state: "ok" });
    runNetworkSteps(updateStep, settings.rememberSession);
  }, [settings, updateStep]);

  const progress = useMemo(() => progressOf(steps), [steps]);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (progress < 100 || entered) return;
    const t = setTimeout(() => setEntered(true), 600); // mostra "PRONTO" com a estrutura completa por um instante
    return () => clearTimeout(t);
  }, [progress, entered]);

  const hideNativeSplash = () => {
    SplashScreen.hideAsync().catch(() => {});
    // web: tira o pré-carregamento em HTML (app/+html.tsx) — a tela de carregamento real assume daqui
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const el = document.getElementById("boot-splash");
      if (el) { el.classList.add("sai"); setTimeout(() => el.remove(), 300); }
    }
  };

  if (!entered || !settings) {
    return <LoadingScreen steps={steps} progress={progress} onFirstLayout={hideNativeSplash} />;
  }

  return (
    <SettingsProvider initial={settings}>
      <AppShell />
    </SettingsProvider>
  );
}

function AppShell() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // Sessão expirada/inválida -> login
    setUnauthorizedHandler(() => router.replace("/(auth)/login"));
    // Obra selecionada foi removida -> menu de obras
    setObraMissingHandler(() => router.replace("/obras"));
    return () => { setUnauthorizedHandler(null); setObraMissingHandler(null); };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
        <Toaster />
        <ConfirmHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
