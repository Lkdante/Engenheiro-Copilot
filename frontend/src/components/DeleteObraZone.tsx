// "Zona de perigo" do administrador: exclusão DEFINITIVA da obra e de todos os seus dados.
// Exige digitar o nome exato da obra (o servidor confere de novo).
import { useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator, Platform, Alert, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, clearActiveObra } from "@/src/api";
import { spacing, fonts } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

const WHAT = [
  "RDOs, não conformidades e checklists",
  "EPIs, qualidade (FVS/FVM), fotos e inspeções",
  "Funcionários e arquivos/planilhas enviados no cadastro",
  "A obra deixa de aparecer no menu público",
];

export default function DeleteObraZone({ obraId, obraName, onDeleted }: { obraId: string; obraName: string; onDeleted: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const matches = typed.trim() === obraName.trim();

  const close = () => { if (!busy) { setOpen(false); setTyped(""); setErr(""); } };

  const remove = async () => {
    if (!matches) return;
    setBusy(true);
    setErr("");
    try {
      await api<{ apagados: Record<string, number> }>(`/obras/${obraId}?confirm=${encodeURIComponent(obraName)}`, { method: "DELETE" });
      await clearActiveObra();
      // a notificação "Obra excluída" (com o total de registros) aparece sozinha — src/notify.ts
      setOpen(false);
      onDeleted();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.zone}>
        <View style={styles.head}>
          <Ionicons name="warning" size={18} color={colors.error} />
          <Text style={styles.title}>ZONA DO ADMINISTRADOR</Text>
        </View>
        <Text style={styles.text}>Excluir a obra apaga do banco de dados todos os registros dela. Não dá para desfazer.</Text>
        <Pressable testID="obra-excluir" onPress={() => setOpen(true)} style={styles.dangerBtn} accessibilityLabel="Excluir obra">
          <Ionicons name="trash" size={18} color={colors.error} />
          <Text style={styles.dangerText}>EXCLUIR OBRA</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.head}>
              <Ionicons name="trash" size={20} color={colors.error} />
              <Text style={styles.sheetTitle}>Excluir obra definitivamente</Text>
            </View>
            <Text style={styles.text}>Serão apagados de <Text style={styles.bold}>{obraName}</Text>:</Text>
            {WHAT.map((w) => (
              <View key={w} style={styles.item}>
                <Ionicons name="close-circle" size={14} color={colors.error} />
                <Text style={styles.text}>{w}</Text>
              </View>
            ))}
            <Text style={[styles.text, { marginTop: spacing.sm }]}>Para confirmar, digite o nome da obra:</Text>
            <TextInput
              testID="obra-excluir-nome"
              value={typed}
              onChangeText={setTyped}
              placeholder={obraName}
              placeholderTextColor={colors.info}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, matches && { borderColor: colors.error }]}
            />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={close} style={[styles.btn, { flex: 1 }]} disabled={busy}>
                <Text style={styles.btnText}>CANCELAR</Text>
              </Pressable>
              <Pressable
                testID="obra-excluir-confirmar"
                onPress={remove}
                disabled={!matches || busy}
                style={[styles.btn, styles.btnDanger, { flex: 1 }, (!matches || busy) && { opacity: 0.4 }]}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.btnText, { color: "#FFFFFF" }]}>EXCLUIR</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  zone: { borderWidth: 2, borderColor: colors.error, borderStyle: "dashed", padding: spacing.md, gap: spacing.sm, marginTop: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 1.5, color: colors.error },
  text: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, lineHeight: Math.round(fontSize.xs * 1.5), flexShrink: 1 },
  bold: { fontWeight: "900" },
  dangerBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 48, borderWidth: 2, borderColor: colors.error },
  dangerText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.error, letterSpacing: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.error, padding: spacing.lg, gap: spacing.xs },
  sheetTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, color: colors.onSurface },
  item: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  input: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surfaceSecondary },
  err: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.error },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btn: { minHeight: 48, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  btnDanger: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  btnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface, letterSpacing: 1 },
}));
