import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getStoredUser, setActiveObra } from "@/src/api";
import { formatDateBR, sizeLabel } from "@/src/obra";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

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
  const { colors } = useTheme();
  const tileStyles = useTileStyles();
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

const MANAGERS = ["admin", "engenheiro", "diretor"];

export default function Obra() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<Dash>("/dashboard");
      setData(d);
      if (d?.obra) await setActiveObra(d.obra);
      setCanEdit(MANAGERS.includes((await getStoredUser<any>())?.role));
    } catch (e) { console.warn(e); }
    setLoading(false); setRefresh(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  const k = data?.kpis;
  const progress = k?.progress ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={[styles.header, styles.headerRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>DASHBOARD DA OBRA</Text>
          <Text style={styles.hTitle} testID="obra-title" numberOfLines={2}>{data?.obra?.name || "Obra"}</Text>
          <Text style={styles.hSub} numberOfLines={1}>{data?.obra?.address}</Text>
        </View>
        <Pressable testID="obra-trocar" onPress={() => router.replace("/obras")} style={styles.switchBtn}>
          <Ionicons name="swap-horizontal" size={18} color={colors.onSurface} />
          <Text style={styles.switchText}>TROCAR</Text>
        </Pressable>
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

        {data?.obra ? (
          <View style={styles.details}>
            <Detail label="EMPRESA RESPONSÁVEL" value={data.obra.company} />
            <Detail label="ART" value={data.obra.art} />
            <View style={styles.detailRow}>
              <Detail label="INÍCIO" value={formatDateBR(data.obra.start_date)} half />
              <Detail label="TÉRMINO PREVISTO" value={formatDateBR(data.obra.end_date)} half />
            </View>
            <View style={styles.detailRow}>
              <Detail label="PORTE" value={sizeLabel(data.obra.size)} half />
              <Detail label="FUNCIONÁRIOS" value={String(data.obra.workers_count ?? 0)} half />
            </View>
            {canEdit ? (
              <Pressable testID="obra-editar" onPress={() => router.push({ pathname: "/obra-nova", params: { id: data.obra.id } })} style={styles.editBtn}>
                <Ionicons name="create-outline" size={16} color={colors.onSurface} />
                <Text style={styles.switchText}>EDITAR DADOS DA OBRA</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

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

function Detail({ label, value, half }: { label: string; value?: string | null; half?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.detail, half && { flex: 1 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  );
}

const useTileStyles = makeStyles((colors, fontSize) => ({
  tile: { width: "48%", borderWidth: 2, padding: spacing.md, minHeight: 96, justifyContent: "space-between" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, fontWeight: "700" },
  value: { fontFamily: fonts.display, fontSize: fontSize["3xl"], fontWeight: "900", letterSpacing: -1, marginTop: spacing.xs },
  sub: { fontFamily: fonts.mono, fontSize: fontSize.xs, marginTop: 2 },
}));

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  switchBtn: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, alignItems: "center", gap: 2 },
  switchText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onSurface, letterSpacing: 0.5 },
  details: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: spacing.sm },
  detailRow: { flexDirection: "row", gap: spacing.sm },
  detail: { gap: 2 },
  detailLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.info, fontWeight: "700", letterSpacing: 0.5 },
  detailValue: { fontFamily: fonts.display, fontSize: fontSize.base, fontWeight: "900", color: colors.onSurface },
  editBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.borderStrong, minHeight: 44, marginTop: spacing.xs, backgroundColor: colors.surfaceSecondary },
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
}));
