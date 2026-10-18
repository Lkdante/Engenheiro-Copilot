import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, clearAuth, getStoredUser } from "@/src/api";
import { colors, spacing, fonts, fontSize, roleLabel } from "@/src/theme";

const MENU: { id: string; title: string; sub: string; icon: any; route: string }[] = [
  { id: "rdo", title: "RDO POR VOZ", sub: "Grave, transcreva com IA", icon: "mic", route: "/rdo" },
  { id: "photos", title: "FOTOS IA", sub: "Galeria auto-classificada", icon: "images", route: "/photos" },
  { id: "inspect", title: "INSPEÇÃO IA", sub: "Analisar foto do canteiro", icon: "scan", route: "/inspect" },
  { id: "epis", title: "CONTROLE DE EPIs", sub: "Entregas + assinatura", icon: "shield-checkmark", route: "/epis" },
  { id: "quality", title: "FVS / FVM", sub: "Ensaios e inspeções", icon: "ribbon", route: "/quality" },
  { id: "integrations", title: "INTEGRAÇÕES", sub: "ERP • BIM • WhatsApp • Excel", icon: "git-network", route: "/integrations" },
];

export default function Perfil() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [verifyMsg, setVerifyMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { (async () => setUser(await getStoredUser()))(); }, []);

  // Toda vez que a tela abre, busca o usuário atualizado (ex.: e-mail confirmado agora há pouco)
  useFocusEffect(useCallback(() => {
    api("/auth/me").then(setUser).catch(() => {});
  }, []));

  const resendVerification = async () => {
    setSending(true);
    setVerifyMsg("");
    try {
      const r = await api<{ message: string }>("/auth/resend-verification", { method: "POST" });
      setVerifyMsg(r.message);
    } catch (e: any) {
      setVerifyMsg(e?.message || "Erro ao reenviar o link");
    } finally {
      setSending(false);
    }
  };

  // Excluir conta: pede a senha de novo antes de apagar
  const [deleting, setDeleting] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const deleteAccount = async () => {
    setDeleteErr("");
    if (!deletePw) return setDeleteErr("Digite sua senha para confirmar.");
    setDeleteBusy(true);
    try {
      await api("/auth/delete-account", { method: "POST", body: { password: deletePw } });
      await clearAuth();
      router.replace("/(auth)/login");
    } catch (e: any) {
      setDeleteErr(e?.message || "Não foi possível excluir a conta.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const logout = async () => {
    await clearAuth();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.hLabel}>PERFIL & FERRAMENTAS</Text>
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

        {user && user.email_verified === false ? (
          <View style={styles.verifyBox} testID="verify-banner">
            <Text style={styles.verifyTitle}>CONFIRME SEU E-MAIL</Text>
            <Text style={styles.verifyText}>Enviamos um link para {user.email}. Abra o e-mail e toque no link para confirmar sua conta.</Text>
            {verifyMsg ? <Text style={styles.verifyMsg}>{verifyMsg}</Text> : null}
            <Pressable testID="verify-resend" onPress={resendVerification} style={({ pressed }) => [styles.verifyBtn, pressed && { opacity: 0.85 }]}>
              {sending ? <ActivityIndicator color={colors.onSurface} /> : <Text style={styles.verifyBtnText}>REENVIAR LINK</Text>}
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>FERRAMENTAS</Text>
        {MENU.map((m) => (
          <Pressable key={m.id} testID={`menu-${m.id}`} onPress={() => router.push(m.route as any)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceSecondary }]}>
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

        {!deleting ? (
          <Pressable testID="delete-account-btn" onPress={() => setDeleting(true)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteText}>EXCLUIR CONTA</Text>
          </Pressable>
        ) : (
          <View style={styles.deleteBox} testID="delete-account-box">
            <Text style={styles.deleteTitle}>EXCLUIR SUA CONTA?</Text>
            <Text style={styles.deleteInfo}>
              Sua conta e seus dados pessoais serão apagados e isso não pode ser desfeito. Os registros da obra que você criou continuam, sem o seu nome.
            </Text>
            <Text style={styles.deleteLabel}>DIGITE SUA SENHA PARA CONFIRMAR</Text>
            <TextInput
              testID="delete-account-password"
              value={deletePw}
              onChangeText={setDeletePw}
              secureTextEntry
              // Não deixa o navegador/celular preencher a senha salva sozinho: a pessoa tem que digitar
              autoComplete="new-password"
              importantForAutofill="no"
              textContentType="none"
              autoCorrect={false}
              style={styles.deleteInput}
              placeholder="Sua senha"
              placeholderTextColor={colors.info}
            />
            {deleteErr ? <Text style={styles.deleteErr}>{deleteErr}</Text> : null}
            <Pressable testID="delete-account-confirm" onPress={deleteAccount} style={({ pressed }) => [styles.deleteConfirm, pressed && { opacity: 0.85 }]}>
              {deleteBusy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.deleteConfirmText}>EXCLUIR DEFINITIVAMENTE</Text>}
            </Pressable>
            <Pressable testID="delete-account-cancel" onPress={() => { setDeleting(false); setDeletePw(""); setDeleteErr(""); }} style={styles.deleteCancel}>
              <Text style={styles.deleteCancelText}>CANCELAR</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.legal}>Engenheiro de Campo IA v1.0 • Diferencial: ChatGPT para Engenharia de Campo — supera Procore, Fieldwire, Mobuss e Sienge em automação com IA nativa (voz, visão, contexto).</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing["2xl"] },
  verifyBox: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.brandTertiary, padding: spacing.md, gap: spacing.xs },
  verifyTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1, color: colors.onSurface },
  verifyText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  verifyMsg: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, fontWeight: "700" },
  verifyBtn: { marginTop: spacing.sm, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", minHeight: 44 },
  verifyBtnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 1, color: colors.onSurface },
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
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md, minHeight: 44 },
  deleteText: { color: colors.error, fontFamily: fonts.mono, fontWeight: "700", fontSize: fontSize.sm, letterSpacing: 1, textDecorationLine: "underline" },
  deleteBox: { marginTop: spacing.sm, borderWidth: 2, borderColor: colors.error, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  deleteTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1, color: colors.error },
  deleteInfo: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  deleteLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, fontWeight: "700", marginTop: spacing.xs },
  deleteInput: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, minHeight: 48 },
  deleteErr: { color: colors.error, fontFamily: fonts.mono, fontSize: fontSize.sm },
  deleteConfirm: { backgroundColor: colors.error, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", minHeight: 48 },
  deleteConfirmText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 1 },
  deleteCancel: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  deleteCancelText: { color: colors.onSurface, fontFamily: fonts.mono, fontWeight: "700", fontSize: fontSize.sm, letterSpacing: 1 },
  legal: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, textAlign: "center", marginTop: spacing.xl, lineHeight: 16 },
});
