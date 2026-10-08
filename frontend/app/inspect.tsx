import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, getStoredUser } from "@/src/api";
import { colors, spacing, fonts, fontSize, severityColor } from "@/src/theme";

export default function InspectScreen() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const pick = async (cam: boolean) => {
    const perm = cam ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permissão negada");
    const res = cam ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const b64 = `data:image/jpeg;base64,${res.assets[0].base64}`;
    setImage(b64);
    setResult(null);
    await analyze(b64);
  };

  const analyze = async (b64: string) => {
    setBusy(true);
    try {
      const user = await getStoredUser<any>();
      const r = await api("/inspections/analyze", { method: "POST", body: { obra_id: user.obra_id, image_base64: b64 } });
      setResult(r);
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>INSPEÇÃO IA</Text>
          <Text style={styles.hTitle}>Análise Visual</Text>
        </View>
        <Pressable testID="inspect-home" onPress={() => router.replace("/(tabs)")} style={styles.homeBtn}>
          <Ionicons name="chatbubbles" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!image && (
          <View style={styles.emptyBlock}>
            <Ionicons name="scan" size={48} color={colors.brand} />
            <Text style={styles.emptyTitle}>DETECÇÃO INTELIGENTE</Text>
            <Text style={styles.emptyText}>A IA identifica: falta de EPI, guarda-corpo, armadura incorreta, fissuras, segregação de concreto e problemas de acabamento. Não conformidades críticas/altas são criadas automaticamente.</Text>
          </View>
        )}

        {image && <Image source={{ uri: image }} style={styles.preview} resizeMode="cover" />}

        {busy && <View style={styles.busy}><ActivityIndicator color={colors.brand} /><Text style={styles.busyText}>ANALISANDO...</Text></View>}

        {result?.analysis && (
          <View style={styles.resultBlock}>
            <Text style={styles.metaLine}>PAV: {result.analysis.pavimento || "—"} • {result.analysis.ambiente || "—"}</Text>
            <Text style={styles.summary}>{result.analysis.summary}</Text>
            <Text style={styles.sectionTitle}>OCORRÊNCIAS ({result.analysis.issues?.length || 0})</Text>
            {(result.analysis.issues || []).length === 0 ? (
              <Text style={styles.okText}>Nenhuma ocorrência detectada.</Text>
            ) : (result.analysis.issues || []).map((iss: any, i: number) => (
              <View key={i} style={styles.issue}>
                <View style={styles.issueHeader}>
                  <Text style={styles.issueTitle}>{iss.title}</Text>
                  <View style={[styles.sevBadge, { backgroundColor: severityColor[iss.severity] || colors.warning }]}>
                    <Text style={styles.sevText}>{(iss.severity || "").toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.issueAction}>{iss.corrective_action}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable testID="inspect-camera" disabled={busy} onPress={() => pick(true)} style={[styles.actionBtn, { backgroundColor: colors.brand }]}>
            <Ionicons name="camera" size={18} color={colors.onBrand} />
            <Text style={[styles.actionText, { color: colors.onBrand }]}>CÂMERA</Text>
          </Pressable>
          <Pressable testID="inspect-gallery" disabled={busy} onPress={() => pick(false)} style={styles.actionBtn}>
            <Ionicons name="image" size={18} color={colors.onSurface} />
            <Text style={styles.actionText}>GALERIA</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  homeBtn: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["2xl"] },
  emptyBlock: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.sm, alignItems: "flex-start" },
  emptyTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, color: colors.onSurface, letterSpacing: -0.3 },
  emptyText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.info, lineHeight: 20 },
  preview: { width: "100%", height: 280, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary },
  busy: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.brandTertiary, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  busyText: { fontFamily: fonts.mono, fontWeight: "700", letterSpacing: 1 },
  resultBlock: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surface, gap: spacing.sm },
  metaLine: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, fontWeight: "700", letterSpacing: 0.5 },
  summary: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, lineHeight: 20 },
  sectionTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700", marginTop: spacing.sm },
  okText: { fontFamily: fonts.mono, color: colors.success, fontWeight: "700" },
  issue: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.sm, backgroundColor: colors.surfaceSecondary, gap: 4 },
  issueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  issueTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, flex: 1 },
  sevBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 2, borderColor: colors.borderStrong },
  sevText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onBrand, fontWeight: "700", letterSpacing: 0.5 },
  issueAction: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surface },
  actionText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 0.5 },
});
