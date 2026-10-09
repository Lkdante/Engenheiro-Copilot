import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { clearAuth, setObraMissingHandler, setUnauthorizedHandler } from "@/src/api";
import { SettingsProvider, loadSettings, useTheme, type Settings } from "@/src/settings";
import { lightPalette } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
