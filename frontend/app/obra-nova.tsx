import { useEffect, useState, type ComponentProps } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, downloadFile, pickSpreadsheet, setActiveObra } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";
import { SIZES, brToTime, formatDateBR, isValidDateBR, maskDateBR } from "@/src/obra";

type Form = {
  name: string; address: string; start_date: string; end_date: string; progress: string;
  company: string; art: string; size: string; workers_count: string;
};

const EMPTY: Form = { name: "", address: "", start_date: "", end_date: "", progress: "0", company: "", art: "", size: "", workers_count: "" };

function notify(title: string, msg: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export default function ObraForm() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<{ form: FormData; name: string } | null>(null);
  const [registered, setRegistered] = useState(0);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const o = await api<any>(`/obras/${id}`);
        setF({
          name: o.name || "", address: o.address || "", start_date: formatDateBR(o.start_date).replace("—", ""),
          end_date: formatDateBR(o.end_date).replace("—", ""), progress: String(o.progress ?? 0), company: o.company || "",
          art: o.art || "", size: o.size || "", workers_count: String(o.workers_count ?? 0),
        });
        setRegistered(o.workers_registered || 0);
      } catch (e: any) {
        notify("Erro", e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id]);

  const set = (k: keyof Form) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (f.name.trim().length < 2) e.name = "Informe o nome da obra";
    if (f.address.trim().length < 2) e.address = "Informe a localidade";
    if (!isValidDateBR(f.start_date)) e.start_date = "Data inválida (DD/MM/AAAA)";
    if (!isValidDateBR(f.end_date)) e.end_date = "Data inválida (DD/MM/AAAA)";
    else if (!e.start_date && brToTime(f.end_date) < brToTime(f.start_date)) e.end_date = "Término antes do início";
    const p = Number(f.progress.replace(",", "."));
    if (f.progress === "" || isNaN(p) || p < 0 || p > 100) e.progress = "Entre 0 e 100";
    if (f.company.trim().length < 2) e.company = "Informe a empresa responsável";
    if (!f.art.trim()) e.art = "Informe o nº da ART";
    if (!f.size) e.size = "Selecione o porte";
    const w = f.workers_count === "" ? 0 : Number(f.workers_count);
    if (isNaN(w) || w < 0 || !Number.isInteger(w)) e.workers_count = "Número inteiro";
    if (!sheet && !editing && f.workers_count === "") e.workers_count = "Informe o número ou importe a planilha";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickSheet = async () => {
    try {
      const picked = await pickSpreadsheet();
      if (picked) {
        setSheet(picked);
        setErrors((p) => ({ ...p, workers_count: undefined }));
      }
    } catch (e: any) {
      notify("Planilha", e?.message || String(e));
    }
  };

  const downloadTemplate = async () => {
    try {
      const uri = await downloadFile("/integrations/excel/workers-template", "modelo-funcionarios.xlsx");
      if (uri) notify("Modelo baixado", `Arquivo salvo em:\n${uri}`);
    } catch (e: any) {
      notify("Erro", e?.message || String(e));
    }
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        name: f.name.trim(), address: f.address.trim(), start_date: f.start_date, end_date: f.end_date,
        progress: Number(f.progress.replace(",", ".")), company: f.company.trim(), art: f.art.trim(), size: f.size,
        workers_count: f.workers_count === "" ? 0 : Number(f.workers_count),
      };
      const obra = editing
        ? await api<any>(`/obras/${id}`, { method: "PUT", body })
        : await api<any>("/obras", { method: "POST", body });

      let extra = "";
      if (sheet) {
        try {
          const r = await api<{ imported: number; total: number; errors: string[] }>(
            `/obras/${obra.id}/workers/import`, { method: "POST", body: sheet.form, isForm: true },
          );
          extra = `\n\n${r.imported} funcionário(s) importado(s) da planilha (total: ${r.total}).`;
          if (r.errors.length) extra += `\nAvisos:\n${r.errors.slice(0, 5).join("\n")}`;
        } catch (e: any) {
          extra = `\n\nA obra foi salva, mas a planilha não foi importada: ${e?.message || e}`;
        }
      }
      await setActiveObra(obra);
      notify(editing ? "Obra atualizada" : "Obra cadastrada", `${obra.name}${extra}`);
      router.replace("/(tabs)/obra");
    } catch (e: any) {
      notify("Não foi possível salvar", e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /></SafeAreaView>;
  }

  const Field = ({ k, label, ...props }: { k: keyof Form; label: string } & ComponentProps<typeof TextInput>) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={`obra-${k}`}
        value={f[k]}
        onChangeText={set(k)}
        placeholderTextColor={colors.info}
        style={[styles.input, errors[k] && styles.inputError]}
        {...props}
      />
      {errors[k] ? <Text style={styles.err}>{errors[k]}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>{editing ? "EDITAR OBRA" : "NOVA OBRA"}</Text>
          <Text style={styles.hTitle}>{editing ? f.name || "Obra" : "Cadastro de obra"}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {Field({ k: "name", label: "NOME DA OBRA", placeholder: "Ex.: Residencial Vila Nova" })}
          {Field({ k: "address", label: "LOCALIDADE", placeholder: "Rua, número - Cidade/UF" })}

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              {Field({ k: "start_date", label: "INÍCIO", placeholder: "DD/MM/AAAA", keyboardType: "number-pad", maxLength: 10,
                onChangeText: (t: string) => set("start_date")(maskDateBR(t)) })}
            </View>
            <View style={{ flex: 1 }}>
              {Field({ k: "end_date", label: "TÉRMINO PREVISTO", placeholder: "DD/MM/AAAA", keyboardType: "number-pad", maxLength: 10,
                onChangeText: (t: string) => set("end_date")(maskDateBR(t)) })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>ESTÁGIO ATUAL (%)</Text>
            <View style={styles.progressRow}>
              <TextInput
                testID="obra-progress"
                value={f.progress}
                onChangeText={(t) => set("progress")(t.replace(/[^\d.,]/g, "").slice(0, 5))}
                keyboardType="decimal-pad"
                style={[styles.input, styles.progressInput, errors.progress && styles.inputError]}
              />
              {[0, 25, 50, 75, 100].map((v) => (
                <Pressable key={v} onPress={() => set("progress")(String(v))} style={[styles.chip, Number(f.progress) === v && styles.chipActive]}>
                  <Text style={[styles.chipText, Number(f.progress) === v && styles.chipTextActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>
            {errors.progress ? <Text style={styles.err}>{errors.progress}</Text> : null}
          </View>

          {Field({ k: "company", label: "EMPRESA RESPONSÁVEL", placeholder: "Razão social da construtora" })}
          {Field({ k: "art", label: "ART (ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA)", placeholder: "Nº da ART", autoCapitalize: "characters" })}

          <View style={styles.field}>
            <Text style={styles.label}>PORTE DA OBRA</Text>
            <View style={styles.chips}>
              {SIZES.map((s) => (
                <Pressable key={s.id} testID={`obra-size-${s.id}`} onPress={() => set("size")(s.id)} style={[styles.sizeChip, f.size === s.id && styles.chipActive]}>
                  <Text style={[styles.chipText, f.size === s.id && styles.chipTextActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            {errors.size ? <Text style={styles.err}>{errors.size}</Text> : null}
          </View>

          <View style={styles.workersBox}>
            <Text style={styles.label}>NÚMERO DE FUNCIONÁRIOS</Text>
            <TextInput
              testID="obra-workers_count"
              value={f.workers_count}
              onChangeText={(t) => set("workers_count")(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              placeholder={sheet ? "Será calculado pela planilha" : "Ex.: 25"}
              placeholderTextColor={colors.info}
              editable={!sheet}
              style={[styles.input, errors.workers_count && styles.inputError, !!sheet && { backgroundColor: colors.surfaceTertiary }]}
            />
            {errors.workers_count ? <Text style={styles.err}>{errors.workers_count}</Text> : null}
            {editing && registered > 0 ? <Text style={styles.hint}>{registered} funcionário(s) já cadastrados por planilha.</Text> : null}

            <Text style={styles.or}>OU IMPORTE A LISTA DE FUNCIONÁRIOS</Text>
            <Pressable testID="obra-sheet" onPress={pickSheet} style={[styles.btn, sheet && styles.btnDone]}>
              <Ionicons name={sheet ? "checkmark-circle" : "document-attach"} size={18} color={colors.onSurface} />
              <Text style={styles.btnText} numberOfLines={1}>{sheet ? sheet.name : "SELECIONAR PLANILHA EXCEL"}</Text>
            </Pressable>
            {sheet ? (
              <Pressable onPress={() => setSheet(null)}><Text style={styles.link}>Remover planilha</Text></Pressable>
            ) : null}
            <Pressable onPress={downloadTemplate}><Text style={styles.link}>Baixar modelo da planilha (Nome, Função, Empresa, Setor, Admissão)</Text></Pressable>
          </View>

          <Pressable testID="obra-save" onPress={save} disabled={saving} style={({ pressed }) => [styles.primaryBtn, (pressed || saving) && { opacity: 0.8 }]}>
            {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>{editing ? "SALVAR ALTERAÇÕES" : "CADASTRAR OBRA"}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] },
  field: { gap: spacing.xs },
  row2: { flexDirection: "row", gap: spacing.sm },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, fontWeight: "700" },
  input: {
    borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 48,
  },
  inputError: { borderColor: colors.error },
  err: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.error },
  hint: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  progressInput: { width: 80, textAlign: "center" },
  chips: { flexDirection: "row", gap: spacing.sm },
  chip: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, minWidth: 44, alignItems: "center" },
  sizeChip: { flex: 1, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center" },
  chipActive: { backgroundColor: colors.brand },
  chipText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onSurface },
  chipTextActive: { color: colors.onBrand },
  workersBox: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceSecondary },
  or: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xs },
  btn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.borderStrong, minHeight: 48, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  btnDone: { borderColor: colors.success },
  btnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface, flexShrink: 1 },
  link: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.brandSecondary, textDecorationLine: "underline" },
  primaryBtn: { backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.lg, alignItems: "center", minHeight: 56, marginTop: spacing.sm },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
}));
