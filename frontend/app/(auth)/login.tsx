import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, saveAuth, BASE } from "@/src/api";
import { colors, spacing, fonts, fontSize } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      if (!email.trim() || !password) {
        throw new Error("Informe e-mail e senha para entrar.");
      }
      const r = await api<{ token: string; user: any }>('/auth/login', { method: 'POST', body: { email: email.trim(), password }, auth: false });
      await saveAuth(r.token, r.user);
      router.replace('/(tabs)');
    } catch (e: any) {
      setErr(e?.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <View style={styles.logoBox}>
              <Ionicons name="hardware-chip" size={28} color={colors.onBrand} />
            </View>
            <Text style={styles.title} testID="login-title">ENGENHEIRO{"\n"}DE CAMPO IA</Text>
            <Text style={styles.subtitle}>Copiloto inteligente para canteiros de obras.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="voce@obra.com"
              placeholderTextColor={colors.info}
              style={styles.input}
            />
            <Text style={styles.label}>SENHA</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={submit}
              returnKeyType="go"
              placeholder="••••••••"
              placeholderTextColor={colors.info}
              style={styles.input}
            />
            {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}
            <Pressable testID="login-submit-button" onPress={submit} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}> 
              {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>ENTRAR</Text>} 
            </Pressable>
            <Pressable testID="login-goto-register" onPress={() => router.push('/(auth)/register')} style={styles.secondaryBtn}> 
              <Text style={styles.secondaryBtnText}>CRIAR CONTA</Text> 
            </Pressable>

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>CONTAS DE DEMONSTRAÇÃO</Text>
              <Text style={styles.demoLine}>engenheiro@demo.com • seguranca@demo.com</Text>
              <Text style={styles.demoLine}>almoxarife@demo.com • estagiario@demo.com</Text>
              <Text style={styles.demoLine}>admin@demo.com — senha: demo123</Text>
              <Text style={[styles.demoLine, { marginTop: 6 }]}>Servidor: {BASE}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  brandBlock: { marginTop: spacing.xl, marginBottom: spacing['2xl'] },
  logoBox: {
    width: 56, height: 56, backgroundColor: colors.brand,
    borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.display, fontSize: fontSize['3xl'], fontWeight: '900', color: colors.onSurface, letterSpacing: -1, lineHeight: 36 },
  subtitle: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.info, marginTop: spacing.sm },
  form: {},
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.md, fontWeight: '700' },
  input: {
    borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface,
    backgroundColor: colors.surface, minHeight: 48,
  },
  primaryBtn: {
    marginTop: spacing.xl, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong,
    paddingVertical: spacing.lg, alignItems: 'center', minHeight: 52,
  },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: '900', fontSize: fontSize.base, letterSpacing: 1 },
  secondaryBtn: {
    marginTop: spacing.md, borderWidth: 2, borderColor: colors.borderStrong,
    paddingVertical: spacing.lg, alignItems: 'center', minHeight: 52, backgroundColor: colors.surface,
  },
  secondaryBtnText: { color: colors.onSurface, fontFamily: fonts.display, fontWeight: '900', fontSize: fontSize.base, letterSpacing: 1 },
  err: { color: colors.error, fontFamily: fonts.mono, fontSize: fontSize.sm, marginTop: spacing.md },
  demoBox: { marginTop: spacing.xl, borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surfaceSecondary },
  demoTitle: { fontFamily: fonts.display, fontWeight: '900', fontSize: fontSize.sm, letterSpacing: 1, color: colors.onSurface, marginBottom: spacing.sm },
  demoLine: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurfaceSecondary, marginBottom: 2 },
});
