// Minha conta: dados pessoais do usuário e exclusão da conta.
import { useCallback, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, clearAuth, getActiveObra, getStoredUser, type ObraRef } from "@/src/api";
import { spacing, fonts, roleLabel } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";
import { notify } from "@/src/notify";

function dataBR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MinhaConta() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [obra, setObra] = useState<ObraRef | null>(null);

  // Mostra na hora o que está salvo no aparelho e depois atualiza com o servidor
  useFocusEffect(useCallback(() => {
    (async () => {
      setUser(await getStoredUser());
      setObra(await getActiveObra());
    })();
    api("/auth/me").then(setUser).catch(() => {});
  }, []));

  // Excluir conta: pede a senha de novo antes de apagar
  const [deleting, setDeleting] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const isDemo = typeof user?.email === "string" && user.email.endsWith("@demo.com");

  const deleteAccount = async () => {
    setDeleteErr("");
    if (!deletePw) return setDeleteErr("Digite sua senha para confirmar.");
    setDeleteBusy(true);
    try {
      await api("/auth/delete-account", { method: "POST", body: { password: deletePw } });
      await clearAuth();
      notify({ kind: "info", title: "Conta excluída", message: "Sua conta e seus dados pessoais foram apagados." });
      router.replace("/obras");
    } catch (e: any) {
      setDeleteErr(e?.message || "Não foi possível excluir a conta.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const cancelDelete = () => {
    setDeleting(false);
    setDeletePw("");
    setDeleteErr("");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/perfil"))} style={styles.back} accessibilityLabel="Voltar" testID="conta-voltar">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>PERFIL</Text>
          <Text style={styles.hTitle}>Minha conta</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---------------- DADOS PESSOAIS ---------------- */}
        <Section icon="person-circle" title="DADOS PESSOAIS">
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || "?").trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="conta-nome">{user?.name || "—"}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleText}>{roleLabel[user?.role] || user?.role || "—"}</Text>
              </View>
            </View>
          </View>

          <Info label="E-MAIL" value={user?.email} testID="conta-email">
            {user ? (
              <View style={[styles.badge, user.email_verified ? styles.badgeOk : styles.badgeWarn]}>
                <Ionicons name={user.email_verified ? "checkmark-circle" : "alert-circle"} size={14} color={user.email_verified ? colors.success : colors.warning} />
                <Text style={styles.badgeText}>{user.email_verified ? "CONFIRMADO" : "NÃO CONFIRMADO"}</Text>
              </View>
            ) : null}
          </Info>
          <Info label="CARGO" value={roleLabel[user?.role] || user?.role} />
          <Info label="OBRA ATUAL" value={obra?.name || "Nenhuma obra selecionada"} />
          <Info label="CONTA CRIADA EM" value={dataBR(user?.created_at)} />
        </Section>

        {/* ---------------- EXCLUIR CONTA ---------------- */}
        <Section icon="warning" title="EXCLUIR CONTA" danger>
          <Text style={styles.hint}>
            Apaga sua conta e seus dados pessoais. Os registros da obra que você criou (RDOs, não conformidades, fotos) continuam, sem o seu nome. Isso não pode ser desfeito.
          </Text>

          {isDemo ? (
            <Text style={styles.demoNote} testID="conta-demo">Contas de demonstração não podem ser excluídas.</Text>
          ) : !deleting ? (
            <Pressable testID="delete-account-btn" onPress={() => setDeleting(true)} style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.deleteText}>EXCLUIR MINHA CONTA</Text>
            </Pressable>
          ) : (
            <View style={styles.deleteBox} testID="delete-account-box">
              <Text style={styles.label}>DIGITE SUA SENHA PARA CONFIRMAR</Text>
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
                style={styles.input}
                placeholder="Sua senha"
                placeholderTextColor={colors.info}
              />
              {deleteErr ? <Text style={styles.err}>{deleteErr}</Text> : null}
              <Pressable testID="delete-account-confirm" onPress={deleteAccount} style={({ pressed }) => [styles.deleteConfirm, pressed && { opacity: 0.85 }]}>
                {deleteBusy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.deleteConfirmText}>EXCLUIR DEFINITIVAMENTE</Text>}
              </Pressable>
              <Pressable testID="delete-account-cancel" onPress={cancelDelete} style={styles.cancel}>
                <Text style={styles.cancelText}>CANCELAR</Text>
              </Pressable>
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ icon, title, danger, children }: { icon: any; title: string; danger?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.section, danger && { borderColor: colors.error }]}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.brand} />
        <Text style={[styles.sectionTitle, danger && { color: colors.error }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Info({ label, value, testID, children }: { label: string; value?: string | null; testID?: string; children?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} testID={testID}>{value || "—"}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] },
  section: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs },
  sectionTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: 1 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xs },
  avatar: { width: 56, height: 56, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize["2xl"], color: colors.onBrand },
  name: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, color: colors.onSurface },
  roleTag: { alignSelf: "flex-start", backgroundColor: colors.surfaceInverse, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: spacing.xs },
  roleText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 1, color: colors.onSurfaceInverse },
  infoRow: { paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.info, fontWeight: "700", marginTop: spacing.xs },
  value: { fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: spacing.xs },
  badgeOk: { borderColor: colors.success },
  badgeWarn: { borderColor: colors.warning },
  badgeText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.5, color: colors.onSurface },
  hint: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, lineHeight: Math.round(fontSize.sm * 1.45) },
  demoNote: { fontFamily: fonts.mono, fontSize: fontSize.sm, fontWeight: "700", color: colors.info, marginTop: spacing.xs },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xs, borderWidth: 2, borderColor: colors.error, minHeight: 48 },
  deleteText: { color: colors.error, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 1 },
  deleteBox: { gap: spacing.sm, marginTop: spacing.xs },
  input: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 48 },
  err: { color: colors.error, fontFamily: fonts.mono, fontSize: fontSize.sm },
  deleteConfirm: { backgroundColor: colors.error, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", minHeight: 48 },
  deleteConfirmText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 1 },
  cancel: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  cancelText: { color: colors.onSurface, fontFamily: fonts.mono, fontWeight: "700", fontSize: fontSize.sm, letterSpacing: 1 },
}));
