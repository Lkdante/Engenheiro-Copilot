import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, getStoredUser } from "@/src/api";
import SignatureCanvas from "@/src/components/SignatureCanvas";
import { colors, spacing, fonts, fontSize } from "@/src/theme";

export default function EPIsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signatureVisible, setSignatureVisible] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [f, setF] = useState({ worker_name: "", worker_company: "", worker_role: "", epi_type: "" });

  const load = async () => { try { const r = await api<{ items: any[] }>("/epis"); setItems(r.items || []); } catch {} setLoading(false); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!f.worker_name || !f.epi_type) return Alert.alert("Preencha nome e EPI");
    if (!signatureData) return Alert.alert("Assinatura", "Colete a assinatura do trabalhador antes de salvar");
    setSaving(true);
    try {
      const user = await getStoredUser<any>();
      const today = new Date().toISOString().slice(0, 10);
      await api("/epis", { method: "POST", body: { obra_id: user.obra_id, ...f, delivery_date: today, expiry_days: 180, signature_base64: signatureData } });
      setF({ worker_name: "", worker_company: "", worker_role: "", epi_type: "" });
      setSignatureData(null);
      setShowForm(false); load();
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.hLabel}>CONTROLE DE EPIs</Text><Text style={styles.hTitle}>{items.length} entregas</Text></View>
        <Pressable testID="epi-toggle" onPress={() => setShowForm(!showForm)} style={styles.addBtn}><Ionicons name={showForm ? "close" : "add"} size={20} color={colors.onBrand} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {showForm && (
          <View style={styles.formBlock}>
            <Text style={styles.label}>NOME</Text>
            <TextInput testID="epi-name" value={f.worker_name} onChangeText={(v) => setF({ ...f, worker_name: v })} style={styles.input} />
            <Text style={styles.label}>EMPRESA</Text>
            <TextInput value={f.worker_company} onChangeText={(v) => setF({ ...f, worker_company: v })} style={styles.input} />
            <Text style={styles.label}>FUNÇÃO</Text>
            <TextInput value={f.worker_role} onChangeText={(v) => setF({ ...f, worker_role: v })} style={styles.input} />
            <Text style={styles.label}>TIPO DE EPI</Text>
            <TextInput testID="epi-type" value={f.epi_type} onChangeText={(v) => setF({ ...f, epi_type: v })} placeholder="Ex: Capacete, Botina..." placeholderTextColor={colors.info} style={styles.input} />

            <Text style={styles.label}>ASSINATURA DIGITAL</Text>
            {signatureData ? (
              <View style={styles.sigPreviewBlock}>
                <Image source={{ uri: signatureData }} style={styles.sigPreviewImg} resizeMode="contain" />
                <View style={styles.sigActions}>
                  <Pressable testID="epi-signature-redo" onPress={() => { setSignatureData(null); setSignatureVisible(true); }} style={styles.sigBtn}>
                    <Ionicons name="refresh" size={14} color={colors.onSurface} />
                    <Text style={styles.sigBtnText}>REFAZER</Text>
                  </Pressable>
                  <View style={styles.sigOkBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.onBrand} />
                    <Text style={styles.sigOkText}>COLETADA</Text>
                  </View>
                </View>
              </View>
            ) : (
              <Pressable testID="epi-signature-open" onPress={() => setSignatureVisible(true)} style={styles.sigOpenBtn}>
                <Ionicons name="create" size={18} color={colors.onSurface} />
                <Text style={styles.sigOpenText}>COLETAR ASSINATURA</Text>
              </Pressable>
            )}

            <Pressable testID="epi-save" onPress={save} style={styles.primaryBtn}>{saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>REGISTRAR ENTREGA</Text>}</Pressable>
          </View>
        )}

        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : items.map((e) => (
          <View key={e.id} style={[styles.card, e.alert && styles.cardAlert]}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>{e.worker_name}</Text>
              {e.alert && <View style={styles.alertBadge}><Text style={styles.alertText}>ALERTA</Text></View>}
            </View>
            <Text style={styles.meta}>{e.worker_company} • {e.worker_role}</Text>
            <Text style={styles.epi}>EPI: {e.epi_type}</Text>
            <Text style={styles.meta}>Entrega: {e.delivery_date} • Vence: {e.expiry_date}</Text>
            {e.days_to_expiry !== null && <Text style={[styles.days, e.alert && { color: colors.error }]}>{e.days_to_expiry < 0 ? `VENCIDO HÁ ${-e.days_to_expiry} DIAS` : `${e.days_to_expiry} DIAS`}</Text>}
            {e.signature_base64 ? (
              <View style={styles.sigRow}>
                <Text style={styles.sigLabel}>ASSINATURA</Text>
                <Image source={{ uri: e.signature_base64 }} style={styles.sigThumb} resizeMode="contain" />
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <SignatureCanvas
        visible={signatureVisible}
        onClose={() => setSignatureVisible(false)}
        onSave={({ dataUrl, hasContent }) => {
          if (hasContent) setSignatureData(dataUrl);
          setSignatureVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  primaryBtn: { marginTop: spacing.md, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", minHeight: 52 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  card: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surface, gap: 4 },
  cardAlert: { backgroundColor: "#FFF4EF", borderColor: colors.error },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface },
  meta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info },
  epi: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, fontWeight: "700" },
  days: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", letterSpacing: 0.5, marginTop: 4 },
  alertBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: colors.error, borderWidth: 2, borderColor: colors.borderStrong },
  alertText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onBrand, fontWeight: "700", letterSpacing: 0.5 },
  sigOpenBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingVertical: spacing.md, marginTop: spacing.xs, minHeight: 48 },
  sigOpenText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 0.5, color: colors.onSurface },
  sigPreviewBlock: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, padding: spacing.sm, marginTop: spacing.xs, gap: spacing.sm },
  sigPreviewImg: { width: "100%", height: 80, backgroundColor: colors.surface },
  sigActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sigBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  sigBtnText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onSurface, letterSpacing: 0.5 },
  sigOkBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  sigOkText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onBrand, letterSpacing: 0.5 },
  sigRow: { marginTop: spacing.sm, borderTopWidth: 2, borderTopColor: colors.borderStrong, paddingTop: spacing.sm },
  sigLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  sigThumb: { width: "100%", height: 60, backgroundColor: colors.surface },
});
