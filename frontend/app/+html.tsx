// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              /* ---------- Pré-carregamento (web): aparece na hora, antes do JavaScript do app chegar ---------- */
              html, body { background: #0C0C0C; }
              #boot-splash { position: fixed; inset: 0; z-index: 99999; background: #0C0C0C; display: flex; align-items: center; justify-content: center; transition: opacity .25s ease; }
              #boot-splash.sai { opacity: 0; pointer-events: none; }
              #boot-splash .q { --s: min(100vw, 100vh, 560px); position: relative; width: var(--s); height: var(--s); }
              #boot-splash .u { position: absolute; margin: 0; }
              #boot-splash .t { left: calc(var(--s) * 25 / 480); top: calc(var(--s) * 28 / 480); font: 900 calc(var(--s) * 40 / 480) / calc(var(--s) * 44 / 480) system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; letter-spacing: calc(var(--s) * -0.8 / 480); color: #EFEDE9; }
              #boot-splash .t span { display: block; color: #FF6B18; }
              #boot-splash .m { font: calc(var(--s) * 11 / 480) ui-monospace, Menlo, Consolas, monospace; color: #8A8580; }
              #boot-splash .ficha { left: calc(var(--s) * 330 / 480); top: calc(var(--s) * 30 / 480); line-height: 1.4; }
              #boot-splash img { left: 0; top: calc(var(--s) * 112 / 480); width: 100%; height: calc(var(--s) * 286 / 480); }
              #boot-splash .pct { left: calc(var(--s) * 42 / 480); top: calc(var(--s) * 400 / 480); font: 700 calc(var(--s) * 13 / 480) ui-monospace, Menlo, Consolas, monospace; color: #EFEDE9; }
              #boot-splash .etapa { right: calc(var(--s) * 57 / 480); top: calc(var(--s) * 402 / 480); }
              #boot-splash .barra { left: calc(var(--s) * 24 / 480); top: calc(var(--s) * 430 / 480); width: calc(var(--s) * 432 / 480); height: max(4px, calc(var(--s) * 8 / 480)); border: 1px solid #3A3A3A; box-sizing: border-box; overflow: hidden;
                background-image: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), #2A2A2A calc(10% - 1px) 10%); }
              #boot-splash .barra i { position: absolute; top: 0; bottom: 0; width: 28%; background: #FF6B18; animation: boot-vai 1.3s ease-in-out infinite; }
              @keyframes boot-vai { 0% { left: -28%; } 100% { left: 100%; } }
              @media (prefers-reduced-motion: reduce) { #boot-splash .barra i { animation: none; left: 0; width: 100%; opacity: .35; } }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
        {/* Pré-carregamento: só HTML/CSS, aparece enquanto o Metro entrega o JavaScript.
            A barra aqui é só "aguarde" (o navegador não sabe o progresso do Metro).
            Quando o app abre, a tela de carregamento REAL (4 etapas) remove este bloco. */}
        <div id="boot-splash" role="progressbar" aria-label="Engenheiro Copilot — preparando o app">
          <div className="q">
            <h1 className="u t">ENGENHEIRO<span>COPILOT</span></h1>
            <div className="u m ficha">Nº 0428<br />NV 0/4</div>
            <img className="u" alt="" src="data:image/png;base64,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" />
            <div className="u pct">CARREGANDO</div>
            <div className="u m etapa">PREPARANDO O APP</div>
            <div className="u barra"><i /></div>
          </div>
        </div>
      </body>
    </html>
  );
}
