// Tela de carregamento "ENGENHEIRO COPILOT".
// Visual baseado na animação de referência (estrutura isométrica sendo montada), mas guiado pelo
// carregamento REAL do app (src/preload.ts): a barra, a %, o "NV n/4", o pavimento desenhado e o texto
// da direita mudam conforme cada etapa termina de verdade — nada é cronometrado.
// Responsiva: a arte é um quadrado de 480 "unidades" escalado para o maior quadrado que cabe na tela (até 560px).
import { useEffect, useRef } from "react";
import { Animated, Image, Platform, StatusBar, Text, useWindowDimensions, View } from "react-native";
import type { LoadStep } from "@/src/preload";

export const LOADING_BG = "#0C0C0C";
const WHITE = "#EFEDE9";
const ORANGE = "#FF6B18";
const GRAY = "#8A8580";
const LINE = "#3A3A3A";
const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, Menlo, Consolas, monospace" });

// Pavimentos da estrutura: 0 = só a grade … 4 = estrutura completa (PRONTO)
const ESTRUTURA = [
  require("../../assets/images/carregamento-estrutura-0.png"),
  require("../../assets/images/carregamento-estrutura-1.png"),
  require("../../assets/images/carregamento-estrutura-2.png"),
  require("../../assets/images/carregamento-estrutura-3.png"),
  require("../../assets/images/carregamento-estrutura-4.png"),
];

type Props = { steps: LoadStep[]; progress: number; onFirstLayout?: () => void };

export function LoadingScreen({ steps, progress, onFirstLayout }: Props) {
  const { width, height } = useWindowDimensions();
  const S = Math.min(width, height, 560);
  const k = S / 480; // escala da arte original (480 x 480)

  const done = steps.filter((s) => s.state === "ok" || s.state === "falhou").length;
  const finished = progress >= 100;
  const current = steps.find((s) => s.state === "carregando") || steps.find((s) => s.state === "pendente");
  const level = Math.min(done + (finished ? 0 : 1), steps.length);
  const obras = steps.find((s) => s.id === "obras");
  const rightLabel = finished ? (obras?.state === "ok" ? obras.label : (steps.find((s) => s.state === "falhou")?.label ?? "")) : current?.label ?? "";

  // barra anima até o valor real (não inventa progresso entre as etapas)
  const bar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(bar, { toValue: progress, duration: 280, useNativeDriver: false }).start();
  }, [progress, bar]);

  const firstLayout = useRef(false);
  const u = (n: number) => n * k;

  return (
    <View
      style={{ flex: 1, backgroundColor: LOADING_BG, alignItems: "center", justifyContent: "center" }}
      onLayout={() => { if (!firstLayout.current) { firstLayout.current = true; onFirstLayout?.(); } }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Engenheiro Copilot carregando: ${progress}%. ${current?.label ?? "Pronto"}`}
      accessibilityValue={{ min: 0, max: 100, now: progress }}
    >
      <StatusBar barStyle="light-content" backgroundColor={LOADING_BG} />
      <View style={{ width: S, height: S }}>
        {/* título */}
        <View style={{ position: "absolute", left: u(25), top: u(28) }}>
          <Text style={{ color: WHITE, fontSize: u(40), fontWeight: "900", letterSpacing: u(-0.8), lineHeight: u(44) }}>ENGENHEIRO</Text>
          <Text style={{ color: finished ? WHITE : ORANGE, fontSize: u(40), fontWeight: "900", letterSpacing: u(-0.8), lineHeight: u(44) }}>COPILOT</Text>
        </View>
        {/* ficha técnica */}
        <View style={{ position: "absolute", left: u(330), top: u(30), gap: u(4) }}>
          <Text style={{ color: GRAY, fontFamily: MONO, fontSize: u(11) }}>Nº 0428</Text>
          <Text style={{ color: GRAY, fontFamily: MONO, fontSize: u(11) }}>NV {level}/{steps.length}</Text>
        </View>
        {/* estrutura: um pavimento a cada etapa concluída */}
        <Image source={ESTRUTURA[Math.min(done, ESTRUTURA.length - 1)]} style={{ position: "absolute", left: 0, top: u(112), width: S, height: u(286) }} resizeMode="stretch" />
        {/* % e etapa atual */}
        <Text style={{ position: "absolute", left: u(42), top: u(400), color: WHITE, fontFamily: MONO, fontWeight: "700", fontSize: u(13) }}>
          {finished ? "PRONTO" : `${progress}%`}
        </Text>
        <Text numberOfLines={1} style={{ position: "absolute", right: u(480 - 423), top: u(402), maxWidth: u(300), textAlign: "right", color: GRAY, fontFamily: MONO, fontSize: u(11) }}>
          {rightLabel}
        </Text>
        {/* barra de carregamento real */}
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={{ position: "absolute", left: u(24 + 43.2 * (i + 1)), top: u(424), width: 1, height: u(6), backgroundColor: LINE }} />
        ))}
        <View style={{ position: "absolute", left: u(24), top: u(430), width: u(432), height: Math.max(4, u(8)), borderWidth: 1, borderColor: LINE }}>
          <Animated.View
            style={{
              height: "100%",
              backgroundColor: ORANGE,
              width: bar.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
            }}
          />
        </View>
      </View>
    </View>
  );
}
