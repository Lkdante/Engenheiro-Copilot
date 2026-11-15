// Laudo de patologia da obra: manifestações priorizadas por GUT, parecer e fonte.
// Obras de demonstração (laudo público) abrem sem login; as demais exigem login.
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api, getStoredUser } from "@/src/api";
import { spacing, fonts, severityColor } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

const ESTADO: Record<string, { label: string; color: string }> = {
  bom: { label: "BOM", color: "#16A34A" }, regular: { label: "REGULAR", color: "#F59E0B" },
  ruim: { label: "RUIM", color: "#EA580C" }, critico: { label: "CRÍTICO", color: "#DC2626" },
  pendente: { label: "PENDENTE", color: "#64748B" },
};

const sevOf = (gut: number) => (gut >= 64 ? "critica" : gut >= 27 ? "alta" : gut >= 8 ? "media" : "baixa");

export default function Patologia() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [obra, setObra] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const pub = await api<any>(`/public/obras/${id}`, { auth: false });
        let an = pub.demo_analysis || null;
        if (!an && (await getStoredUser())) an = (await api<any>(`/obras/${id}`)).analysis || null;
        setObra(pub);
        setAnalysis(an);
        if (!an) setError("Faça login para ver a análise desta obra.");
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]));

  const res = analysis?.resultado || {};
  const fonte = res.fonte || obra?.demo_fonte;
  const estado = ESTADO[res.estado_geral] || ESTADO.pendente;
  const manif: any[] = res.manifestacoes || [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>{analysis?.demo ? "LAUDO DE DEMONSTRAÇÃO" : "PATOLOGIA DAS CONSTRUÇÕES"}</Text>
          <Text style={styles.hTitle} numberOfLines={2}>{obra?.name || "Laudo"}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : error && !analysis ? (
        <View style={styles.scroll}><Text style={styles.err}>{error}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {analysis?.demo && fonte ? (
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>BASEADO EM LAUDO REAL</Text>
              <Text style={styles.text}>{fonte.titulo}</Text>
              <Text style={styles.meta}>{fonte.instituicao} • {fonte.data}</Text>
              {fonte.observacao ? <Text style={styles.meta}>{fonte.observacao}</Text> : null}
              <Pressable onPress={() => Linking.openURL(fonte.url)}><Text style={styles.link}>Abrir o relatório original (PDF)</Text></Pressable>
            </View>
          ) : null}

          <View style={[styles.scoreBox, { borderColor: estado.color }]}>
            <Text style={styles.scoreLabel}>ESTADO GERAL ESTIMADO</Text>
            <Text style={[styles.scoreValue, { color: estado.color }]}>{estado.label}</Text>
            <Text style={styles.scoreSub}>
              {res.origem === "laudo" ? `${res.itens_laudo} grupos de manifestações do laudo` : `${res.fotos_analisadas ?? 0} de ${res.fotos ?? 0} foto(s) analisadas`} • maior GUT {res.gut_maximo ?? 0}
            </Text>
          </View>

          {Object.keys(res.por_tipo || {}).length ? (
            <View style={styles.chips}>
              {Object.entries(res.por_tipo).map(([k, v]) => (
                <View key={k} style={styles.chip}><Text style={styles.chipText}>{k.toUpperCase()} • {String(v)}</Text></View>
              ))}
            </View>
          ) : null}

          <Text style={styles.section}>MANIFESTAÇÕES POR PRIORIDADE (GUT = G × U × T)</Text>
          {manif.map((m, i) => (
            <View key={i} style={[styles.card, { borderLeftColor: severityColor[sevOf(m.gut)] }]}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{String(m.tipo || "manifestação").toUpperCase()}</Text>
                <Text style={[styles.gut, { backgroundColor: severityColor[sevOf(m.gut)] }]}>GUT {m.gut}</Text>
              </View>
              <Text style={styles.meta}>{m.localizacao}{m.elemento ? ` • ${m.elemento}` : ""}</Text>
              {m.descricao ? <Text style={styles.text}>{m.descricao}</Text> : null}
              {m.causa_provavel ? <Text style={styles.text}><Text style={styles.bold}>Causa: </Text>{m.causa_provavel}</Text> : null}
              {m.recomendacao ? <Text style={styles.text}><Text style={styles.bold}>Recomendação: </Text>{m.recomendacao}</Text> : null}
              <Text style={styles.meta}>
                G{m.gravidade} × U{m.urgencia} × T{m.tendencia}
                {m.gut_origem === "simulacao" ? " • GUT da simulação" : ""}
                {m.origem_recomendacao === "simulacao" ? " • recomendação da simulação" : m.origem_recomendacao === "laudo" ? " • recomendação do laudo" : ""}
              </Text>
            </View>
          ))}

          {analysis?.parecer ? (
            <View style={styles.parecer}>
              <Text style={styles.section}>PARECER</Text>
              <Text style={styles.text}>{analysis.parecer.replace(/\*\*/g, "").replace(/_/g, "")}</Text>
            </View>
          ) : null}
          <Text style={styles.meta}>Ferramenta de apoio à decisão. Confirme em vistoria técnica presencial (NBR 16747) antes de emitir laudo.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] },
  err: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.error },
  demoBox: { borderWidth: 2, borderColor: colors.warning, padding: spacing.md, gap: 4, backgroundColor: colors.surfaceSecondary },
  demoTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 1.5, color: colors.warning },
  scoreBox: { borderWidth: 3, padding: spacing.lg, backgroundColor: colors.surfaceInverse, gap: 2 },
  scoreLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.brandTertiary, fontWeight: "700" },
  scoreValue: { fontFamily: fonts.display, fontSize: fontSize["4xl"], fontWeight: "900", letterSpacing: -1 },
  scoreSub: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurfaceInverse },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, paddingVertical: 2, backgroundColor: colors.surfaceSecondary },
  chipText: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, fontWeight: "700", color: colors.onSurface },
  section: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.2, color: colors.info, fontWeight: "700" },
  card: { borderWidth: 2, borderColor: colors.borderStrong, borderLeftWidth: 8, padding: spacing.md, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface, letterSpacing: 0.5 },
  gut: { fontFamily: fonts.mono, fontWeight: "700", fontSize: fontSize.xs, color: "#FFFFFF", paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, lineHeight: Math.round(fontSize.sm * 1.45) },
  bold: { fontWeight: "900" },
  meta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info },
  link: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.brand, textDecorationLine: "underline", marginTop: 2 },
  parecer: { borderWidth: 2, borderColor: colors.borderStrong, borderStyle: "dashed", padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surfaceSecondary },
}));
