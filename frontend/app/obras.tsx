// Menu de Obras — tela inicial PÚBLICA. Qualquer pessoa vê as obras e suas especificações.
// Para acessar os dados internos de uma obra é preciso fazer login (na tela de detalhe).
import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, TextInput, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, clearAuth, getActiveObra, getStoredUser } from "@/src/api";
import { spacing, fonts, roleLabel } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";
import { formatDateBR, sizeLabel, type PublicObra } from "@/src/obra";
import KindAlert from "@/src/components/KindAlert";
import { notify } from "@/src/notify";
import { takePreloadedObras } from "@/src/preload";

// Fundo dos cartões sem foto: planta baixa genérica (traço brutalista), bem suave
const PLANTA = require("../assets/images/obra-planta-generica.png");
const ON_PHOTO = "#FFFFFF";



const MANAGERS = ["admin", "engenheiro", "diretor"];

/** Remove acentos e caixa para a busca ("Edifício" encontra "edificio"). */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ObrasMenu() {
  const { colors, settings } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  // A tela de carregamento já buscou a lista: abre o menu com ela, sem esperar outra requisição
  const [preloaded] = useState(() => takePreloadedObras());
  const [items, setItems] = useState<PublicObra[]>(preloaded || []);
  const [loading, setLoading] = useState(!preloaded);
  const skipFirstFetch = useRef(!!preloaded);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // fotos que não carregaram (sem internet, link fora do ar): o cartão volta ao visual com a planta
  const [badCover, setBadCover] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setError("");
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      setUser(await getStoredUser<any>());
      setActiveId((await getActiveObra())?.id || null);
      return;
    }
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
    notify({ kind: "info", title: "Você saiu da conta", message: "Entre com outro usuário quando quiser." });
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

          {visible.map((o) => {
            const ph = !!o.cover_url && !badCover[o.id]; // cartão com foto
            return (
            <Pressable
              key={o.id}
              testID={`obra-card-${o.id}`}
              onPress={() => router.push({ pathname: "/obra-detalhe", params: { id: o.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Obra ${o.name}, ${Math.round(o.progress || 0)} por cento concluída`}
              style={({ pressed }) => [styles.card, ph && styles.cardPhoto, o.id === activeId && styles.cardActive, pressed && { opacity: 0.85 }]}
            >
              {/* fundo: foto da obra escurecida 30%  —  ou, sem foto, a planta genérica bem suave */}
              {ph ? (
                <>
                  <Image source={{ uri: o.cover_url! }} style={styles.cardBg} resizeMode="cover"
                    onError={() => setBadCover((b) => ({ ...b, [o.id]: true }))} accessibilityIgnoresInvertColors />
                  <View style={styles.cardShade} />
                </>
              ) : (
                <Image source={PLANTA} style={[styles.cardBg, styles.cardPlan]} resizeMode="cover" />
              )}
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  {o.demo ? <Text style={styles.demoTag}>{o.kind === "patologia" ? "DEMONSTRAÇÃO • LAUDO REAL" : "DEMONSTRAÇÃO • OBRA REAL"}</Text> : null}
                  <Text style={[styles.cardName, ph && styles.onPhoto]} numberOfLines={2}>{o.name}</Text>
                  <View style={styles.row}>
                    <Ionicons name="location" size={12} color={ph ? ON_PHOTO : colors.info} />
                    <Text style={[styles.cardMeta, ph && styles.onPhotoSoft]} numberOfLines={1}>{o.address || "—"}</Text>
                  </View>
                </View>
                {o.size ? <View style={[styles.sizeTag, ph && styles.glass]}><Text style={[styles.sizeText, ph && styles.onPhoto]}>{sizeLabel(o.size)}</Text></View> : null}
              </View>

              <View style={styles.progressRow}>
                <View style={[styles.progressBar, ph && styles.glassBar]}><View style={[styles.progressFill, { width: `${Math.min(100, o.progress || 0)}%` }]} /></View>
                <Text style={[styles.progressText, ph && styles.onPhoto]}>{Math.round(o.progress || 0)}%</Text>
              </View>

              {!compact ? (
                <>
                  <View style={styles.infoGrid}>
                    <Info icon="calendar" label="INÍCIO" value={formatDateBR(o.start_date)} photo={ph} />
                    <Info icon="flag" label="TÉRMINO PREV." value={formatDateBR(o.end_date)} photo={ph} />
                    <Info icon="people" label="FUNCIONÁRIOS" value={String(o.workers_total ?? 0)} photo={ph} />
                    <Info icon="document-text" label="ART" value={o.art || "—"} photo={ph} />
                  </View>
                  <View style={styles.cardFoot}>
                    <Text style={[styles.cardMeta, ph && styles.onPhotoSoft]} numberOfLines={1}>{o.company || "Empresa não informada"}</Text>
                    {o.id === activeId ? <Text style={styles.activeText}>ÚLTIMA ACESSADA</Text> : <Ionicons name="chevron-forward" size={18} color={ph ? ON_PHOTO : colors.info} />}
                  </View>
                  {o.days_left !== null && o.days_left < 0 && (o.progress ?? 0) < 100 ? (
                    <Text style={styles.lateText}>Prazo vencido há {-o.days_left} dias</Text>
                  ) : null}
                </>
              ) : null}
              {ph ? <Text style={styles.credit} numberOfLines={1}>FOTO: WIKIMEDIA COMMONS</Text> : null}
              <KindAlert kind={o.kind} />
            </Pressable>
            );
          })}
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

function Info({ icon, label, value, photo }: { icon: any; label: string; value: string; photo?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.info, photo && styles.glass]}>
      <Text style={[styles.infoLabel, photo && styles.onPhotoSoft]}><Ionicons name={icon} size={10} color={photo ? ON_PHOTO : colors.info} /> {label}</Text>
      <Text style={[styles.infoValue, photo && styles.onPhoto]} numberOfLines={1}>{value}</Text>
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
  // cartão da obra: borda cinza, cantos arredondados (aplicados pelo tema) e fundo com foto ou planta
  card: { borderWidth: 2, borderColor: colors.borderStrong, /* claro: preto • escuro: cinza */ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, overflow: "hidden" },
  cardPhoto: { backgroundColor: "#000000" },
  cardBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  cardShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.30)" }, // escurece 30%
  cardPlan: { opacity: 0.35 },
  onPhoto: { color: "#FFFFFF", textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  onPhotoSoft: { color: "#F4F4F5", textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  glass: { backgroundColor: "rgba(0,0,0,0.45)", borderColor: "rgba(255,255,255,0.35)" },
  glassBar: { backgroundColor: "rgba(255,255,255,0.25)", borderColor: "rgba(255,255,255,0.6)" },
  credit: { fontFamily: fonts.mono, fontSize: fontSize.xs - 2, color: "rgba(255,255,255,0.75)", letterSpacing: 0.5, marginBottom: -spacing.xs },
  cardActive: { borderColor: colors.brand, borderWidth: 3 },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  demoTag: { alignSelf: "flex-start", fontFamily: fonts.mono, fontSize: fontSize.xs - 1, fontWeight: "700", letterSpacing: 1, color: colors.onBrand, backgroundColor: colors.brand, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 4 },
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
