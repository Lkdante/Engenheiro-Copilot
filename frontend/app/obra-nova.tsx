// Assistente de NOVA OBRA:
//   1. Tipo: Patologia (fotos do local)  ou  Obra geral (planilhas e arquivos por área)
//   2. Coleta: fotos / anexos — cada arquivo é lido pelo servidor na hora
//   3. Análise: indicadores por área ou manifestações patológicas + parecer
//   4. Revisão dos dados sugeridos → cadastro no menu de obras (tela obra-editar?modo=confirmar)
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, downloadFile, fileForm, getStoredUser, pickAnyFile, uploadObraFile } from "@/src/api";
import { spacing, fonts, severityColor } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";
import { notifyAuto, notifyInfo } from "@/src/notify";
import { confirmDialog, type ConfirmOptions } from "@/src/components/ConfirmHost";

type Kind = "geral" | "patologia";
type Step = "tipo" | "coleta" | "resultado";
type ObraFile = { id: string; category: string; filename: string; kind: string; size: number; extracted: any; preview?: string };

const AREAS: { id: string; label: string; hint: string; icon: any; template: boolean }[] = [
  { id: "pessoas", label: "Pessoas e acesso", hint: "Funcionários, terceiros, controle de acesso", icon: "people", template: true },
  { id: "seguranca", label: "Segurança, EPIs e EPCs", hint: "Entregas de EPI, CA, validade, EPCs", icon: "shield-checkmark", template: true },
  { id: "almoxarifado", label: "Almoxarifado", hint: "Materiais, estoque e estoque mínimo", icon: "cube", template: true },
  { id: "planejamento", label: "Planejamento e produção", hint: "Cronograma, etapas, % executado", icon: "calendar", template: true },
  { id: "qualidade", label: "Qualidade", hint: "FVS, FVM, inspeções e resultados", icon: "ribbon", template: true },
  { id: "documentacao", label: "Documentação", hint: "Ficha da obra, ART, alvará, PGR, PCMSO", icon: "document-text", template: true },
  { id: "custos", label: "Custos e contratos", hint: "Orçamento, medições, previsto x realizado", icon: "cash", template: true },
  { id: "projeto", label: "Projeto (AutoCAD / PDF)", hint: "DXF, DWG, plantas e memoriais em PDF", icon: "construct", template: false },
];

const ESTADO_LABEL: Record<string, string> = { bom: "BOM", regular: "REGULAR", ruim: "RUIM", critico: "CRÍTICO", pendente: "PENDENTE" };
const ESTADO_COLOR: Record<string, string> = { bom: "#16A34A", regular: "#F59E0B", ruim: "#EA580C", critico: "#DC2626", pendente: "#64748B" };

function notify(title: string, msg: string) {
  notifyAuto(title, msg); // notificação com borda laranja (src/components/Toaster.tsx)
}

async function confirmAsk(opts: ConfirmOptions, onOk: () => void | Promise<void>) {
  if (await confirmDialog(opts)) await onOk();
}

/** Resumo curto do que o servidor leu de um arquivo. */
function describe(f: ObraFile): { text: string; warn?: string } {
  const ex = f.extracted || {};
  const warn = (ex.warnings || [])[0];
  if (ex.type === "foto") {
    if (ex.status !== "analisado") return { text: "Registrada • análise pendente (validação humana)", warn: undefined };
    const n = (ex.manifestacoes || []).length;
    return { text: n ? `${n} manifestação(ões) • estado ${ESTADO_LABEL[ex.estado_geral] || ex.estado_geral || "—"}` : "Nenhuma manifestação aparente" };
  }
  if (ex.type === "planilha") {
    const sheets = ex.sheets || [];
    const rows = sheets.reduce((a: number, s: any) => a + (s.rows || 0), 0);
    const fields = Object.keys(ex.fields || {}).length;
    return { text: `${sheets.length} aba(s) • ${rows} linha(s)${fields ? ` • ${fields} dado(s) da obra` : ""}`, warn };
  }
  if (ex.type === "pdf") return { text: `PDF • ${ex.metrics?.paginas ?? "?"} página(s)${ex.metrics?.area_m2 ? ` • área ${ex.metrics.area_m2} m²` : ""}`, warn };
  if (ex.type === "dxf") return { text: `DXF • ${ex.metrics?.entidades ?? 0} entidades • ${ex.metrics?.camadas ?? 0} camadas`, warn };
  return { text: `${(ex.type || "arquivo").toUpperCase()} armazenado`, warn };
}

export default function NovaObra() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [step, setStep] = useState<Step>("tipo");
  const [kind, setKind] = useState<Kind | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [files, setFiles] = useState<ObraFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getStoredUser<any>();
      setAllowed(!!u && ["admin", "engenheiro", "diretor"].includes(u.role));
    })();
  }, []);

  // ------------------------------------------------------------- passo 1
  const chooseKind = async (k: Kind) => {
    setBusy("tipo");
    try {
      const d = await api<any>("/obras/rascunho", { method: "POST", body: { kind: k } });
      setDraftId(d.id);
      setKind(k);
      setFiles([]);
      setResult(null);
      setStep("coleta");
    } catch (e: any) {
      notify("Não foi possível iniciar", e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const discardDraft = useCallback(async (silent = false) => {
    if (draftId) {
      try { await api(`/obras/${draftId}`, { method: "DELETE", notify: !silent }); } catch {}
    }
    setDraftId(null);
    setKind(null);
    setFiles([]);
    setResult(null);
  }, [draftId]);

  const cancel = () => {
    if (!draftId) return router.back();
    confirmAsk({
      title: "Cancelar análise?",
      message: "A obra não será cadastrada e as fotos e arquivos enviados serão descartados.",
      confirmText: "Sim, cancelar",
      cancelText: "Continuar análise",
      destructive: true,
      icon: "close-circle",
    }, async () => {
      await discardDraft();
      router.back();
    });
  };

  const switchKind = () =>
    confirmAsk({
      title: "Trocar o tipo de análise?",
      message: kind === "patologia"
        ? "Você volta para a escolha do tipo e as fotos enviadas serão descartadas."
        : "Você volta para a escolha do tipo e os arquivos enviados serão descartados.",
      confirmText: "Trocar tipo",
      cancelText: "Manter",
      icon: "swap-horizontal",
    }, async () => {
      await discardDraft(true);
      setStep("tipo");
      notifyInfo("Tipo de análise liberado", "Escolha como o app vai analisar a obra.");
    });

  // ------------------------------------------------------------- passo 2: fotos
  const addPhotos = async (camera: boolean) => {
    if (!draftId) return;
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return notify("Permissão negada", camera ? "Libere o acesso à câmera." : "Libere o acesso às fotos.");
      const res = camera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ["images"] })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 10 });
      if (res.canceled || !res.assets?.length) return;
      setBusy("foto");
      for (const [i, a] of res.assets.entries()) {
        const name = a.fileName || `foto-${Date.now()}-${i}.jpg`;
        const form = await fileForm("file", a.uri, name, a.mimeType || "image/jpeg");
        const rec = await uploadObraFile<ObraFile>(draftId, "foto", form);
        setFiles((p) => [...p, { ...rec, preview: a.uri }]);
      }
    } catch (e: any) {
      notify("Erro ao enviar foto", e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  // ------------------------------------------------------------- passo 2: arquivos
  const addFile = async (area: string) => {
    if (!draftId) return;
    try {
      const picked = await pickAnyFile();
      if (!picked) return;
      setBusy(area);
      const rec = await uploadObraFile<ObraFile>(draftId, area, picked.form);
      setFiles((p) => [...p, rec]);
    } catch (e: any) {
      notify("Erro ao enviar arquivo", e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const removeFile = async (f: ObraFile) => {
    if (!draftId) return;
    try {
      await api(`/obras/${draftId}/arquivos/${f.id}`, { method: "DELETE" });
      setFiles((p) => p.filter((x) => x.id !== f.id));
    } catch (e: any) {
      notify("Erro", e?.message || String(e));
    }
  };

  // Validação humana de uma manifestação (alimenta o dataset do YOLO)
  const validate = async (f: ObraFile, index: number, status: "confirmada" | "rejeitada") => {
    if (!draftId) return;
    try {
      const rec = await api<ObraFile>(`/obras/${draftId}/arquivos/${f.id}/validacao`, { method: "PUT", body: { itens: [{ index, status }] } });
      setFiles((p) => p.map((x) => (x.id === f.id ? { ...rec, preview: x.preview } : x)));
    } catch (e: any) {
      notify("Erro", e?.message || String(e));
    }
  };

  const template = async (area: string) => {
    try {
      const uri = await downloadFile(`/analise/modelo/${area}`, `modelo-${area}.xlsx`);
      if (uri) notify("Modelo baixado", `Arquivo salvo em:\n${uri}`);
    } catch (e: any) {
      notify("Erro", e?.message || String(e));
    }
  };

  // ------------------------------------------------------------- passo 3
  const analyze = async () => {
    if (!draftId) return;
    setBusy("analisar");
    try {
      const r = await api<any>(`/obras/${draftId}/analisar`, { method: "POST" });
      setResult(r);
      setStep("resultado");
    } catch (e: any) {
      notify("Não foi possível analisar", e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const review = () => {
    if (!draftId) return;
    router.push({ pathname: "/obra-editar", params: { id: draftId, modo: "confirmar" } });
  };

  const photos = useMemo(() => files.filter((f) => f.category === "foto"), [files]);
  const docs = useMemo(() => files.filter((f) => f.category !== "foto"), [files]);
  const canAnalyze = kind === "patologia" ? photos.length > 0 : docs.length > 0;

  // ------------------------------------------------------------- render
  if (allowed === false) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.scroll}>
          <Text style={styles.sectionTitle}>ACESSO RESTRITO</Text>
          <Text style={styles.hint}>Só administrador, engenheiro ou diretor logados podem cadastrar obras.</Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>FAZER LOGIN</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const stepIndex = step === "tipo" ? 0 : step === "coleta" ? 1 : 2;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={step === "resultado" ? () => setStep("coleta") : cancel} style={styles.back} accessibilityLabel="Voltar">
          <Ionicons name={step === "resultado" ? "arrow-back" : "close"} size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>NOVA OBRA • PASSO {stepIndex + 1} DE 4</Text>
          <Text style={styles.hTitle}>
            {step === "tipo" ? "Como analisar a obra?" : step === "coleta" ? (kind === "patologia" ? "Fotos do local" : "Arquivos da obra") : "Resultado da análise"}
          </Text>
        </View>
      </View>
      <View style={styles.stepper}>
        {["Tipo", "Coleta", "Análise", "Revisão"].map((l, i) => (
          <View key={l} style={[styles.stepItem, i <= stepIndex && styles.stepItemOn]}>
            <Text style={[styles.stepText, i <= stepIndex && styles.stepTextOn]}>{l.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---------------------------------------------------- PASSO 1 */}
        {step === "tipo" ? (
          <>
            <Text style={styles.hint}>Escolha como o app vai conhecer a obra. O resultado da análise preenche os dados do cadastro para você revisar.</Text>
            <Pressable testID="tipo-patologia" disabled={!!busy} onPress={() => chooseKind("patologia")} style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
              <View style={styles.choiceIcon}><Ionicons name="camera" size={28} color={colors.onBrand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>ANÁLISE EM TEMPO REAL VIA FOTOS</Text>
                <Text style={styles.choiceSub}>Patologia das construções</Text>
                <Text style={styles.hint}>Fotografe o local: o app identifica fissuras, umidade, corrosão, desplacamentos e outras manifestações, com prioridade GUT. Depois você classifica a obra (localidade, datas, ART, porte...).</Text>
              </View>
            </Pressable>
            <Pressable testID="tipo-geral" disabled={!!busy} onPress={() => chooseKind("geral")} style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
              <View style={styles.choiceIcon}><Ionicons name="folder-open" size={28} color={colors.onBrand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>INSERIR PLANILHAS E ARQUIVOS</Text>
                <Text style={styles.choiceSub}>Obra geral</Text>
                <Text style={styles.hint}>Envie planilhas por área (pessoas, segurança/EPI, almoxarifado, planejamento, qualidade, documentação, custos) e arquivos do projeto (AutoCAD DXF/DWG, PDF, orçamento). O app lê tudo e monta o cadastro.</Text>
              </View>
            </Pressable>
            {busy === "tipo" ? <ActivityIndicator color={colors.brand} /> : null}
          </>
        ) : null}

        {/* ---------------------------------------------------- PASSO 2: PATOLOGIA */}
        {step === "coleta" && kind === "patologia" ? (
          <>
            <Text style={styles.hint}>Tire fotos próximas e bem iluminadas de cada manifestação (e uma foto geral do elemento). Cada foto é analisada assim que enviada.</Text>
            <View style={styles.row2}>
              <Pressable testID="foto-camera" onPress={() => addPhotos(true)} disabled={!!busy} style={[styles.bigBtn, styles.bigBtnBrand]}>
                <Ionicons name="camera" size={22} color={colors.onBrand} /><Text style={[styles.bigBtnText, { color: colors.onBrand }]}>TIRAR FOTO</Text>
              </Pressable>
              <Pressable testID="foto-galeria" onPress={() => addPhotos(false)} disabled={!!busy} style={styles.bigBtn}>
                <Ionicons name="images" size={22} color={colors.onSurface} /><Text style={styles.bigBtnText}>GALERIA</Text>
              </Pressable>
            </View>
            {busy === "foto" ? <View style={styles.busyRow}><ActivityIndicator color={colors.brand} /><Text style={styles.hint}>Enviando e analisando…</Text></View> : null}
            {photos.map((f, i) => {
              const ex = f.extracted || {};
              const d = describe(f);
              return (
                <View key={f.id} style={styles.photoCard}>
                  {f.preview ? <Image source={{ uri: f.preview }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image" size={20} color={colors.info} /></View>}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.fileName}>FOTO {i + 1}</Text>
                    <Text style={styles.fileMeta}>{d.text}</Text>
                    {ex.provedor ? <Text style={styles.fileMeta}>Analisada por {String(ex.provedor).startsWith("gemini") ? "Gemini" : "Claude"}</Text> : null}
                    {(ex.manifestacoes || []).map((m: any, j: number) => {
                      const v = ex.validacao?.[String(j)]?.status;
                      return (
                        <View key={j} style={styles.manifRow}>
                          <Text style={[styles.manifLine, { flex: 1 }, v === "rejeitada" && styles.strike]}>
                            • {m.tipo} — GUT {m.gut}{m.localizacao ? ` • ${m.localizacao}` : ""}
                          </Text>
                          <Pressable onPress={() => validate(f, j, "confirmada")} hitSlop={6} accessibilityLabel="Confirmar manifestação"
                            style={[styles.valBtn, v === "confirmada" && { backgroundColor: colors.success, borderColor: colors.success }]}>
                            <Ionicons name="checkmark" size={14} color={v === "confirmada" ? "#FFFFFF" : colors.success} />
                          </Pressable>
                          <Pressable onPress={() => validate(f, j, "rejeitada")} hitSlop={6} accessibilityLabel="Rejeitar manifestação"
                            style={[styles.valBtn, v === "rejeitada" && { backgroundColor: colors.error, borderColor: colors.error }]}>
                            <Ionicons name="close" size={14} color={v === "rejeitada" ? "#FFFFFF" : colors.error} />
                          </Pressable>
                        </View>
                      );
                    })}
                    {(ex.manifestacoes || []).length ? <Text style={styles.fileMeta}>✓ confirma / ✗ rejeita — suas validações treinam o detector YOLO</Text> : null}
                  </View>
                  <Pressable onPress={() => removeFile(f)} hitSlop={10} accessibilityLabel="Remover foto"><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
                </View>
              );
            })}
          </>
        ) : null}

        {/* ---------------------------------------------------- PASSO 2: GERAL */}
        {step === "coleta" && kind === "geral" ? (
          <>
            <Text style={styles.hint}>Anexe o que tiver — não é preciso preencher todas as áreas. Aceita .xlsx, .csv, .pdf, .dxf, .dwg e imagens. Use os modelos se quiser um formato pronto.</Text>
            {AREAS.map((a) => {
              const fs = docs.filter((f) => f.category === a.id);
              return (
                <View key={a.id} style={[styles.areaCard, fs.length > 0 && styles.areaCardOn]}>
                  <View style={styles.areaHead}>
                    <Ionicons name={a.icon} size={20} color={fs.length ? colors.brand : colors.info} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.areaTitle}>{a.label.toUpperCase()}</Text>
                      <Text style={styles.fileMeta}>{a.hint}</Text>
                    </View>
                    {fs.length ? <Text style={styles.countBadge}>{fs.length}</Text> : null}
                  </View>
                  {fs.map((f) => {
                    const d = describe(f);
                    return (
                      <View key={f.id} style={styles.fileRow}>
                        <Ionicons name="document-attach" size={16} color={colors.info} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.filename}</Text>
                          <Text style={styles.fileMeta}>{d.text}</Text>
                          {d.warn ? <Text style={styles.warnText}>⚠ {d.warn}</Text> : null}
                        </View>
                        <Pressable onPress={() => removeFile(f)} hitSlop={10} accessibilityLabel="Remover arquivo"><Ionicons name="close" size={18} color={colors.error} /></Pressable>
                      </View>
                    );
                  })}
                  <View style={styles.row2}>
                    <Pressable testID={`anexar-${a.id}`} onPress={() => addFile(a.id)} disabled={!!busy} style={[styles.smallBtn, { flex: 1 }]}>
                      {busy === a.id ? <ActivityIndicator color={colors.brand} /> : <><Ionicons name="add" size={16} color={colors.onSurface} /><Text style={styles.smallBtnText}>ANEXAR</Text></>}
                    </Pressable>
                    {a.template ? (
                      <Pressable onPress={() => template(a.id)} style={styles.smallBtn}>
                        <Ionicons name="download-outline" size={16} color={colors.onSurface} /><Text style={styles.smallBtnText}>MODELO</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </>
        ) : null}

        {step === "coleta" ? (
          <>
            <Pressable testID="analisar" onPress={analyze} disabled={!canAnalyze || !!busy} style={[styles.primaryBtn, (!canAnalyze || !!busy) && { opacity: 0.5 }]}>
              {busy === "analisar" ? <ActivityIndicator color={colors.onBrand} /> : (
                <><Ionicons name="analytics" size={20} color={colors.onBrand} /><Text style={styles.primaryBtnText}>ANALISAR OBRA</Text></>
              )}
            </Pressable>
            {!canAnalyze ? <Text style={[styles.hint, { textAlign: "center" }]}>{kind === "patologia" ? "Envie pelo menos uma foto." : "Anexe pelo menos um arquivo."}</Text> : null}
            <Pressable
              testID="trocar-tipo"
              disabled={!!busy}
              onPress={switchKind}
              accessibilityRole="button"
              style={({ pressed }) => [styles.switchBtn, pressed && styles.switchBtnPressed]}
            >
              <Ionicons name="swap-horizontal" size={16} color={colors.brand} />
              <Text style={styles.switchBtnText}>TROCAR O TIPO DE ANÁLISE</Text>
            </Pressable>
          </>
        ) : null}

        {/* ---------------------------------------------------- PASSO 3 */}
        {step === "resultado" && result ? (
          kind === "patologia" ? <ResultadoPatologia r={result} /> : <ResultadoGeral r={result} />
        ) : null}

        {step === "resultado" ? (
          <>
            <Pressable testID="revisar" onPress={review} style={styles.primaryBtn}>
              <Ionicons name="checkmark-done" size={20} color={colors.onBrand} />
              <Text style={styles.primaryBtnText}>REVISAR DADOS E CADASTRAR</Text>
            </Pressable>
            <Pressable onPress={() => setStep("coleta")} style={styles.secondaryBtn}>
              <Text style={styles.smallBtnText}>{kind === "patologia" ? "ADICIONAR MAIS FOTOS" : "ANEXAR MAIS ARQUIVOS"}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Parecer({ text, mode }: { text: string; mode: string }) {
  const styles = useStyles();
  return (
    <View style={styles.parecer}>
      <Text style={styles.areaTitle}>PARECER {mode === "ai" ? "(IA)" : "(AUTOMÁTICO, SEM IA)"}</Text>
      <Text style={styles.parecerText}>{text}</Text>
      <Text style={styles.fileMeta}>Apoio à decisão — confira com o responsável técnico.</Text>
    </View>
  );
}

function ResultadoGeral({ r }: { r: any }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const res = r.analysis?.resultado || {};
  const sug = r.sugeridos || {};
  const LABELS: Record<string, string> = { name: "Nome", address: "Localidade", start_date: "Início", end_date: "Término previsto", progress: "Estágio (%)", company: "Empresa", art: "ART", size: "Porte", workers_count: "Funcionários" };
  return (
    <>
      <View style={styles.scoreBox}>
        <Text style={styles.scoreLabel}>ÍNDICE DE COMPLETUDE DO CADASTRO</Text>
        <Text style={styles.scoreValue}>{res.indice_completude ?? 0}%</Text>
        <Text style={styles.fileMeta}>{res.areas_cobertas ?? 0} de {AREAS.length} áreas com arquivos</Text>
      </View>
      {AREAS.map((a) => {
        const ar = res.areas?.[a.id];
        if (!ar) return null;
        const tone = ar.status === "ok" ? colors.success : ar.status === "atencao" ? colors.warning : colors.info;
        return (
          <View key={a.id} style={styles.areaResult}>
            <View style={styles.areaHead}>
              <Ionicons name={a.icon} size={18} color={tone} />
              <Text style={[styles.areaTitle, { flex: 1 }]}>{a.label.toUpperCase()}</Text>
              <Text style={[styles.statusTag, { borderColor: tone, color: tone }]}>{ar.status === "ok" ? "OK" : ar.status === "atencao" ? "ATENÇÃO" : "SEM DADOS"}</Text>
            </View>
            <View style={styles.barBg}><View style={[styles.barFill, { width: `${ar.completude}%`, backgroundColor: tone }]} /></View>
            {Object.entries(ar.metricas || {}).filter(([, v]) => typeof v !== "object").slice(0, 4).map(([k, v]) => (
              <Text key={k} style={styles.fileMeta}>{k.replace(/_/g, " ")}: {String(v)}</Text>
            ))}
            {(ar.alertas || []).slice(0, 3).map((w: string, i: number) => <Text key={i} style={styles.warnText}>⚠ {w}</Text>)}
          </View>
        );
      })}
      {Object.keys(sug).length ? (
        <View style={styles.areaResult}>
          <Text style={styles.areaTitle}>DADOS DA OBRA ENCONTRADOS NOS ARQUIVOS</Text>
          {Object.entries(sug).map(([k, v]) => <Text key={k} style={styles.fileMeta}>{LABELS[k] || k}: {String(v)}</Text>)}
          <Text style={styles.hint}>Você confere e completa na próxima tela.</Text>
        </View>
      ) : null}
      <Parecer text={r.analysis?.parecer || ""} mode={r.analysis?.parecer_modo} />
    </>
  );
}

function ResultadoPatologia({ r }: { r: any }) {
  const styles = useStyles();
  const res = r.analysis?.resultado || {};
  const estado = res.estado_geral || "pendente";
  return (
    <>
      <View style={[styles.scoreBox, { borderColor: ESTADO_COLOR[estado] }]}>
        <Text style={styles.scoreLabel}>ESTADO GERAL ESTIMADO</Text>
        <Text style={[styles.scoreValue, { color: ESTADO_COLOR[estado] }]}>{ESTADO_LABEL[estado] || estado}</Text>
        <Text style={styles.fileMeta}>{res.fotos_analisadas ?? 0} de {res.fotos ?? 0} foto(s) analisadas • maior GUT {res.gut_maximo ?? 0}</Text>
      </View>
      {res.fotos_pendentes ? (
        <Text style={styles.warnText}>⚠ {res.fotos_pendentes} foto(s) sem análise automática — registre a vistoria manualmente.</Text>
      ) : null}
      {(res.manifestacoes || []).slice(0, 10).map((m: any, i: number) => {
        const sev = m.gut >= 64 ? "critica" : m.gut >= 27 ? "alta" : m.gut >= 8 ? "media" : "baixa";
        return (
          <View key={i} style={[styles.areaResult, { borderLeftWidth: 6, borderLeftColor: severityColor[sev] }]}>
            <Text style={styles.areaTitle}>{(m.tipo || "manifestação").toUpperCase()} • GUT {m.gut}</Text>
            <Text style={styles.fileMeta}>Foto {m.foto} • {m.elemento || "elemento"} • {m.localizacao || "local não informado"}</Text>
            {m.causa_provavel ? <Text style={styles.fileMeta}>Causa provável: {m.causa_provavel}</Text> : null}
            {m.recomendacao ? <Text style={styles.manifLine}>→ {m.recomendacao}</Text> : null}
            <Text style={styles.fileMeta}>Confiança: {m.confianca || "—"}</Text>
          </View>
        );
      })}
      <Parecer text={r.analysis?.parecer || ""} mode={r.analysis?.parecer_modo} />
    </>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  stepper: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  stepItem: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRightWidth: 1, borderRightColor: colors.border },
  stepItemOn: { backgroundColor: colors.brand },
  stepText: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, fontWeight: "700", color: colors.info, letterSpacing: 0.5 },
  stepTextOn: { color: colors.onBrand },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] },
  hint: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, lineHeight: Math.round(fontSize.xs * 1.5) },
  sectionTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, color: colors.onSurface },
  choice: { flexDirection: "row", gap: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, backgroundColor: colors.surface },
  choicePressed: { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand },
  choiceIcon: { width: 56, height: 56, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  choiceTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: 0.3 },
  choiceSub: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.brand, fontWeight: "700", marginBottom: spacing.xs, letterSpacing: 1 },
  row2: { flexDirection: "row", gap: spacing.sm },
  bigBtn: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 56, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  bigBtnBrand: { backgroundColor: colors.brand },
  bigBtnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface, letterSpacing: 1 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  photoCard: { flexDirection: "row", gap: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.sm, alignItems: "flex-start" },
  thumb: { width: 72, height: 72, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  fileName: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface },
  fileMeta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info },
  manifRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  valBtn: { width: 26, height: 26, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  strike: { textDecorationLine: "line-through", color: colors.info },
  manifLine: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface },
  warnText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.warning, fontWeight: "700" },
  areaCard: { borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  areaCardOn: { borderColor: colors.brand },
  areaHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  areaTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface, letterSpacing: 0.5 },
  countBadge: { minWidth: 24, textAlign: "center", fontFamily: fonts.mono, fontWeight: "700", fontSize: fontSize.xs, color: colors.onBrand, backgroundColor: colors.brand, paddingHorizontal: 6, paddingVertical: 2 },
  fileRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  smallBtn: { flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: spacing.md, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary },
  smallBtnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.xs, color: colors.onSurface, letterSpacing: 0.5 },
  primaryBtn: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.lg, alignItems: "center", justifyContent: "center", minHeight: 56 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, letterSpacing: 1 },
  secondaryBtn: { alignItems: "center", justifyContent: "center", minHeight: 48, borderWidth: 2, borderColor: colors.borderStrong },
  link: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, textDecorationLine: "underline", textAlign: "center" },
  // "Trocar o tipo de análise": botão com borda laranja, mesmo tamanho de letra do antigo link (fontSize.xs)
  switchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.lg, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.surface, alignSelf: "center" },
  switchBtnPressed: { backgroundColor: colors.surfaceSecondary },
  switchBtnText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "900", color: colors.brand, letterSpacing: 1 },
  scoreBox: { borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surfaceInverse, padding: spacing.lg, gap: 4 },
  scoreLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.brandTertiary, fontWeight: "700" },
  scoreValue: { fontFamily: fonts.display, fontSize: fontSize["4xl"], fontWeight: "900", color: colors.brand, letterSpacing: -1 },
  areaResult: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: 4 },
  statusTag: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, fontWeight: "700", borderWidth: 2, paddingHorizontal: 6, paddingVertical: 1 },
  barBg: { height: 6, backgroundColor: colors.surfaceTertiary, marginVertical: 2 },
  barFill: { height: "100%" },
  parecer: { borderWidth: 2, borderColor: colors.borderStrong, borderStyle: "dashed", padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surfaceSecondary },
  parecerText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurface, lineHeight: Math.round(fontSize.sm * 1.5) },
}));
