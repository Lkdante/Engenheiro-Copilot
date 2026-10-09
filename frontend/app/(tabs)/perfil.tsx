import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { clearAuth, getActiveObra, getStoredUser, type ObraRef } from "@/src/api";
import { spacing, fonts, fontSize, roleLabel } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

const MENU: { id: string; title: string; sub: string; icon: any; route: string }[] = [
  { id: "obras", title: "TROCAR DE OBRA", sub: "Voltar ao menu de obras", icon: "business", route: "/obras" },
  { id: "config", title: "CONFIGURAÇÕES", sub: "Tema escuro • acessibilidade • privacidade", icon: "settings", route: "/configuracoes" },
  { id: "rdo", title: "RDO POR VOZ", sub: "Grave, transcreva com IA", icon: "mic", route: "/rdo" },
  { id: "photos", title: "FOTOS IA", sub: "Galeria auto-classificada", icon: "images", route: "/photos" },
  { id: "inspect", title: "INSPEÇÃO IA", sub: "Analisar foto do canteiro", icon: "scan", route: "/inspect" },
  { id: "epis", title: "CONTROLE DE EPIs", sub: "Entregas + assinatura", icon: "shield-checkmark", route: "/epis" },
  { id: "quality", title: "FVS / FVM", sub: "Ensaios e inspeções", icon: "ribbon", route: "/quality" },
  { id: "integrations", title: "INTEGRAÇÕES", sub: "ERP • BIM • WhatsApp • Excel", icon: "git-network", route: "/integrations" },
];

export default function Perfil() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [obra, setObra] = useState<ObraRef | null>(null);

  useFocusEffect(useCallback(() => { (async () => { setUser(await getStoredUser()); setObra(await getActiveObra()); })(); }, []));

  const logout = async () => {
    await clearAuth();
    router.replace("/obras");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.hLabel}>{obra ? `OBRA: ${obra.name.toUpperCase()}` : "PERFIL & FERRAMENTAS"}</Text>
        <Text style={styles.hTitle}>{user?.name || "—"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.onBrand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleText}>{roleLabel[user?.role] || user?.role}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>FERRAMENTAS</Text>
        {MENU.map((m) => (
          <Pressable key={m.id} testID={`menu-${m.id}`} onPress={() => (m.id === "obras" ? router.replace("/obras") : router.push(m.route as any))} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.itemIcon}>
              <Ionicons name={m.icon} size={22} color={colors.onSurface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{m.title}</Text>
              <Text style={styles.itemSub}>{m.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.info} />
          </Pressable>
        ))}

        <Pressable testID="logout-btn" onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>SAIR</Text>
        </Pressable>

        <Text style={styles.legal}>Engenheiro de Campo IA v1.0 • Diferencial: ChatGPT para Engenharia de Campo — supera Procore, Fieldwire, Mobuss e Sienge em automação com IA nativa (voz, visão, contexto).</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing["2xl"] },
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surfaceInverse },
  avatar: { width: 56, height: 56, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  userName: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "900", color: colors.onSurfaceInverse, letterSpacing: -0.3 },
  userEmail: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.brandTertiary, marginTop: 2 },
  roleTag: { alignSelf: "flex-start", marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.brand },
  roleText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onBrand, fontWeight: "700", letterSpacing: 1 },
  sectionLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.xs },
  item: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md, minHeight: 64 },
  itemIcon: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: -0.2 },
  itemSub: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, marginTop: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, borderWidth: 2, borderColor: colors.error, padding: spacing.md, backgroundColor: colors.surface },
  logoutText: { color: colors.error, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  legal: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, textAlign: "center", marginTop: spacing.xl, lineHeight: 16 },
}));
