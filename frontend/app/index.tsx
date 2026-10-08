import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { restoreSession } from "@/src/api";
import { colors } from "@/src/theme";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const u = await restoreSession();
      router.replace(u ? "/(tabs)" : "/(auth)/login");
    })();
  }, [router]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
