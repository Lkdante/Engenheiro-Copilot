import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

export default function ChecklistDetail() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => { try { setC(await api(`/checklists/${id}`)); } catch (e: any) { Alert.alert("Erro", String(e?.message)); } setLoading(false); };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (itemId: string, status: string) => {
    try {
      setC((prev: any) => prev ? { ...prev, items: (prev.items || []).map((it: any) => it.id === itemId ? { ...it, status } : it) } : prev);
      const upd = await api(`/checklists/${id}/update-item`, { method: "POST", body: { item_id: itemId, status } });
      setC(upd);
    } catch (e: any) { Alert.alert("Erro", String(e?.message)); }
  };

  if (loading || !c) return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  const done = c.items.filter((i: any) => i.status === "ok" || i.status === "na").length;
  const total = c.items.length;
  const pct = Math.round((done / total) * 100);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.hLabel}>CHECKLIST</Text><Text style={styles.hTitle}>{c.service_type?.toUpperCase()}</Text></View>
      </View>

      <View style={styles.progressBlock}>
        <Text style={styles.pLabel}>PROGRESSO</Text>
        <Text style={styles.pValue}>{pct}%</Text>
        <View style={styles.bar}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
        <Text style={styles.pMeta}>{done}/{total} • STATUS: {(c.status || "").toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {c.items.map((it: any) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemTitle}>{it.title}</Text>
            <View style={styles.actions}>
              {[
                { s: "ok", label: "OK", color: colors.success },
                { s: "nok", label: "NÃO OK", color: colors.error },
                { s: "na", label: "N/A", color: colors.info },
              ].map((a) => (
                <Pressable key={a.s} testID={`item-${it.id}-${a.s}`} onPress={() => setStatus(it.id, a.s)} style={[styles.actionBtn, it.status === a.s && { backgroundColor: a.color }]}>
                  <Text style={[styles.actionText, it.status === a.s && { color: colors.onBrand }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  progressBlock: { padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong, backgroundColor: colors.surfaceInverse },
  pLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.brandTertiary, fontWeight: "700" },
  pValue: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize["3xl"], color: colors.brand, letterSpacing: -1, marginTop: 4 },
  bar: { height: 8, backgroundColor: colors.surfaceTertiary, marginTop: spacing.sm, borderWidth: 2, borderColor: colors.borderStrong },
  fill: { height: "100%", backgroundColor: colors.brand },
  pMeta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.brandTertiary, marginTop: spacing.sm, letterSpacing: 0.5 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing["2xl"] },
  itemRow: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surface, gap: spacing.sm },
  itemTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: colors.surface },
  actionText: { fontFamily: fonts.mono, fontWeight: "700", color: colors.onSurface, letterSpacing: 0.5, fontSize: fontSize.sm },
}));
