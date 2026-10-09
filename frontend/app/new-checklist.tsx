import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, getStoredUser } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

const OPTIONS = ["alvenaria", "concretagem", "impermeabilizacao", "revestimento_ceramico", "eletrica", "hidraulica", "estrutura"];

export default function NewChecklist() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async (svc: string) => {
    setBusy(true);
    try {
      const user = await getStoredUser<any>();
      const r = await api<any>("/checklists/generate", { method: "POST", body: { obra_id: user.obra_id, service_type: svc } });
      router.replace(`/checklist/${r.id}` as any);
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View><Text style={styles.hLabel}>NOVA INSPEÇÃO</Text><Text style={styles.hTitle}>Checklist Inteligente</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>SERVIÇOS PREDEFINIDOS</Text>
        {OPTIONS.map((o) => (
          <Pressable key={o} testID={`svc-${o}`} disabled={busy} onPress={() => generate(o)} style={styles.optionBtn}>
            <Text style={styles.optionText}>{o.replace(/_/g, " ").toUpperCase()}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onSurface} />
          </Pressable>
        ))}

        <Text style={[styles.section, { marginTop: spacing.xl }]}>OU GERE COM IA</Text>
        <TextInput value={custom} onChangeText={setCustom} style={styles.input} placeholder="Descreva o serviço..." placeholderTextColor={colors.info} />
        <Pressable testID="ai-generate" disabled={busy || !custom.trim()} onPress={() => generate(custom.trim())} style={[styles.primaryBtn, (!custom.trim() || busy) && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>GERAR CHECKLIST COM IA</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing["2xl"] },
  section: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700", marginBottom: spacing.xs },
  optionBtn: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, minHeight: 52 },
  optionText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: -0.2 },
  input: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 48 },
  primaryBtn: { marginTop: spacing.md, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", minHeight: 52 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
}));
