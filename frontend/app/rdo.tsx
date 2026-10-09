import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAudioRecorder, requestRecordingPermissionsAsync, RecordingPresets } from "expo-audio";
import { api, fileForm } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

export default function RDOScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [structured, setStructured] = useState<any>(null);
  const [manual, setManual] = useState(false);

  const startRec = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permissão", "Permita o microfone"); return; }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
  };

  const stopRec = async () => {
    try {
      await recorder.stop();
      setRecording(false);
      const u = recorder.uri;
      setUri(u || null);
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
  };

  const transcribe = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      const isWeb = uri.startsWith("blob:") || uri.startsWith("data:");
      const form = await fileForm("file", uri, isWeb ? "rdo.webm" : "rdo.m4a", isWeb ? "audio/webm" : "audio/m4a");
      const data = await api<{ transcript: string; structured: any }>("/rdo/transcribe", { method: "POST", body: form, isForm: true });
      setTranscript(data.transcript || "");
      setStructured(data.structured || null);
    } catch (e: any) {
      Alert.alert("Transcrição indisponível", `${e?.message || e}\n\nVocê pode digitar o RDO manualmente.`);
      setManual(true);
    }
    finally { setBusy(false); }
  };

  const save = async () => {
    const text = (transcript || structured?.text || "").trim();
    if (!text) return Alert.alert("RDO", "Escreva ou grave o relato do dia antes de salvar.");
    setBusy(true);
    try {
      await api("/rdo", { method: "POST", body: {
        text,
        activities: structured?.activities || [],
        voice_transcript: manual ? null : transcript,
        weather: structured?.weather,
        workers_count: structured?.workers_count,
      }});
      Alert.alert("RDO salvo", "Relatório registrado com sucesso");
      router.back();
    } catch (e: any) { Alert.alert("Erro", String(e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>RDO POR VOZ</Text>
          <Text style={styles.hTitle}>Novo Relatório</Text>
        </View>
        <Pressable testID="rdo-home" onPress={() => router.replace("/(tabs)")} style={styles.homeBtn}>
          <Ionicons name="chatbubbles" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.recBlock}>
          <Pressable testID="rdo-record" onPress={recording ? stopRec : startRec} style={[styles.recBtn, recording && { backgroundColor: colors.error }]}>
            <Ionicons name={recording ? "stop" : "mic"} size={40} color={colors.onBrand} />
          </Pressable>
          <Text style={styles.recLabel}>{recording ? "GRAVANDO..." : uri ? "GRAVAÇÃO PRONTA" : "TOQUE PARA GRAVAR"}</Text>
          <Text style={styles.recHint}>Ex.: hoje concretamos os pilares P1 a P8, com 14 trabalhadores, clima ensolarado, sem incidentes.</Text>
        </View>

        {!transcript && !manual && (
          <Pressable testID="rdo-manual" onPress={() => setManual(true)} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>DIGITAR RDO MANUALMENTE</Text>
          </Pressable>
        )}

        {uri && !transcript && !manual && (
          <Pressable testID="rdo-transcribe" onPress={transcribe} disabled={busy} style={styles.primaryBtn}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>TRANSCREVER COM IA</Text>}
          </Pressable>
        )}

        {transcript || manual ? (
          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>{manual ? "RELATO DO DIA" : "TRANSCRIÇÃO"}</Text>
            <TextInput testID="rdo-text" multiline value={transcript} onChangeText={setTranscript} style={styles.textArea} placeholder="Serviços executados, efetivo, clima, ocorrências..." placeholderTextColor={colors.info} />

            {structured && (
              <>
                <Text style={styles.resultLabel}>ESTRUTURADO (IA)</Text>
                <View style={styles.metaBlock}>
                  {!!structured.weather && <Text style={styles.metaLine}>CLIMA: {structured.weather}</Text>}
                  {!!structured.workers_count && <Text style={styles.metaLine}>TRABALHADORES: {structured.workers_count}</Text>}
                  {!!structured.summary && <Text style={styles.metaLine}>RESUMO: {structured.summary}</Text>}
                  {structured.activities?.length ? (
                    <>
                      <Text style={[styles.metaLine, { marginTop: 6 }]}>ATIVIDADES:</Text>
                      {structured.activities.map((a: string, i: number) => <Text key={i} style={styles.metaSub}>• {a}</Text>)}
                    </>
                  ) : null}
                </View>
              </>
            )}

            <Pressable testID="rdo-save" onPress={save} disabled={busy} style={styles.primaryBtn}>
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>SALVAR RDO</Text>}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  homeBtn: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["2xl"] },
  recBlock: { alignItems: "center", padding: spacing.xl, borderWidth: 2, borderColor: colors.borderStrong, gap: spacing.md, backgroundColor: colors.surfaceSecondary },
  recBtn: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.brand, borderWidth: 3, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  recLabel: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, letterSpacing: 0.5, color: colors.onSurface },
  recHint: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, textAlign: "center", lineHeight: 16 },
  primaryBtn: { backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", minHeight: 52 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  secondaryBtn: { borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", minHeight: 52, backgroundColor: colors.surface },
  secondaryBtnText: { color: colors.onSurface, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  resultBlock: { gap: spacing.md },
  resultLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  textArea: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, minHeight: 120, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, textAlignVertical: "top" },
  metaBlock: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surfaceSecondary, gap: 4 },
  metaLine: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, fontWeight: "700" },
  metaSub: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginLeft: spacing.sm },
}));
