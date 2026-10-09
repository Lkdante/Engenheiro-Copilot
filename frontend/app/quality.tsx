import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, getStoredUser } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

export default function QualityScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ type: "FVS", service: "", location: "", result: "aprovado", notes: "" });

  const load = async () => { try { const r = await api<{ items: any[] }>("/quality"); setItems(r.items || []); } catch {} setLoading(false); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!f.service || !f.location) return Alert.alert("Preencha serviço e local");
    setSaving(true);
    try {
      const user = await getStoredUser<any>();
      await api("/quality", { method: "POST", body: { obra_id: user.obra_id, ...f } });
      setF({ type: "FVS", service: "", location: "", result: "aprovado", notes: "" });
      setShowForm(false); load();
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.hLabel}>QUALIDADE</Text><Text style={styles.hTitle}>FVS / FVM</Text></View>
        <Pressable testID="quality-toggle" onPress={() => setShowForm(!showForm)} style={styles.addBtn}><Ionicons name={showForm ? "close" : "add"} size={20} color={colors.onBrand} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {showForm && (
          <View style={styles.formBlock}>
            <Text style={styles.label}>TIPO</Text>
            <View style={styles.row}>
              {["FVS", "FVM"].map((t) => (
                <Pressable key={t} onPress={() => setF({ ...f, type: t })} style={[styles.chip, f.type === t && styles.chipActive]}>
                  <Text style={[styles.chipText, f.type === t && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>SERVIÇO</Text>
            <TextInput value={f.service} onChangeText={(v) => setF({ ...f, service: v })} style={styles.input} />
            <Text style={styles.label}>LOCAL</Text>
            <TextInput value={f.location} onChangeText={(v) => setF({ ...f, location: v })} style={styles.input} />
            <Text style={styles.label}>RESULTADO</Text>
            <View style={styles.row}>
              {["aprovado", "reprovado", "pendente"].map((r) => (
                <Pressable key={r} onPress={() => setF({ ...f, result: r })} style={[styles.chip, f.result === r && styles.chipActive]}>
                  <Text style={[styles.chipText, f.result === r && styles.chipTextActive]}>{r.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>OBSERVAÇÕES</Text>
            <TextInput value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} style={[styles.input, { minHeight: 80 }]} multiline />
            <Pressable testID="quality-save" onPress={save} style={styles.primaryBtn}>{saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>SALVAR</Text>}</Pressable>
          </View>
        )}

        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : items.map((q) => (
          <View key={q.id} style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>{q.type} • {q.service}</Text>
              <View style={[styles.badge, q.result === "aprovado" ? { backgroundColor: colors.success } : q.result === "reprovado" ? { backgroundColor: colors.error } : { backgroundColor: colors.warning }]}>
                <Text style={styles.badgeText}>{q.result.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{q.location} • {new Date(q.created_at).toLocaleDateString("pt-BR")}</Text>
            {!!q.notes && <Text style={styles.notes}>{q.notes}</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 40, height: 40, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["2xl"] },
  formBlock: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, padding: spacing.md, gap: 4 },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, fontWeight: "700", marginTop: spacing.sm },
  input: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, minHeight: 44 },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand },
  chipText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  chipTextActive: { color: colors.onBrand },
  primaryBtn: { marginTop: spacing.md, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", minHeight: 52 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  card: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surface, gap: 4 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, flex: 1 },
  meta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info },
  notes: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 4 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 2, borderColor: colors.borderStrong },
  badgeText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onBrand, fontWeight: "700", letterSpacing: 0.5 },
}));
