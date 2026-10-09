import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, getStoredUser } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

export default function PhotosScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => { try { const r = await api<{ items: any[] }>("/photos"); setItems(r.items || []); } catch {} setLoading(false); };
  useEffect(() => { load(); }, []);

  const pickAndUpload = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permissão negada");
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ["images"] });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const user = await getStoredUser<any>();
      setBusy(true);
      await api("/photos", { method: "POST", body: { obra_id: user.obra_id, image_base64: `data:image/jpeg;base64,${res.assets[0].base64}` } });
      await load();
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>GALERIA IA</Text>
          <Text style={styles.hTitle}>Fotos ({items.length})</Text>
        </View>
        <Pressable testID="photos-home" onPress={() => router.replace("/(tabs)")} style={styles.homeBtn}>
          <Ionicons name="chatbubbles" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable testID="photo-camera" disabled={busy} onPress={() => pickAndUpload(true)} style={[styles.actionBtn, { backgroundColor: colors.brand }]}>
          <Ionicons name="camera" size={18} color={colors.onBrand} />
          <Text style={[styles.actionText, { color: colors.onBrand }]}>CÂMERA</Text>
        </Pressable>
        <Pressable testID="photo-gallery" disabled={busy} onPress={() => pickAndUpload(false)} style={styles.actionBtn}>
          <Ionicons name="image" size={18} color={colors.onSurface} />
          <Text style={styles.actionText}>GALERIA</Text>
        </Pressable>
      </View>
      {busy && <View style={styles.busyBar}><ActivityIndicator color={colors.brand} /><Text style={styles.busyText}>ANALISANDO COM IA...</Text></View>}

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> :
          items.length === 0 ? <Text style={styles.empty}>Nenhuma foto ainda. Tire uma foto do canteiro.</Text> :
            items.map((p) => (
              <View key={p.id} style={styles.card}>
                <Image source={{ uri: p.image_base64 }} style={styles.thumb} resizeMode="cover" />
                <View style={styles.info}>
                  <Text style={styles.metaLine}>{p.created_at?.slice(0, 16).replace("T", " ")}</Text>
                  {p.note ? <Text style={styles.summary}>{p.note}</Text> : null}
                  {p.analysis?.summary ? <Text style={styles.summary}>{p.analysis.summary}</Text> : null}
                  <View style={styles.tagsRow}>
                    {(p.tags || []).map((t: string) => (
                      <View key={t} style={styles.tag}>
                        <Text style={styles.tagText}>{t.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))
        }
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  homeBtn: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  actionBtn: { flex: 1, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surface },
  actionText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 0.5 },
  busyBar: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.brandTertiary, borderWidth: 2, borderColor: colors.borderStrong, marginHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  busyText: { fontFamily: fonts.mono, fontWeight: "700", color: colors.onSurface, fontSize: fontSize.xs, letterSpacing: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["2xl"] },
  empty: { fontFamily: fonts.mono, color: colors.info, textAlign: "center", marginTop: spacing.xl },
  card: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  thumb: { width: "100%", height: 200, backgroundColor: colors.surfaceTertiary },
  info: { padding: spacing.md, gap: 4, borderTopWidth: 2, borderTopColor: colors.borderStrong },
  metaLine: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, fontWeight: "700", letterSpacing: 0.5 },
  summary: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, marginTop: 4, lineHeight: 18 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.sm },
  tag: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong },
  tagText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onBrand, fontWeight: "700" },
}));
