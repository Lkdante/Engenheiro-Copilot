// Animação do card AVANÇO FÍSICO (dashboard da obra): uma estrutura se ergue e depois cai, em loop contínuo de 5 s.
// 3 estruturas, sorteadas por obra (mesmo sorteio do banner):
//   0 · PÓRTICO      — esqueleto de 4 pavimentos (pilares, lajes, contraventamento)
//   1 · PONTE        — pilares maciços de concreto + tabuleiro monolítico
//   2 · COLUNATA     — colunas maciças + viga + treliça triangular
// Visual brutalista: massas sólidas de "concreto" (faces em cinzas chapados), arestas brancas grossas, acentos laranja.
// Desenho vetorial (react-native-svg), fundo transparente (usa o tom escuro do card). Pausa quando a aba sai de foco.
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import Svg, { Circle, G, Line, Polygon } from "react-native-svg";

export const CICLO_MS = 5000; // duração de uma volta completa
export const VARIANTES = 3;

const WHITE = "#EFEDE9";
const ORANGE = "#FF6B18";
const GRID = "#FFFFFF";
// faces de concreto (topo mais claro, laterais mais escuras)
const FACE_TOP = "#4A4A48", FACE_L = "#2A2A29", FACE_R = "#363634";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const easeIn = (v: number) => v * v * v;
const ph = (t: number, start: number, dur: number) => clamp((t - start) / dur);

// ------------------------------------------------------------------ geometria isométrica (caixa 300 x 300)
const U = 24, CX = 150, CY = 200;
type Pt = { x: number; y: number };
const iso = (x: number, y: number, z: number): Pt => ({ x: CX + (x - y) * U * 0.866, y: CY + (x + y) * U * 0.5 - z * U });
const pts = (a: Pt[]) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

function useLoopClock(): number {
  const [t, setT] = useState(0);
  const running = useRef(true);
  const start = useRef(Date.now());
  useFocusEffect(useCallback(() => { running.current = true; return () => { running.current = false; }; }, []));
  useEffect(() => {
    let raf = 0, last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!running.current || now - last < 33) return; // ~30 quadros/s
      last = now;
      setT(((Date.now() - start.current) % CICLO_MS) / 1000);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

/** Bloco maciço de concreto: 3 faces visíveis + arestas brancas grossas. */
function Bloco({ x, y, z, dx, dy, dz, a = 1, w = 2.6 }: { x: number; y: number; z: number; dx: number; dy: number; dz: number; a?: number; w?: number }) {
  if (dz <= 0.001 || a <= 0.01) return null;
  const x1 = x + dx, y1 = y + dy, z1 = z + dz;
  const top = [iso(x, y, z1), iso(x1, y, z1), iso(x1, y1, z1), iso(x, y1, z1)];
  const left = [iso(x, y1, z), iso(x1, y1, z), iso(x1, y1, z1), iso(x, y1, z1)];   // face y = y1
  const right = [iso(x1, y, z), iso(x1, y1, z), iso(x1, y1, z1), iso(x1, y, z1)];  // face x = x1
  return (
    <G opacity={a}>
      <Polygon points={pts(left)} fill={FACE_L} stroke={WHITE} strokeWidth={w} strokeLinejoin="miter" />
      <Polygon points={pts(right)} fill={FACE_R} stroke={WHITE} strokeWidth={w} strokeLinejoin="miter" />
      <Polygon points={pts(top)} fill={FACE_TOP} stroke={WHITE} strokeWidth={w} strokeLinejoin="miter" />
    </G>
  );
}

function L({ a, b, c = WHITE, w = 2, o = 1 }: { a: Pt; b: Pt; c?: string; w?: number; o?: number }) {
  return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeWidth={w} strokeOpacity={o} strokeLinecap="square" />;
}

function Malha({ a }: { a: number }) {
  if (a <= 0.01) return null;
  return (
    <G opacity={a}>
      {Array.from({ length: 7 }, (_, i) => i - 3).map((i) => (
        <G key={i}>
          <L a={iso(i, -3, 0)} b={iso(i, 3, 0)} c={GRID} w={1} />
          <L a={iso(-3, i, 0)} b={iso(3, i, 0)} c={GRID} w={1} />
        </G>
      ))}
    </G>
  );
}

// ------------------------------------------------------------------ 0 · PÓRTICO (4 pavimentos)
function Portico({ t }: { t: number }) {
  const FLOORS = 4, H = 1.15, COLS = [0, 1, 2];
  const P = (x: number, y: number, z: number) => iso(x - 1, y - 1, z);
  const grid = Math.min(ph(t, 0, 0.35), 1 - ph(t, 4.64, 0.36)) * 0.16;
  const nodes = Math.min(ph(t, 2.78, 0.36), 1 - ph(t, 3.57, 0.43));
  return (
    <>
      <Malha a={grid} />
      {Array.from({ length: FLOORS }, (_, k) => {
        const rise = easeOut(ph(t, 0.35 + k * 0.6, 0.57));
        const fall = easeIn(ph(t, 3.57 + (FLOORS - 1 - k) * 0.21, 0.43)); // o de cima cai primeiro
        const alpha = rise * (1 - fall);
        if (alpha <= 0.01) return null;
        const zb = k * H - fall * 1.6, zt = zb + H * rise;
        const slab = clamp((rise - 0.6) / 0.4);
        return (
          <G key={k} opacity={alpha}>
            {COLS.flatMap((x) => COLS.map((y) => <L key={`${x}${y}`} a={P(x, y, zb)} b={P(x, y, zt)} w={2.6} />))}
            {rise > 0.5 ? (
              <G opacity={clamp((rise - 0.5) / 0.5)}>
                <L a={P(0, 2, zb)} b={P(1, 2, zt)} c={ORANGE} w={2} />
                <L a={P(2, 0, zb)} b={P(2, 1, zt)} c={ORANGE} w={2} />
                <L a={P(1, 2, zb)} b={P(2, 2, zt)} c={ORANGE} w={2} />
              </G>
            ) : null}
            {slab > 0 ? (
              <G opacity={slab}>
                <Polygon points={pts([P(0, 0, zt), P(2, 0, zt), P(2, 2, zt), P(0, 2, zt)])} fill={FACE_TOP} fillOpacity={0.55} stroke={WHITE} strokeWidth={2.4} />
                <L a={P(1, 0, zt)} b={P(1, 2, zt)} o={0.6} w={1.4} />
                <L a={P(0, 1, zt)} b={P(2, 1, zt)} o={0.6} w={1.4} />
              </G>
            ) : null}
          </G>
        );
      })}
      {nodes > 0.01 ? (
        <G opacity={nodes}>
          {COLS.flatMap((x) => COLS.map((y) => {
            const p = P(x, y, FLOORS * H);
            return <Circle key={`${x}${y}`} cx={p.x} cy={p.y} r={x === 1 && y === 1 ? 5 : 3.6} fill="none" stroke={ORANGE} strokeWidth={2} />;
          }))}
          <L a={P(1, 1, FLOORS * H)} b={P(1, 1, FLOORS * H + 0.6)} c={ORANGE} w={3} />
        </G>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ 1 · PONTE (pilares maciços + tabuleiro)
function Ponte({ t }: { t: number }) {
  const grid = Math.min(ph(t, 0, 0.35), 1 - ph(t, 4.6, 0.4)) * 0.16;
  const PIERS = [-2.6, -0.3, 2.0];         // posição x dos pilares
  const PH = 2.6;                          // altura dos pilares
  const deckLen = easeOut(ph(t, 1.5, 0.9)); // tabuleiro avança de um lado ao outro
  const deckFall = easeIn(ph(t, 3.5, 0.6));
  const deckA = (deckLen > 0 ? 1 : 0) * (1 - deckFall);
  const accent = Math.min(ph(t, 2.4, 0.35), 1 - deckFall);
  const x0 = -3, X = 6.0;                  // tabuleiro de x = -3 até x = 3
  const dz = PH - deckFall * 1.8;
  return (
    <>
      <Malha a={grid} />
      {/* pilares (de trás para frente) */}
      {PIERS.map((px, i) => {
        const rise = easeOut(ph(t, 0.35 + i * 0.3, 0.6));
        const sink = easeIn(ph(t, 3.9 + i * 0.12, 0.6)); // afundam no terreno
        const h = PH * rise * (1 - sink);
        return <Bloco key={i} x={px} y={-0.1} z={0} dx={0.9} dy={1.2} dz={h} a={1 - sink * 0.6} />;
      })}
      {/* tabuleiro monolítico */}
      {deckA > 0.01 ? (
        <G>
          <Bloco x={x0} y={-0.3} z={dz} dx={X * deckLen} dy={1.6} dz={0.55} a={deckA} w={3} />
          {/* guarda-corpo maciço */}
          <Bloco x={x0} y={1.1} z={dz + 0.55} dx={X * deckLen} dy={0.2} dz={0.35} a={deckA} w={2.2} />
          {accent > 0.01 ? <L a={iso(x0, 1.3, dz + 0.02)} b={iso(x0 + X * deckLen, 1.3, dz + 0.02)} c={ORANGE} w={4} o={accent} /> : null}
        </G>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ 2 · COLUNATA (colunas + viga + treliça triangular)
function Colunata({ t }: { t: number }) {
  const grid = Math.min(ph(t, 0, 0.35), 1 - ph(t, 4.6, 0.4)) * 0.16;
  const COLX = [-2.6, -1.0, 0.6, 2.2];
  const CH = 2.6;
  const beamRise = easeOut(ph(t, 1.45, 0.45));
  const trussIn = ph(t, 1.95, 0.85);            // treliça desenhada barra a barra
  const trussFall = easeIn(ph(t, 3.5, 0.5));
  const beamFall = easeIn(ph(t, 3.8, 0.45));
  const zBeam = CH - beamFall * 1.5;
  const zT = zBeam + 0.5 - trussFall * 2.2;     // base da treliça
  const xa = -2.8, xb = 3.0, TH = 1.5, n = 6;   // treliça Warren: 6 painéis
  const bars: { a: Pt; b: Pt; c: string; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    const xL = xa + ((xb - xa) * i) / n, xR = xa + ((xb - xa) * (i + 1)) / n, xM = (xL + xR) / 2;
    bars.push({ a: iso(xL, 0.4, zT), b: iso(xR, 0.4, zT), c: WHITE, w: 4 });          // banzo inferior
    bars.push({ a: iso(xL, 0.4, zT), b: iso(xM, 0.4, zT + TH), c: ORANGE, w: 3 });     // diagonal
    bars.push({ a: iso(xM, 0.4, zT + TH), b: iso(xR, 0.4, zT), c: ORANGE, w: 3 });     // diagonal
    if (i < n - 1) bars.push({ a: iso(xM, 0.4, zT + TH), b: iso(xM + (xR - xL), 0.4, zT + TH), c: WHITE, w: 4 }); // banzo superior
  }
  const shown = Math.floor(trussIn * bars.length);
  return (
    <>
      <Malha a={grid} />
      {COLX.map((cx, i) => {
        const rise = easeOut(ph(t, 0.35 + i * 0.25, 0.5));
        const sink = easeIn(ph(t, 4.0 + i * 0.1, 0.55));
        return <Bloco key={i} x={cx} y={0} z={0} dx={0.7} dy={0.9} dz={CH * rise * (1 - sink)} a={1 - sink * 0.6} />;
      })}
      {beamRise > 0.01 && beamFall < 0.99 ? (
        <Bloco x={-3} y={-0.1} z={zBeam} dx={6.2} dy={1.1} dz={0.5 * beamRise} a={1 - beamFall} w={3} />
      ) : null}
      {shown > 0 && trussFall < 0.99 ? (
        <G opacity={1 - trussFall}>
          {bars.slice(0, shown).map((b, i) => <L key={i} a={b.a} b={b.b} c={b.c} w={b.w} />)}
        </G>
      ) : null}
    </>
  );
}

export function AvancoAnimado({ size = 150, variante = 0 }: { size?: number; variante?: number }) {
  const t = useLoopClock();
  const v = ((variante % VARIANTES) + VARIANTES) % VARIANTES;
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      {v === 1 ? <Ponte t={t} /> : v === 2 ? <Colunata t={t} /> : <Portico t={t} />}
    </Svg>
  );
}
