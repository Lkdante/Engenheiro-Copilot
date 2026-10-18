// Banners do card "Estágio atual" (detalhe da obra). Cada obra recebe um, sorteado pelo servidor ao ser criada
// (campo `banner`, 1..8). Arte em traço branco sobre preto, no padrão da referência "PONTO DE FUGA".
// 1 ponto de fuga · 2 pórticos em série · 3 planta baixa · 4 elevação frontal
// 5 isométrico estrutural · 6 escada · 7 corte AA · 8 treliça/passarela
const BANNERS = [
  require("../assets/images/banners/banner-obra-1.png"),
  require("../assets/images/banners/banner-obra-2.png"),
  require("../assets/images/banners/banner-obra-3.png"),
  require("../assets/images/banners/banner-obra-4.png"),
  require("../assets/images/banners/banner-obra-5.png"),
  require("../assets/images/banners/banner-obra-6.png"),
  require("../assets/images/banners/banner-obra-7.png"),
  require("../assets/images/banners/banner-obra-8.png"),
];
// Tema claro: mesma arte com fundo branco e traço preto
const BANNERS_CLARO = [
  require("../assets/images/banners/banner-obra-1-claro.png"),
  require("../assets/images/banners/banner-obra-2-claro.png"),
  require("../assets/images/banners/banner-obra-3-claro.png"),
  require("../assets/images/banners/banner-obra-4-claro.png"),
  require("../assets/images/banners/banner-obra-5-claro.png"),
  require("../assets/images/banners/banner-obra-6-claro.png"),
  require("../assets/images/banners/banner-obra-7-claro.png"),
  require("../assets/images/banners/banner-obra-8-claro.png"),
];

/** Banner da obra (versão do tema). Sem o campo (servidor antigo), escolhe um fixo a partir do id. */
export function bannerFor(obra: { id: string; banner?: number | null }, dark = true) {
  return (dark ? BANNERS : BANNERS_CLARO)[bannerIndex(obra) - 1];
}

/** Número do sorteio da obra (1..8). Também escolhe a animação do card "Avanço físico" no painel. */
export function bannerIndex(obra: { id: string; banner?: number | null }): number {
  return obra.banner && obra.banner >= 1 && obra.banner <= BANNERS.length
    ? obra.banner
    : 1 + ([...obra.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % BANNERS.length);
}
