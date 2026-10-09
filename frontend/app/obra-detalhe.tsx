// Detalhe público da obra: especificações abertas a todos + botão de login para acessar a obra.
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api, getStoredUser, restoreSession, setActiveObra } from "@/src/api";
import { spacing, fonts } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";
import { formatDateBR, sizeLabel, type PublicObra } from "@/src/obra";

const RESTRICTED = [
  { icon: "stats-chart", label: "Dashboard e indicadores" },
  { icon: "chatbubbles", label: "Copiloto IA com os dados da obra" },
  { icon: "warning", label: "Não conformidades e alertas" },
  { icon: "shield-checkmark", label: "Controle de EPIs" },
  { icon: "document-text", label: "RDOs, checklists e qualidade" },
  { icon: "images", label: "Fotos e inspeções" },
];

export default function ObraDetalhe() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [obra, setObra] = useState<PublicObra | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        setObra(await api<PublicObra>(`/public/obras/${id}`, { auth: false }));
        setLoggedIn(!!(await getStoredUser()));
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]));

  const enter = async () => {
    if (!obra) return;
    if (!loggedIn) {
      router.push({ pathname: "/(auth)/login", params: { obraId: obra.id, obraName: obra.name } });
      return;
    }
    setEntering(true);
    // confirma que a sessão ainda é válida antes de entrar
    const u = await restoreSession();
    setEntering(false);
    if (!u) {
      router.push({ pathname: "/(auth)/login", params: { obraId: obra.id, obraName: obra.name } });
      return;
    }
    await setActiveObra(obra);
    router.replace("/(tabs)/obra");
  };

  const late = obra && obra.days_left !== null && obra.days_left < 0 && (obra.progress ?? 0) < 100;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>ESPECIFICAÇÕES DA OBRA</Text>
          <Text style={styles.hTitle} numberOfLines={2}>{obra?.name || "Obra"}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : error || !obra ? (
        <View style={styles.scroll}><Text style={styles.errorText}>{error || "Obra não encontrada"}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.progressBlock}>
            <Text style={styles.pLabel}>ESTÁGIO ATUAL</Text>
            <Text style={styles.pValue}>{Math.round(obra.progress || 0)}%</Text>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(100, obra.progress || 0)}%` }]} /></View>
            {late ? <Text style={styles.late}>Prazo previsto vencido há {-(obra.days_left as number)} dias</Text> :
              obra.days_left !== null && (obra.progress ?? 0) < 100 ? <Text style={styles.pSub}>{obra.days_left} dias para o término previsto</Text> : null}
          </View>

          <View style={styles.specs}>
            <Spec icon="location" label="LOCALIDADE" value={obra.address} />
            <Spec icon="business" label="EMPRESA RESPONSÁVEL" value={obra.company} />
            <Spec icon="document-text" label="ART" value={obra.art} />
            <View style={styles.specRow}>
              <Spec icon="calendar" label="INÍCIO" value={formatDateBR(obra.start_date)} half />
              <Spec icon="flag" label="TÉRMINO PREVISTO" value={formatDateBR(obra.end_date)} half />
            </View>
            <View style={styles.specRow}>
              <Spec icon="resize" label="PORTE" value={sizeLabel(obra.size)} half />
              <Spec icon="people" label="FUNCIONÁRIOS" value={String(obra.workers_total ?? 0)} half />
            </View>
          </View>

          <View style={styles.lockBox}>
            <View style={styles.lockHead}>
              <Ionicons name={loggedIn ? "lock-open" : "lock-closed"} size={18} color={colors.brand} />
              <Text style={styles.lockTitle}>{loggedIn ? "ACESSO LIBERADO" : "ACESSO RESTRITO"}</Text>
            </View>
            <Text style={styles.lockText}>
              {loggedIn ? "Você está conectado. Entre na obra para ver e registrar:" : "Faça login para checar a obra com mais precisão:"}
            </Text>
            {RESTRICTED.map((r) => (
              <View key={r.label} style={styles.lockItem}>
                <Ionicons name={r.icon as any} size={14} color={colors.info} />
                <Text style={styles.lockItemText}>{r.label}</Text>
              </View>
            ))}
          </View>

          <Pressable testID="detalhe-entrar" onPress={enter} disabled={entering} style={({ pressed }) => [styles.primaryBtn, (pressed || entering) && { opacity: 0.85 }]}>
            {entering ? <ActivityIndicator color={colors.onBrand} /> : (
              <>
                <Ionicons name={loggedIn ? "enter" : "log-in"} size={20} color={colors.onBrand} />
                <Text style={styles.primaryBtnText}>{loggedIn ? "ACESSAR OBRA" : "FAZER LOGIN PARA ACESSAR"}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Spec({ icon, label, value, half }: { icon: any; label: string; value?: string | null; half?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.spec, half && { flex: 1 }]}>
      <Text style={styles.specLabel}><Ionicons name={icon} size={11} color={colors.info} /> {label}</Text>
      <Text style={styles.specValue}>{value || "—"}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] },
  errorText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.error },
  progressBlock: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceInverse, padding: spacing.lg },
  pLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.brandTertiary, fontWeight: "700" },
  pValue: { fontFamily: fonts.display, fontSize: fontSize["4xl"], fontWeight: "900", color: colors.brand, letterSpacing: -2, marginTop: 4 },
  pSub: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurfaceInverse, marginTop: spacing.sm },
  late: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.error, marginTop: spacing.sm, fontWeight: "700" },
  progressBar: { height: 8, backgroundColor: colors.surfaceTertiary, marginTop: spacing.md, borderWidth: 2, borderColor: colors.borderStrong },
  progressFill: { height: "100%", backgroundColor: colors.brand },
  specs: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: spacing.md },
  specRow: { flexDirection: "row", gap: spacing.md },
  spec: { gap: 2 },
  specLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, color: colors.info, fontWeight: "700", letterSpacing: 0.5 },
  specValue: { fontFamily: fonts.display, fontSize: fontSize.base, fontWeight: "900", color: colors.onSurface },
  lockBox: { borderWidth: 2, borderColor: colors.borderStrong, borderStyle: "dashed", padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surfaceSecondary },
  lockHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lockTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface, letterSpacing: 1 },
  lockText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, marginBottom: spacing.xs },
  lockItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lockItemText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface },
  primaryBtn: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.lg, alignItems: "center", justifyContent: "center", minHeight: 56 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
}));
