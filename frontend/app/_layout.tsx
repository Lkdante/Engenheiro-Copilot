import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { Toaster } from "@/src/components/Toaster";
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

  useEffect(() => {
    if ((loaded || error) && settings) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error, settings]);

  if ((!loaded && !error) || !settings) {
    return (
      <View style={{ flex: 1, backgroundColor: lightPalette.surfaceInverse, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={lightPalette.brand} />
      </View>
    );
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
