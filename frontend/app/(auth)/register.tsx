import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, saveAuth } from "@/src/api";
import { colors, spacing, fonts, fontSize, roleLabel } from "@/src/theme";

const ROLES = ["engenheiro", "tec_seguranca", "almoxarife", "mestre_obras", "estagiario", "diretor", "admin"];

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("engenheiro");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const [claim, setClaim] = useState("");

  // Depois do cadastro, pergunta ao backend a cada 3 s se o link do e-mail já foi aberto.
  // Quando foi, o backend devolve o login pronto e o app entra sozinho.
  useEffect(() => {
    if (!claim) return;
    let ativo = true;
    const timer = setInterval(async () => {
      try {
        const r = await api<{ confirmed: boolean; token?: string; user?: any }>("/auth/register/status", { method: "POST", body: { claim }, auth: false });
        if (ativo && r.confirmed && r.token) {
          clearInterval(timer);
          await saveAuth(r.token, r.user);
          router.replace("/(tabs)");
        }
      } catch (e: any) {
        if (e?.status === 404) clearInterval(timer); // código vencido ou já usado
      }
    }, 3000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [claim]);
  const submit = async () => {
    setErr("");
    if (name.trim().length < 2) return setErr("Informe seu nome completo.");
    if (!email.trim() || !email.includes("@")) return setErr("Informe um e-mail válido.");
    if (password.length < 6) return setErr("A senha precisa ter pelo menos 6 caracteres.");
    setLoading(true);
    try {
      const r = await api<{ token?: string; user?: any; pending?: boolean; message?: string; claim?: string }>("/auth/register", { method: "POST", body: { name: name.trim(), email: email.trim(), password, role }, auth: false });
      if (r.token) {
        await saveAuth(r.token, r.user);
        router.replace("/(tabs)");
        return;
      }
      // A conta só é criada depois que a pessoa abre o link do e-mail
      setSent(r.message || "Enviamos um link de confirmação para o seu e-mail.");
      setClaim(r.claim || "");
    } catch (e: any) {
      setErr(e?.message || "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="register-back">
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>NOVA CONTA</Text>

          {sent ? (
            <View style={styles.okBox} testID="register-sent">
              <Ionicons name="mail-unread" size={28} color={colors.brand} />
              <Text style={styles.okTitle}>CONFIRME SEU E-MAIL</Text>
              <Text style={styles.okText}>{sent}</Text>
              {claim ? (
                <View style={styles.waitRow} testID="register-waiting">
                  <ActivityIndicator color={colors.brand} />
                  <Text style={styles.waitText}>Aguardando você abrir o link... assim que confirmar, você entra automaticamente.</Text>
                </View>
              ) : null}
              <Pressable testID="register-resend" onPress={submit} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}>
                {loading ? <ActivityIndicator color={colors.onSurface} /> : <Text style={styles.secondaryBtnText}>REENVIAR E-MAIL</Text>}
              </Pressable>
              <Pressable testID="register-goto-login" onPress={() => router.replace("/(auth)/login" as any)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>JÁ CONFIRMEI, IR PARA O LOGIN</Text>
              </Pressable>
            </View>
          ) : (
          <>

          <Text style={styles.label}>NOME COMPLETO</Text>
          <TextInput testID="register-name" value={name} onChangeText={setName} style={styles.input} placeholder="Seu nome" placeholderTextColor={colors.info} />

          <Text style={styles.label}>E-MAIL</Text>
          <TextInput testID="register-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder="voce@obra.com" placeholderTextColor={colors.info} />

          <Text style={styles.label}>SENHA</Text>
          <TextInput testID="register-password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="Mín. 6 caracteres" placeholderTextColor={colors.info} />


          <Text style={styles.label}>CARGO</Text>
          <View style={styles.rolesRow}>
            {ROLES.map((r) => (
              <Pressable key={r} testID={`register-role-${r}`} onPress={() => setRole(r)} style={[styles.roleChip, role === r && styles.roleChipActive]}>
                <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{roleLabel[r]}</Text>
              </Pressable>
            ))}
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}
          <Pressable testID="register-submit" onPress={submit} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
            {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>CRIAR CONTA</Text>}
          </Pressable>
          </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  back: { width: 44, height: 44, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginBottom: spacing.lg },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.md, fontWeight: "700" },
  input: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 48 },
  rolesRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  roleChip: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  roleChipActive: { backgroundColor: colors.brand },
  roleChipText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  roleChipTextActive: { color: colors.onBrand },
  primaryBtn: { marginTop: spacing.xl, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.lg, alignItems: "center", minHeight: 52 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  err: { color: colors.error, fontFamily: fonts.mono, fontSize: fontSize.sm, marginTop: spacing.md },
  okBox: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.lg, backgroundColor: colors.brandTertiary, gap: spacing.sm },
  okTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, letterSpacing: 0.5, color: colors.onSurface },
  okText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  waitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  waitText: { flex: 1, fontFamily: fonts.mono, fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface },
  secondaryBtn: { marginTop: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingVertical: spacing.lg, alignItems: "center", minHeight: 52 },
  secondaryBtnText: { color: colors.onSurface, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
});
