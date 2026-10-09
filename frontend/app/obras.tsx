// Menu de Obras — tela inicial PÚBLICA. Qualquer pessoa vê as obras e suas especificações.
// Para acessar os dados internos de uma obra é preciso fazer login (na tela de detalhe).
import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, clearAuth, getActiveObra, getStoredUser } from "@/src/api";
import { spacing, fonts, roleLabel } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";
import { formatDateBR, sizeLabel, type PublicObra } from "@/src/obra";



const MANAGERS = ["admin", "engenheiro", "diretor"];

/** Remove acentos e caixa para a busca ("Edifício" encontra "edificio"). */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ObrasMenu() {
  const { colors, settings } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [items, setItems] = useState<PublicObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await api<{ items: PublicObra[] }>("/public/obras", { auth: false });
      setItems(r.items || []);
      setUser(await getStoredUser<any>());
      setActiveId((await getActiveObra())?.id || null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => {
    const q = norm(query.trim());
    let list = items.filter((o) => !q || norm(o.name).includes(q));
    if (!settings.showFinished) list = list.filter((o) => (o.progress ?? 0) < 100);
    const sorted = [...list];
    if (settings.sortBy === "nome") sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else if (settings.sortBy === "termino") sorted.sort((a, b) => (a.end_date || "9999").localeCompare(b.end_date || "9999"));
    else sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return sorted;
  }, [items, query, settings.showFinished, settings.sortBy]);

  const logout = async () => {
    await clearAuth();
    setUser(null);
    setActiveId(null);
  };

  const compact = settings.cardMode === "compacto";
  const canManage = !!user && MANAGERS.includes(user.role);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>ENGENHEIRO DE CAMPO IA</Text>
          <Text style={styles.hTitle}>Obras</Text>
        </View>
        <Pressable testID="menu-config" onPress={() => router.push("/configuracoes")} style={styles.iconBtn} accessibilityLabel="Configurações">
          <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
        </Pressable>
        {user ? (
          <Pressable testID="menu-logout" onPress={logout} style={styles.iconBtn} accessibilityLabel="Sair da conta">
            <Ionicons name="log-out-outline" size={20} color={colors.onSurface} />
          </Pressable>
        ) : (
          <Pressable testID="menu-login" onPress={() => router.push("/(auth)/login")} style={styles.loginBtn} accessibilityLabel="Entrar">
            <Ionicons name="person" size={16} color={colors.onBrand} />
            <Text style={styles.loginText}>ENTRAR</Text>
          </Pressable>
        )}
      </View>

      {user ? (
        <View style={styles.userBar}>
          <Ionicons name="person-circle" size={18} color={colors.brand} />
          <Text style={styles.userText} numberOfLines={1}>
            {user.name} • {roleLabel[user.role] || user.role}
          </Text>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.info} />
        <TextInput
          testID="menu-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Pesquisar obra pelo nome"
          placeholderTextColor={colors.info}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Pesquisar obras pelo nome"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} accessibilityLabel="Limpar pesquisa" hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.info} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>TENTAR DE NOVO</Text></Pressable>
            </View>
          ) : (
            <Text style={styles.count}>
              {visible.length} {visible.length === 1 ? "obra" : "obras"}{query ? ` para "${query}"` : " em andamento"}
            </Text>
          )}

          {!error && visible.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name={query ? "search" : "business"} size={32} color={colors.brand} />
              <Text style={styles.emptyTitle}>{query ? "NENHUMA OBRA ENCONTRADA" : "NENHUMA OBRA CADASTRADA"}</Text>
              <Text style={styles.emptyText}>
                {query ? "Confira o nome digitado." : canManage ? "Toque no botão + para cadastrar a primeira obra." : "Entre com uma conta de engenheiro para cadastrar obras."}
              </Text>
            </View>
          ) : null}

          {visible.map((o) => (
            <Pressable
              key={o.id}
              testID={`obra-card-${o.id}`}
              onPress={() => router.push({ pathname: "/obra-detalhe", params: { id: o.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Obra ${o.name}, ${Math.round(o.progress || 0)} por cento concluída`}
              style={({ pressed }) => [styles.card, o.id === activeId && styles.cardActive, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={2}>{o.name}</Text>
                  <View style={styles.row}>
                    <Ionicons name="location" size={12} color={colors.info} />
                    <Text style={styles.cardMeta} numberOfLines={1}>{o.address || "—"}</Text>
                  </View>
                </View>
                {o.size ? <View style={styles.sizeTag}><Text style={styles.sizeText}>{sizeLabel(o.size)}</Text></View> : null}
              </View>

              <View style={styles.progressRow}>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(100, o.progress || 0)}%` }]} /></View>
                <Text style={styles.progressText}>{Math.round(o.progress || 0)}%</Text>
              </View>

              {!compact ? (
                <>
                  <View style={styles.infoGrid}>
                    <Info icon="calendar" label="INÍCIO" value={formatDateBR(o.start_date)} />
                    <Info icon="flag" label="TÉRMINO PREV." value={formatDateBR(o.end_date)} />
                    <Info icon="people" label="FUNCIONÁRIOS" value={String(o.workers_total ?? 0)} />
                    <Info icon="document-text" label="ART" value={o.art || "—"} />
                  </View>
                  <View style={styles.cardFoot}>
                    <Text style={styles.cardMeta} numberOfLines={1}>{o.company || "Empresa não informada"}</Text>
                    {o.id === activeId ? <Text style={styles.activeText}>ÚLTIMA ACESSADA</Text> : <Ionicons name="chevron-forward" size={18} color={colors.info} />}
                  </View>
                  {o.days_left !== null && o.days_left < 0 && (o.progress ?? 0) < 100 ? (
                    <Text style={styles.lateText}>Prazo vencido há {-o.days_left} dias</Text>
                  ) : null}
                </>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}

      {canManage ? (
        <Pressable testID="obras-add" onPress={() => router.push("/obra-nova")} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]} accessibilityLabel="Cadastrar obra">
          <Ionicons name="add" size={32} color={colors.onBrand} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function Info({ icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}><Ionicons name={icon} size={10} color={colors.info} /> {label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  loginBtn: { flexDirection: "row", gap: 6, alignItems: "center", height: 44, paddingHorizontal: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.brand },
  loginText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onBrand, letterSpacing: 1 },
  userBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  userText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", flex: 1 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, margin: spacing.lg, marginBottom: 0, paddingHorizontal: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, minHeight: 48 },
  searchInput: { flex: 1, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, paddingVertical: spacing.sm },
  count: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, fontWeight: "700", letterSpacing: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  card: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  cardActive: { borderColor: colors.brand, borderWidth: 3 },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  cardName: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.3 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardMeta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, flexShrink: 1 },
  sizeTag: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, paddingVertical: 2, backgroundColor: colors.surfaceSecondary },
  sizeText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onSurface, letterSpacing: 0.5 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressBar: { flex: 1, height: 10, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary },
  progressFill: { height: "100%", backgroundColor: colors.brand },
  progressText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, minWidth: 44, textAlign: "right" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  info: { width: "48%", borderWidth: 1, borderColor: colors.border, padding: spacing.sm, backgroundColor: colors.surfaceSecondary },
  infoLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, color: colors.info, fontWeight: "700", letterSpacing: 0.5 },
  infoValue: { fontFamily: fonts.display, fontSize: fontSize.base, fontWeight: "900", color: colors.onSurface, marginTop: 2 },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  activeText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.brand, letterSpacing: 1 },
  lateText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.error, fontWeight: "700" },
  empty: { alignItems: "center", gap: spacing.sm, borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.xl, backgroundColor: colors.surfaceSecondary },
  emptyTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: 0.5 },
  emptyText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.info, textAlign: "center" },
  errorBox: { borderWidth: 2, borderColor: colors.error, padding: spacing.md, gap: spacing.sm },
  errorText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.error },
  retryBtn: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.sm, alignItems: "center" },
  retryText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface },
  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing["2xl"], width: 64, height: 64,
    backgroundColor: colors.brand, borderWidth: 3, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center",
  },
}));
