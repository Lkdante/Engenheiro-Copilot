import { useState } from "react";
import { Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");

  const submit = async () => {
    setErr("");
    if (!email.trim() || !email.includes("@")) return setErr("Informe o e-mail da sua conta.");
    setLoading(true);
    try {
      const r = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email: email.trim() }, auth: false });
      setSent(r.message);
    } catch (e: any) {
      setErr(e?.message || "Erro ao enviar o pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="forgot-back">
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>ESQUECI MINHA SENHA</Text>

          {sent ? (
            <View style={styles.okBox} testID="forgot-sent">
              <Ionicons name="mail-unread" size={28} color={colors.brand} />
              <Text style={styles.okText}>{sent}</Text>
              <Text style={styles.okHint}>Abra o link do e-mail (vale por 1 hora) e crie uma senha nova. Depois é só entrar com ela.</Text>
              <Pressable onPress={() => router.back()} style={styles.primaryBtn} testID="forgot-back-login">
                <Text style={styles.primaryBtnText}>VOLTAR PARA O LOGIN</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.</Text>
              <Text style={styles.label}>E-MAIL</Text>
              <TextInput
                testID="forgot-email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onSubmitEditing={submit}
                returnKeyType="send"
                style={styles.input}
                placeholder="voce@obra.com"
                placeholderTextColor={colors.info}
              />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Pressable testID="forgot-submit" onPress={submit} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
                {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>ENVIAR LINK</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  back: { width: 44, height: 44, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginBottom: spacing.sm },
  subtitle: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.info, marginBottom: spacing.md },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.md, fontWeight: "700" },
  input: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 48 },
  primaryBtn: { marginTop: spacing.xl, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.lg, alignItems: "center", minHeight: 52 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  err: { color: colors.error, fontFamily: fonts.mono, fontSize: fontSize.sm, marginTop: spacing.md },
  okBox: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.lg, backgroundColor: colors.brandTertiary, gap: spacing.sm },
  okText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface },
  okHint: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
}));
