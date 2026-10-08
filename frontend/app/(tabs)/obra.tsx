import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, fonts, fontSize } from "@/src/theme";

type Dash = {
  obra: any;
  kpis: {
    progress: number; nc_open: number; nc_total: number; nc_critical: number;
    checklists_done: number; checklists_total: number; inspections: number;
    photos: number; rdos: number; epis: number; epi_alerts: number;
    quality_ok: number; quality_total: number; quality_rate: number;
  };
};

function Tile({ label, value, sub, tone, icon }: { label: string; value: string | number; sub?: string; tone?: "brand" | "error" | "success" | "warning"; icon?: any }) {
  const bg = tone === "brand" ? colors.brand : colors.surface;
  const fg = tone === "brand" ? colors.onBrand : colors.onSurface;
  const border = colors.borderStrong;
  return (
    <View style={[tileStyles.tile, { backgroundColor: bg, borderColor: border }]}>
      <View style={tileStyles.row}>
        <Text style={[tileStyles.label, { color: tone === "brand" ? colors.brandTertiary : colors.info }]}>{label}</Text>
        {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      </View>
      <Text style={[tileStyles.value, { color: fg }]}>{value}</Text>
      {sub ? <Text style={[tileStyles.sub, { color: tone === "brand" ? colors.brandTertiary : colors.info }]}>{sub}</Text> : null}
    </View>
  );
}

export default function Obra() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<Dash>("/dashboard")); } catch (e) { console.warn(e); }
    setLoading(false); setRefresh(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  const k = data?.kpis;
  const progress = k?.progress ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.hLabel}>DASHBOARD</Text>
        <Text style={styles.hTitle} testID="obra-title">{data?.obra?.name || "Obra"}</Text>
        <Text style={styles.hSub}>{data?.obra?.address}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}>
        {/* Progress big block */}
        <View style={styles.progressBlock}>
          <Text style={styles.pLabel}>AVANÇO FÍSICO</Text>
          <Text style={styles.pValue} testID="obra-progress">{progress}%</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.grid}>
          <Tile label="NCs ABERTAS" value={k?.nc_open ?? 0} sub={`${k?.nc_critical ?? 0} críticas`} tone={k?.nc_critical ? "brand" : undefined} icon="warning" />
          <Tile label="INSPEÇÕES" value={k?.inspections ?? 0} sub="realizadas" icon="scan" />
          <Tile label="CHECKLISTS" value={`${k?.checklists_done ?? 0}/${k?.checklists_total ?? 0}`} sub="concluídos" icon="checkbox" />
          <Tile label="RDOs" value={k?.rdos ?? 0} sub="registrados" icon="document-text" />
          <Tile label="EPIs" value={k?.epis ?? 0} sub={`${k?.epi_alerts ?? 0} alertas`} tone={k?.epi_alerts ? "brand" : undefined} icon="shield" />
          <Tile label="FOTOS IA" value={k?.photos ?? 0} sub="classificadas" icon="images" />
          <Tile label="QUALIDADE" value={`${k?.quality_rate ?? 0}%`} sub={`${k?.quality_ok}/${k?.quality_total} aprovados`} icon="ribbon" />
          <Tile label="TOTAL NCs" value={k?.nc_total ?? 0} sub="histórico" icon="list" />
        </View>

        <View style={styles.footerBlock}>
          <Text style={styles.footerLabel}>PLATAFORMA</Text>
          <Text style={styles.footerText}>Engenheiro de Campo IA • Copiloto para canteiros brasileiros. Dados em tempo real.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const tileStyles = StyleSheet.create({
  tile: { width: "48%", borderWidth: 2, padding: spacing.md, minHeight: 96, justifyContent: "space-between" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, fontWeight: "700" },
  value: { fontFamily: fonts.display, fontSize: fontSize["3xl"], fontWeight: "900", letterSpacing: -1, marginTop: spacing.xs },
  sub: { fontFamily: fonts.mono, fontSize: fontSize.xs, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  hSub: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.info, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["2xl"] },
  progressBlock: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceInverse, padding: spacing.lg },
  pLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.brandTertiary, fontWeight: "700" },
  pValue: { fontFamily: fonts.display, fontSize: fontSize["4xl"], fontWeight: "900", color: colors.brand, letterSpacing: -2, marginTop: 4 },
  progressBar: { height: 8, backgroundColor: colors.surfaceTertiary, marginTop: spacing.md, borderWidth: 2, borderColor: colors.borderStrong },
  progressFill: { height: "100%", backgroundColor: colors.brand },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  footerBlock: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, padding: spacing.md, marginTop: spacing.md },
  footerLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  footerText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, marginTop: spacing.xs, lineHeight: 20 },
});
