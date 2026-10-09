import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, downloadFile } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

type Status = {
  excel: { available: boolean };
  whatsapp: { api_configured: boolean; default_to: string | null };
  ai: { llm: { configured: boolean; model: string }; speech_to_text: { configured: boolean } };
};

const PLANNED = [
  { icon: "server", name: "ERP CONSTRUÇÃO", desc: "Sienge, Mega, TOTVS" },
  { icon: "cube", name: "SISTEMAS BIM", desc: "Revit, IFC, Navisworks" },
  { icon: "logo-google", name: "GOOGLE DRIVE", desc: "Backup de fotos e RDOs" },
  { icon: "briefcase", name: "MICROSOFT 365", desc: "SharePoint + Teams" },
];

function notify(title: string, msg: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export default function Integrations() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await api<Status>("/integrations/status");
      setStatus(s);
      if (s.whatsapp.default_to) setPhone((p) => p || s.whatsapp.default_to || "");
    } catch (e: any) {
      notify("Integrações", e?.message || String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { notify("Erro", e?.message || String(e)); } finally { setBusy(null); }
  };

  const exportExcel = () => run("export", async () => {
    const uri = await downloadFile("/integrations/excel/export", `obra-${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (uri) notify("Planilha gerada", `Arquivo salvo em:\n${uri}`);
  });

  const downloadTemplate = () => run("template", async () => {
    const uri = await downloadFile("/integrations/excel/epi-template", "modelo-epis.xlsx");
    if (uri) notify("Modelo baixado", `Arquivo salvo em:\n${uri}`);
  });

  // Seleção de arquivo: no navegador usa <input type="file"> (sem dependências extras).
  const pickXlsx = () => new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });

  const importEpis = () => run("import", async () => {
    if (Platform.OS !== "web") {
      return notify("Importar planilha", "A importação de planilhas está disponível na versão web (navegador) nesta versão do MVP.");
    }
    const file = await pickXlsx();
    if (!file) return;
    const form = new FormData();
    form.append("file", file, file.name);
    const r = await api<{ imported: number; errors: string[] }>("/integrations/excel/import-epis", { method: "POST", body: form, isForm: true });
    notify("Importação concluída", `${r.imported} entrega(s) de EPI importada(s).` + (r.errors.length ? `\n\nAvisos:\n${r.errors.join("\n")}` : ""));
  });

  const handleWa = async (r: any) => {
    if (r.sent) return notify("WhatsApp", "Mensagem enviada pela API do WhatsApp.");
    if (r.link) {
      if (r.mode === "error") notify("WhatsApp", `${r.detail}\n\nAbrindo envio manual.`);
      await Linking.openURL(r.link);
    } else notify("WhatsApp", r.detail || "Não foi possível enviar.");
  };

  const sendAlerts = () => run("alerts", async () => {
    handleWa(await api("/integrations/whatsapp/alerts", { method: "POST", body: { to: phone || null } }));
  });

  const sendMessage = () => {
    if (!message.trim()) return notify("WhatsApp", "Escreva a mensagem.");
    run("wa", async () => { handleWa(await api("/integrations/whatsapp/send", { method: "POST", body: { to: phone || null, message } })); });
  };

  const Badge = ({ ok, on, off }: { ok: boolean; on: string; off: string }) => (
    <View style={[styles.badge, { backgroundColor: ok ? colors.success : colors.warning }]}>
      <Text style={[styles.badgeText, ok && { color: colors.onBrand }]}>{ok ? on : off}</Text>
    </View>
  );

  const Btn = ({ k, icon, label, onPress, primary }: { k: string; icon: any; label: string; onPress: () => void; primary?: boolean }) => (
    <Pressable testID={`int-${k}`} onPress={onPress} disabled={!!busy} style={({ pressed }) => [styles.btn, primary && styles.btnPrimary, (pressed || busy === k) && { opacity: 0.7 }]}>
      {busy === k ? <ActivityIndicator color={primary ? colors.onBrand : colors.onSurface} /> : (
        <>
          <Ionicons name={icon} size={18} color={primary ? colors.onBrand : colors.onSurface} />
          <Text style={[styles.btnText, primary && { color: colors.onBrand }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View><Text style={styles.hLabel}>INTEGRAÇÕES</Text><Text style={styles.hTitle}>Excel • WhatsApp • IA</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!status ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} /> : (
          <>
            {/* EXCEL */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.iconBox}><Ionicons name="document" size={22} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>PLANILHAS EXCEL</Text>
                  <Text style={styles.desc}>Exportar todos os registros da obra e importar entregas de EPI</Text>
                </View>
                <Badge ok on="ATIVO" off="—" />
              </View>
              <Btn k="export" icon="download" label="EXPORTAR OBRA (.XLSX)" onPress={exportExcel} primary />
              <Btn k="import" icon="cloud-upload" label="IMPORTAR EPIs DE PLANILHA" onPress={importEpis} />
              <Btn k="template" icon="grid" label="BAIXAR MODELO DE EPIs" onPress={downloadTemplate} />
            </View>

            {/* WHATSAPP */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.iconBox}><Ionicons name="logo-whatsapp" size={22} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>WHATSAPP</Text>
                  <Text style={styles.desc}>{status.whatsapp.api_configured ? "Envio automático via WhatsApp Cloud API" : "Sem API configurada: abre o WhatsApp com a mensagem pronta"}</Text>
                </View>
                <Badge ok={status.whatsapp.api_configured} on="API" off="MANUAL" />
              </View>
              <Text style={styles.label}>NÚMERO (COM DDD)</Text>
              <TextInput testID="wa-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="11 99999-8888" placeholderTextColor={colors.info} style={styles.input} />
              <Btn k="alerts" icon="warning" label="ENVIAR ALERTAS DA OBRA" onPress={sendAlerts} primary />
              <Text style={styles.label}>MENSAGEM LIVRE</Text>
              <TextInput testID="wa-message" value={message} onChangeText={setMessage} multiline placeholder="Ex.: Concretagem da laje amanhã às 7h." placeholderTextColor={colors.info} style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} />
              <Btn k="wa" icon="send" label="ENVIAR MENSAGEM" onPress={sendMessage} />
            </View>

            {/* IA */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.iconBox}><Ionicons name="sparkles" size={22} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>INTELIGÊNCIA ARTIFICIAL</Text>
                  <Text style={styles.desc}>Chatbot, visão de fotos/inspeções ({status.ai.llm.model})</Text>
                </View>
                <Badge ok={status.ai.llm.configured} on="ATIVA" off="LOCAL" />
              </View>
              <Text style={styles.desc}>
                {status.ai.llm.configured ? "Claude configurado no backend." : "Sem ANTHROPIC_API_KEY: o chatbot responde com os dados da obra e as fotos ficam pendentes de validação humana."}
                {"\n"}Transcrição de voz (Whisper): {status.ai.speech_to_text.configured ? "ativa" : "não configurada (OPENAI_API_KEY)"}.
              </Text>
            </View>

            <Text style={styles.section}>PRÓXIMAS INTEGRAÇÕES</Text>
            {PLANNED.map((i) => (
              <View key={i.name} style={[styles.card, styles.cardHead]}>
                <View style={styles.iconBox}><Ionicons name={i.icon as any} size={22} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}><Text style={styles.name}>{i.name}</Text><Text style={styles.desc}>{i.desc}</Text></View>
                <Badge ok={false} on="" off="PLANEJADO" />
              </View>
            ))}
          </>
        )}
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
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["2xl"] },
  card: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBox: { width: 44, height: 44, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  name: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: -0.2 },
  desc: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, marginTop: 2, lineHeight: 16 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 2, borderColor: colors.borderStrong },
  badgeText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, fontWeight: "700", marginTop: spacing.xs },
  input: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, minHeight: 44 },
  btn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.borderStrong, minHeight: 48, backgroundColor: colors.surface },
  btnPrimary: { backgroundColor: colors.brand },
  btnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 0.5, color: colors.onSurface },
  section: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700", marginTop: spacing.md },
}));
