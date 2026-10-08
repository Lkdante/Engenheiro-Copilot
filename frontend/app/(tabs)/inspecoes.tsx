import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, spacing, fonts, fontSize, severityColor } from "@/src/theme";

const CHIPS = [
  { id: "checklists", label: "CHECKLISTS" },
  { id: "inspecoes", label: "INSPEÇÕES IA" },
  { id: "nc", label: "NÃO CONFORMIDADES" },
  { id: "alertas", label: "ALERTAS" },
];

export default function Inspecoes() {
  const router = useRouter();
  const [tab, setTab] = useState("checklists");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === "checklists" ? "/checklists" : tab === "inspecoes" ? "/inspections" : tab === "nc" ? "/nc" : "/alerts";
      const r = await api<{ items: any[] }>(endpoint);
      setItems(r.items || []);
    } catch (e) { console.warn(e); }
    setLoading(false); setRefresh(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.hLabel}>INSPEÇÕES & QUALIDADE</Text>
        <Text style={styles.hTitle}>Fiscalização</Text>
      </View>

      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {CHIPS.map((c) => (
            <Pressable key={c.id} testID={`chip-${c.id}`} onPress={() => setTab(c.id)} style={[styles.chip, tab === c.id && styles.chipActive]}>
              <Text style={[styles.chipText, tab === c.id && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}>
        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.info} />
            <Text style={styles.emptyText}>Nenhum item encontrado</Text>
          </View>
        ) : items.map((it) => (
          <Pressable key={it.id} testID={`item-${it.id}`} style={styles.card} onPress={() => {
            if (tab === "checklists") {
              router.push({ pathname: "/checklist/[id]", params: { id: it.id } } as any);
            } else if (tab === "inspecoes") {
              router.push("/inspect" as any);
            }
          }}>
            {tab === "checklists" && (
              <>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{(it.service_type || "").toString().toUpperCase()}</Text>
                  <View style={[styles.badge, it.status === "concluido" ? { backgroundColor: colors.success } : it.status === "reprovado" ? { backgroundColor: colors.error } : { backgroundColor: colors.surfaceTertiary }]}>
                    <Text style={[styles.badgeText, (it.status === "concluido" || it.status === "reprovado") && { color: colors.onBrand }]}>
                      {it.status === "concluido" ? "OK" : it.status === "reprovado" ? "REPROVADO" : "EM ANDAM."}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{it.items?.length || 0} itens • {new Date(it.created_at).toLocaleDateString("pt-BR")}</Text>
              </>
            )}
            {tab === "inspecoes" && (
              <>
                <Text style={styles.cardTitle}>INSPEÇÃO IA</Text>
                <Text style={styles.cardMeta}>{it.location || "Sem local"} • {it.analysis?.issues?.length || 0} ocorrências</Text>
                <Text style={styles.cardBody}>{it.analysis?.summary || "—"}</Text>
              </>
            )}
            {tab === "nc" && (
              <>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{it.title}</Text>
                  <View style={[styles.badge, { backgroundColor: severityColor[it.severity] || colors.info }]}>
                    <Text style={[styles.badgeText, { color: colors.onBrand }]}>{(it.severity || "").toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.cardBody} numberOfLines={2}>{it.description}</Text>
                <Text style={styles.cardMeta}>{it.status === "resolvido" ? "RESOLVIDO" : "ABERTA"} • {new Date(it.created_at).toLocaleDateString("pt-BR")}</Text>
              </>
            )}
            {tab === "alertas" && (
              <>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{it.title}</Text>
                  <View style={[styles.badge, { backgroundColor: severityColor[it.severity] || colors.warning }]}>
                    <Text style={[styles.badgeText, { color: colors.onBrand }]}>{(it.severity || "").toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.cardBody}>{it.description}</Text>
              </>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        testID="fab-new-checklist"
        onPress={() => router.push("/new-checklist" as any)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={22} color={colors.onBrand} />
        <Text style={styles.fabText}>NOVA INSPEÇÃO</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  chipsRow: { height: 56, borderBottomWidth: 2, borderBottomColor: colors.borderStrong, backgroundColor: colors.surface },
  chipsScroll: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", paddingVertical: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brand },
  chipText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  chipTextActive: { color: colors.onBrand },
  scroll: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  empty: { alignItems: "center", padding: spacing["2xl"] },
  emptyText: { fontFamily: fonts.mono, color: colors.info, marginTop: spacing.md },
  card: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surface, gap: spacing.xs },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  cardTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: -0.2, flex: 1 },
  cardBody: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, lineHeight: 20 },
  cardMeta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, letterSpacing: 0.5 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 2, borderColor: colors.borderStrong },
  badgeText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  fab: { position: "absolute", bottom: spacing.lg, right: spacing.lg, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fabText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 0.5 },
});
