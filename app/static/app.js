"use strict";
// Dashboard: só exibe o que a API devolve (o número é calculado no banco).
// Sem biblioteca, sem CDN: gráficos em SVG e HTML próprios.
// Idiomas: todo texto passa por T(), com o português como chave e {nome} para os valores; o inglês e o espanhol
// vêm de /static/i18n.json (tests/test_traducoes.py garante que nenhum texto fica sem tradução).

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- idioma da tela ----------
const LOCAIS = { pt: "pt-BR", en: "en-US", es: "es-ES" };
let TRADUCOES = {};
let LINGUA = escolherLingua();
let n0, n1;
function escolherLingua() {
  const pedida = new URLSearchParams(location.search).get("lang");  // link já no idioma: /?lang=en
  if (pedida in LOCAIS) return pedida;
  try { const salva = localStorage.getItem("lingua"); if (salva in LOCAIS) return salva; } catch (e) { /* sem armazenamento: segue o navegador */ }
  const nav = (navigator.language || "pt").slice(0, 2);
  return nav in LOCAIS ? nav : "pt";
}
function T(pt, v = {}) {
  const texto = LINGUA === "pt" ? pt : ((TRADUCOES[pt] || {})[LINGUA] || pt);
  return texto.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ""));
}
function aplicarLingua() {
  n0 = new Intl.NumberFormat(LOCAIS[LINGUA]);
  n1 = new Intl.NumberFormat(LOCAIS[LINGUA], { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  document.documentElement.lang = LOCAIS[LINGUA];
  document.title = T("Retorno do assistente · Acaso");
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = T(el.dataset.t); });
  document.querySelectorAll("[data-t-aria]").forEach((el) => el.setAttribute("aria-label", T(el.dataset.tAria)));
  document.querySelectorAll("[data-lingua]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lingua === LINGUA)));
}
function trocarLingua(nova) {
  LINGUA = nova;
  try { localStorage.setItem("lingua", nova); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
  aplicarLingua();
  mostrar();
}

// ---------- formatos ----------
const N = (v) => (v == null ? "—" : n0.format(v));
const P = (v) => (v == null ? "—" : n1.format(v) + "%");
const FAIXA = (lo, hi, suf = "%") => T("entre {a} e {b}", { a: n1.format(lo) + suf, b: n1.format(hi) + suf });
const DIA = (s) => new Date(String(s).slice(0, 10) + "T12:00:00");
const DATA = (s) => DIA(s).toLocaleDateString(LOCAIS[LINGUA]);
const DIA_MES = (s) => DIA(s).toLocaleDateString(LOCAIS[LINGUA], { day: "2-digit", month: "2-digit" });
const DIA_MES_ANO = (s) => DIA(s).toLocaleDateString(LOCAIS[LINGUA], { day: "2-digit", month: "2-digit", year: "2-digit" });
const MES = (s) => DIA(s).toLocaleDateString(LOCAIS[LINGUA], { month: "short", year: "2-digit" }).replace(/\./g, "").replace(/\s+de\s+|\s+/, "/");

const rot = (k) => ({
  estudo: T("Estudo e trabalho acadêmico"), programacao: T("Programação e tecnologia"), reescrita: T("Reescrita, resumo e tradução"),
  marketing: T("Marketing e conteúdo profissional"), ficcao: T("Ficção, roleplay e criação"), conhecimento: T("Conhecimento geral"),
  vida_pratica: T("Vida prática e conselhos"), imagem_midia: T("Pede imagem, vídeo ou áudio"), burlar_regras: T("Tenta burlar as regras"),
  saudacao_teste: T("Só cumprimenta ou testa"), outro: T("Outro tema"),
  português: T("Português"), inglês: T("Inglês"), celular: T("Celular"), computador: T("Computador"),
  noite: T("Começou à noite (18h–24h)"), madrugada: T("Começou de madrugada (0h–6h)"), manhã: T("Começou de manhã (6h–12h)"), tarde: T("Começou à tarde"),
  False: T("quem não tem essa característica"),
})[k] || k;
const regra = (k) => ({
  "referência: outro dia local, D+1 a D+7": T("Usada no dashboard: voltou em outro dia, até 7 dias depois"),
  "regra anterior: nova sessão (pausa > 30 min) até 7 x 24 h": T("Se voltar no mesmo dia contasse (depois de 30 min de pausa)"),
  "  └ sessão com pausa de 15 min": T("… com pausa de 15 min"),
  "  └ sessão com pausa de 60 min": T("… com pausa de 60 min"),
  "usuário = IP + user-agent": T("Pessoa = endereço de internet + navegador"),
  "usuário = IPs unidos pela conversa": T("Pessoa = endereços unidos quando aparecem na mesma conversa"),
  "uso = só início de conversa": T("Só conta abrir conversa nova (não reabrir uma antiga)"),
  "janela de 3 dias": T("Janela de 3 dias em vez de 7"),
  "janela de 14 dias": T("Janela de 14 dias em vez de 7"),
  "sem corte das 2 primeiras semanas": T("Incluindo as 2 primeiras semanas da base"),
  "sem corte do fim (janela incompleta)": T("Incluindo quem começou nos últimos dias da base"),
  "sem IPs anômalos (>= 10 user-agents)": T("Sem endereços compartilhados por muita gente"),
  "dia contado em UTC": T("Dia contado no horário universal (UTC)"),
})[k] || k;
const dim = (k) => ({ idioma: T("Idioma"), dispositivo: T("Dispositivo"), tema: T("Tema da 1ª conversa"), modelo: T("Modelo") })[k];
const dimMinuscula = (k) => ({ idioma: T("idioma"), dispositivo: T("dispositivo"), tema: T("tema da 1ª conversa"), modelo: T("modelo") })[k];

const comoClassificamos = () => ({
  simples: T("Uma inteligência artificial leu o que cada pessoa escreveu e escolheu o tema da conversa entre <b>11 opções definidas por nós</b>, sem poder inventar outra. Antes de usar, testamos se ela é confiável: repetindo a classificação, o tema foi o mesmo em <b>96 de cada 100 conversas</b>."),
  tecnico: `<ul>
    <li>${T("<b>Rótulos predefinidos:</b> os 11 temas saíram dos próprios dados (agrupamento estatístico das conversas) e foram revisados manualmente.")}</li>
    <li>${T("<b>Classificação:</b> o modelo GPT-5.4 lê as mensagens do usuário e escolhe um dos 11 rótulos. Mensagens muito curtas (“oi”, “teste”) viram “só cumprimenta ou testa” sem passar pela IA.")}</li>
    <li>${T("<b>Validação com teste de hipóteses:</b> estabilidade entre duas classificações independentes (κ de Cohen = 0,95; a hipótese de baixa concordância foi rejeitada) e 5 de 5 comportamentos previstos confirmados (por exemplo, pedidos de imagem recebem mais recusas; qui-quadrado, p &lt; 0,001).")}</li>
    <li>${T("<b>Revisão manual:</b> onde dois modelos discordaram, revisamos os padrões e escolhemos o mais coerente.")}</li>
  </ul>`,
});

async function api(rota) {
  const r = await fetch(rota);
  if (!r.ok) throw new Error(r.status === 400 ? T("Filtro inválido. Use o botão Limpar.") : T("A consulta falhou ({status}). Tente recarregar a página.", { status: r.status }));
  return r.json();
}

// ---------- dica (tooltip): mouse, toque e teclado ----------
function mostrarDica(alvo, html) {
  const d = $("#dica");
  d.innerHTML = html;
  d.hidden = false;
  const r = alvo.getBoundingClientRect();
  d.style.left = Math.min(window.innerWidth - d.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - d.offsetWidth / 2)) + "px";
  d.style.top = (r.top - d.offsetHeight - 8 < 70 ? r.bottom + 8 : r.top - d.offsetHeight - 8) + "px";
}
const esconderDica = () => { $("#dica").hidden = true; };
function ligarDicas(raiz) {
  raiz.querySelectorAll("[data-dica]").forEach((el) => {
    const html = el.getAttribute("data-dica");
    ["mouseenter", "focus", "click"].forEach((ev) => el.addEventListener(ev, () => mostrarDica(el, html)));
    ["mouseleave", "blur"].forEach((ev) => el.addEventListener(ev, esconderDica));
  });
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") esconderDica(); });
window.addEventListener("scroll", esconderDica, { passive: true });

// ---------- componentes ----------
const kpi = (rotulo, valor, det, extra = "") => `<div class="cartao kpi ${extra}"><div class="rotulo">${rotulo}</div><div class="valor">${valor}</div><div class="det">${det}</div></div>`;
function explicacao(simples, tecnico, sql) {
  const s = sql ? Object.entries(sql).map(([k, v]) => `<p class="ajuda">${esc(k)}</p><pre>${esc(v)}</pre>`).join("") : "";
  return `<details><summary>${T("Como calculamos?")}</summary><p class="simples">${simples}</p>${tecnico ? `<div class="tecnico"><b>${T("Detalhe técnico:")}</b> ${tecnico}</div>` : ""}${s ? `<details><summary>${T("Ver a consulta SQL")}</summary>${s}</details>` : ""}</details>`;
}
const passoEixo = (max, partes = 4) => { const b = Math.max(max, 1) / partes, p = 10 ** Math.floor(Math.log10(b)); return [1, 2, 2.5, 5, 10].map((f) => f * p).find((x) => x >= b); };
const MARGEM = () => T("A faixa clara é a <b>margem de erro</b>: com poucas pessoas, o número pode variar por acaso dentro dela.");
const POUCAS = (nMin) => T("Menos de {n} pessoas: o número não é mostrado.", { n: nMin });
const MENOS_DE = (nMin) => T("menos de {n} pessoas", { n: nMin });

// Linha do retorno por mês, com a margem de erro sombreada; meses com poucas pessoas ficam sem ponto.
function graficoLinha(serie, media, nMin) {
  const W = 760, H = 280, m = { l: 44, r: 16, t: 14, b: 30 };
  const ok = serie.filter((s) => s.suficiente);
  const topo = Math.ceil(Math.max(30, ...ok.map((s) => s.ic_hi)) / 10) * 10;
  const x = (i) => m.l + (serie.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (serie.length - 1));
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / topo);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Retorno mês a mês")}">`;
  for (let v = 0; v <= topo; v += passoEixo(topo)) s += `<line class="grade" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`;
  const idx = serie.map((s, i) => [s, i]).filter(([s]) => s.suficiente);
  if (idx.length > 1) {
    const banda = idx.map(([s, i]) => `${x(i)},${y(s.ic_hi)}`).concat(idx.slice().reverse().map(([s, i]) => `${x(i)},${y(s.ic_lo)}`)).join(" ");
    s += `<polygon points="${banda}" fill="var(--marca-fundo)" stroke="var(--marca-clara)" stroke-width=".8"/>`;
    s += `<polyline points="${idx.map(([s, i]) => `${x(i)},${y(s.retorno_pct)}`).join(" ")}" fill="none" stroke="var(--marca)" stroke-width="2.5" stroke-linejoin="round"/>`;
  }
  if (media != null) s += `<line class="media" x1="${m.l}" x2="${W - m.r}" y1="${y(media)}" y2="${y(media)}"/>`;
  serie.forEach((p, i) => {
    if (serie.length <= 14 || i % 2 === 0) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${MES(p.mes)}</text>`;
    if (p.suficiente) s += `<circle cx="${x(i)}" cy="${y(p.retorno_pct)}" r="5" fill="var(--marca)" stroke="var(--cartao)" stroke-width="2"/>`;
    const txt = `<b>${MES(p.mes)}</b><br>` + (p.suficiente ? T("{n} pessoas começaram · {k} voltaram", { n: N(p.n), k: N(p.voltaram) }) + `<br>${T("Retorno:")} <b>${P(p.retorno_pct)}</b><br>${T("Margem de erro:")} ${FAIXA(p.ic_lo, p.ic_hi)}` : POUCAS(nMin));
    s += `<rect class="alvo" tabindex="0" aria-label="${MES(p.mes)}: ${p.suficiente ? P(p.retorno_pct) : MENOS_DE(nMin)}" x="${x(i) - 14}" y="${m.t}" width="28" height="${H - m.t - m.b}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

// Colunas: quantas pessoas começaram em cada mês.
function graficoColunas(serie, nMin) {
  const W = 380, H = 280, m = { l: 40, r: 8, t: 14, b: 30 };
  const max = Math.max(1, ...serie.map((s) => s.n ?? 0)), passo = passoEixo(max), topo = Math.ceil(max / passo) * passo;
  const bw = (W - m.l - m.r) / serie.length;
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / topo);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Pessoas novas por mês")}">`;
  for (let v = 0; v <= topo; v += passo) s += `<line class="grade" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${N(v)}</text>`;
  serie.forEach((p, i) => {
    const x0 = m.l + i * bw;
    if (p.suficiente) s += `<rect x="${x0 + bw * 0.15}" y="${y(p.n)}" width="${bw * 0.7}" height="${y(0) - y(p.n)}" rx="3" fill="var(--marca-clara)"/>`;
    if (i % 3 === 0) s += `<text x="${x0 + bw / 2}" y="${H - 8}" text-anchor="middle">${MES(p.mes)}</text>`;
    const txt = p.suficiente ? T("{n} pessoas usaram pela 1ª vez", { n: N(p.n) }) : POUCAS(nMin);
    s += `<rect class="alvo" tabindex="0" x="${x0}" y="${m.t}" width="${bw}" height="${H - m.t - m.b}" aria-label="${MES(p.mes)}: ${p.suficiente ? T("{n} pessoas", { n: N(p.n) }) : MENOS_DE(nMin)}" data-dica="${esc(`<b>${MES(p.mes)}</b><br>${txt}`)}"/>`;
  });
  return s + "</svg>";
}

// Barras horizontais: retorno de cada grupo, com a margem de erro e a média do recorte.
function graficoBarras(linhas, media, nMin, W = 560) {
  const ord = [...linhas].sort((a, b) => (b.suficiente - a.suficiente) || (b.retorno_pct - a.retorno_pct));
  const lh = 34, m = { l: W < 500 ? 120 : 220, r: 64, t: 8, b: 26 };
  const H = m.t + m.b + lh * ord.length;
  const topo = Math.ceil(Math.max(30, ...ord.filter((l) => l.suficiente).map((l) => l.ic_hi)) / 10) * 10;
  const x = (v) => m.l + (v / topo) * (W - m.l - m.r);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Retorno por grupo")}">`;
  for (let v = 0; v <= topo; v += passoEixo(topo)) s += `<line class="grade" x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${H - m.b}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle">${v}%</text>`;
  if (media != null) s += `<line class="media" x1="${x(media)}" x2="${x(media)}" y1="${m.t - 2}" y2="${H - m.b}"/>`;
  ord.forEach((l, i) => {
    const yc = m.t + i * lh + lh / 2;
    s += `<text class="rot" x="${m.l - 10}" y="${yc + 4}" text-anchor="end">${esc(rot(l.categoria))}</text>`;
    if (l.suficiente) {
      s += `<rect x="${m.l}" y="${yc - 9}" width="${x(l.retorno_pct) - m.l}" height="18" rx="4" fill="var(--marca)"/>`;
      s += `<line x1="${x(l.ic_lo)}" x2="${x(l.ic_hi)}" y1="${yc}" y2="${yc}" stroke="var(--texto)" stroke-opacity=".45" stroke-width="2"/>`;
      s += `<text x="${x(Math.max(l.ic_hi, l.retorno_pct)) + 6}" y="${yc + 4}" style="fill:var(--texto)">${P(l.retorno_pct)}</text>`;
    } else {
      s += `<rect x="${m.l + 2}" y="${yc - 10}" width="112" height="20" rx="10" fill="var(--fundo)" stroke="var(--linha)"/><text x="${m.l + 58}" y="${yc + 4}" text-anchor="middle">${T("poucas pessoas")}</text>`;
    }
    const txt = `<b>${esc(rot(l.categoria))}</b><br>` + (l.suficiente ? T("{n} pessoas · {k} voltaram", { n: N(l.n), k: N(l.voltaram) }) + `<br>${T("Retorno:")} <b>${P(l.retorno_pct)}</b><br>${T("Margem de erro:")} ${FAIXA(l.ic_lo, l.ic_hi)}` : POUCAS(nMin));
    s += `<rect class="alvo" tabindex="0" x="0" y="${yc - lh / 2}" width="${W}" height="${lh}" aria-label="${esc(rot(l.categoria))}: ${l.suficiente ? P(l.retorno_pct) : MENOS_DE(nMin)}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

// Duas barras por tema: % das pessoas (1ª conversa) e % das conversas, mesma escala.
function graficoChegada(linhas) {
  const lh = 40, W = 760, m = { l: 230, r: 60, t: 6, b: 6 };
  const H = m.t + m.b + lh * linhas.length;
  const max = Math.max(1, ...linhas.filter((l) => l.suficiente).map((l) => Math.max(l.pct_pessoas, l.pct_conversas)));
  const w = (v) => (v / max) * (W - m.l - m.r);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Com que tema as pessoas chegam")}">`;
  linhas.forEach((l, i) => {
    const y0 = m.t + i * lh;
    s += `<text class="rot" x="${m.l - 10}" y="${y0 + lh / 2 + 4}" text-anchor="end">${esc(rot(l.categoria))}</text>`;
    if (!l.suficiente) { s += `<text x="${m.l + 6}" y="${y0 + lh / 2 + 4}">${T("poucas pessoas")}</text>`; return; }
    s += `<rect x="${m.l}" y="${y0 + 5}" width="${w(l.pct_pessoas)}" height="13" rx="3" fill="var(--marca)"/><text x="${m.l + w(l.pct_pessoas) + 6}" y="${y0 + 16}">${P(l.pct_pessoas)}</text>`;
    s += `<rect x="${m.l}" y="${y0 + 21}" width="${w(l.pct_conversas)}" height="13" rx="3" fill="var(--laranja)"/><text x="${m.l + w(l.pct_conversas) + 6}" y="${y0 + 32}">${P(l.pct_conversas)}</text>`;
  });
  return s + "</svg>";
}

function nomeEfeito(e) {
  if (["tema", "dispositivo", "faixa_horaria"].includes(e.fator)) return rot(e.nivel);
  if (e.fator === "idioma") return e.nivel === "outro" ? T("Conversa em outro idioma") : e.nivel === "inglês" ? T("Conversa em inglês") : T("Conversa em português");
  return ({
    gpt4: T("1ª conversa com GPT-4"), resposta_longa: T("Resposta média ≥ 1.200 caracteres (mediana)"), msg_curta: T("1ª mensagem com < 10 caracteres"),
    recusa_1a: T("Recusa ou limitação na 1ª resposta"), fim_de_semana: T("Começou no fim de semana"),
    turnos_exp1: T("Turnos no 1º dia (≥ 5)"), varios_temas: T("Mais de um tema no 1º dia"),
  })[e.fator] || e.rotulo;
}

// ---------- filtros (só na tela Explorar) ----------
function lerFiltros(qs) {
  const f = {};
  ["inicio", "fim", "idioma", "dispositivo", "tema", "modelo"].forEach((k) => { const v = qs.get(k); if (v) f[k] = v; });
  return f;
}
function desenharFiltros(op, f) {
  const el = $("#filtros");
  const sel = (d) => `<label>${dim(d)}<select data-f="${d}"><option value="">${T("Todos")}</option>${op[d].map((v) => `<option value="${esc(v)}" ${f[d] === v ? "selected" : ""}>${esc(rot(v))}</option>`).join("")}</select></label>`;
  const qtd = Object.keys(f).length;
  el.innerHTML = `
    <label>${T("1º uso a partir de")}<input type="date" data-f="inicio" min="${op.inicio}" max="${op.fim}" value="${f.inicio || op.inicio}"></label>
    <label>${T("até")}<input type="date" data-f="fim" min="${op.inicio}" max="${op.fim}" value="${f.fim || op.fim}"></label>
    ${sel("idioma")}${sel("dispositivo")}${sel("tema")}${sel("modelo")}
    <button type="button" data-limpar>${T("Limpar")}</button>
    <span class="ativos">${qtd === 0 ? T("Sem filtros: toda a base") : qtd === 1 ? T("1 filtro ativo") : T("{n} filtros ativos", { n: qtd })}</span>`;
  el.hidden = false;
  el.querySelectorAll("[data-f]").forEach((c) => c.addEventListener("change", () => {
    const novo = { ...f };
    const v = c.value;
    if (!v || (c.dataset.f === "inicio" && v === op.inicio) || (c.dataset.f === "fim" && v === op.fim)) delete novo[c.dataset.f];
    else novo[c.dataset.f] = v;
    location.hash = "explorar" + (Object.keys(novo).length ? "?" + new URLSearchParams(novo) : "");
  }));
  $("[data-limpar]", el).addEventListener("click", () => { location.hash = "explorar"; });
}

// ---------- tela Explorar ----------
async function paginaExplorar(el, qs) {
  const f = lerFiltros(qs);
  const [d, resposta] = await Promise.all([api("/api/explorar?" + new URLSearchParams({ ...f, lang: LINGUA })), api("/api/analise")]);
  desenharFiltros(d.opcoes, f);
  const r = d.recorte, b = d.base;
  const comMes = d.serie.some((s) => s.suficiente);
  const ampliar = T("amplie o recorte para ver o número");
  el.innerHTML = `
    <h1>${T("Explorar")}</h1>
    <p class="pergunta">${T("Escolha um recorte nos filtros acima e veja quantas pessoas voltaram a usar o assistente em até 7 dias, como isso evoluiu e quais grupos voltam mais ou menos. Todos os números abaixo da faixa-resumo mudam com os filtros.")}</p>
    ${faixaResposta(resposta)}
    <div class="frases"><h2>${T("O que este recorte mostra")}</h2><ul>${d.frases.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <p class="nota">${T("Frases geradas por regras fixas: uma diferença só é chamada de “confirmada” quando é maior que a margem de erro (com 99% de confiança). São comparações simples; para o efeito comparando pessoas parecidas, veja <a href=\"#resposta\">A resposta</a>.")}</p></div>
    <div class="grade g4">
      ${kpi(T("Voltaram em até 7 dias"), r.suficiente ? P(r.retorno_pct) : "—", r.suficiente ? `${T("margem de erro:")} ${FAIXA(r.ic_lo, r.ic_hi)}` : ampliar, "destaque")}
      ${kpi(T("Pessoas no recorte"), r.suficiente ? N(r.n) : T("menos de {n}", { n: d.n_min }), T("usaram o assistente pela 1ª vez no período"))}
      ${kpi(T("Voltaram"), r.suficiente ? N(r.voltaram) : "—", r.suficiente ? T("usaram de novo em outro dia, em até 7 dias") : ampliar)}
      ${kpi(T("Toda a base"), P(b.retorno_pct), T("{n} pessoas, sem filtro", { n: N(b.n) }))}
    </div>
    <div class="grade g21">
      <div class="cartao"><h2>${T("Retorno mês a mês")}</h2>
        <p class="ajuda">${T("Cada ponto: das pessoas que começaram naquele mês, quantas voltaram.")} ${MARGEM()} ${T("Meses com menos de {n} pessoas ficam sem ponto.", { n: d.n_min })}</p>
        ${!d.serie.length ? `<p class="estado">${T("Sem pessoas neste recorte.")}</p>` : comMes ? graficoLinha(d.serie, r.suficiente ? r.retorno_pct : null, d.n_min) : `<p class="estado">${T("Nenhum mês tem {n} pessoas ou mais neste recorte. Amplie o período ou retire algum filtro para ver a evolução.", { n: d.n_min })}</p>`}
        <div class="legenda" ${comMes ? "" : "hidden"}><span><i style="background:var(--marca)"></i>${T("retorno do mês")}</span><span><i class="faixa"></i>${T("margem de erro")}</span><span><i class="linha"></i>${T("média do recorte")}</span></div>
        ${explicacao(T("Para cada mês, contamos quem usou o assistente pela primeira vez naquele mês e quantas dessas pessoas voltaram a usar em outro dia, em até 7 dias."), T("Retorno = pessoas com uso entre D+1 e D+7 (dia local de São Paulo) ÷ pessoas novas; margem de erro = intervalo de confiança de 95% de Wilson, calculado no banco."), { [T("Retorno por mês")]: d.sql["Retorno por mês"] })}
      </div>
      <div class="cartao"><h2>${T("Pessoas novas por mês")}</h2>
        <p class="ajuda">${T("Quantas pessoas usaram o assistente pela primeira vez, mês a mês, neste recorte.")}</p>
        ${comMes ? graficoColunas(d.serie, d.n_min) : `<p class="estado">${T("Nenhum mês tem {n} pessoas ou mais neste recorte.", { n: d.n_min })}</p>`}
      </div>
    </div>
    <div class="grade g3">
      ${["dispositivo", "idioma", "modelo"].map((x) => cartaoGrupo(d, x)).join("")}
    </div>
    <div class="grade g2">
      ${cartaoGrupo(d, "tema", comoClassificamos())}
      <div class="cartao"><h2>${T("Com que tema as pessoas chegam")}</h2>
        <p class="ajuda">${T("<b style=\"color:var(--marca)\">Roxo:</b> % das pessoas, pelo tema da 1ª conversa. <b style=\"color:var(--laranja)\">Laranja:</b> % de todas as conversas dessas pessoas (quem usa muito pesa mais).")}</p>
        ${graficoChegada(d.chegada)}
        ${explicacao(comoClassificamos().simples, comoClassificamos().tecnico, { [T("Com que tema chegam")]: d.sql["Com que tema chegam"] })}
      </div>
    </div>`;
  return d.procedencia;
}
function cartaoGrupo(d, x, classificacao) {
  const filtrado = d.filtros[x];
  return `<div class="cartao"><h2>${T("Quem volta mais? Por {dim}", { dim: dimMinuscula(x) })}</h2>
    <p class="ajuda">${filtrado ? T("Filtrado em “{v}”.", { v: esc(rot(filtrado)) }) + " " : ""}${T("A barra é o retorno de cada grupo; a linha fina é a margem de erro; a linha tracejada é a média do recorte.")}</p>
    ${graficoBarras(d.grupos[x], d.recorte.suficiente ? d.recorte.retorno_pct : null, d.n_min, x === "tema" ? 760 : 420)}
    ${explicacao(classificacao ? classificacao.simples : T("Mesma conta do retorno, separada por grupo. Grupos com menos de 30 pessoas aparecem como “poucas pessoas”, sem número."), classificacao ? classificacao.tecnico : T("Comparação simples (não leva em conta outras diferenças entre os grupos). Margem de erro = IC de 95% de Wilson."), { [T("Por grupo (exemplo: por tema; as outras dimensões trocam só a coluna agrupada)")]: d.sql["Por grupo"] })}
  </div>`;
}

// ---------- A resposta: linguagem de negócio ("de cada 100 pessoas") ----------
const C100 = (v) => n0.format(Math.round(v));                       // 18,4% -> "18" de cada 100
const QTD100 = (pp) => (pp < 0 ? T("{n} a menos em cada 100", { n: C100(Math.abs(pp)) }) : T("{n} a mais em cada 100", { n: C100(Math.abs(pp)) }));
const ENTRE100 = (lo, hi) => {
  const a = Math.round(Math.min(Math.abs(lo), Math.abs(hi))), b = Math.round(Math.max(Math.abs(lo), Math.abs(hi)));
  return lo < 0 && hi > 0 ? T("algo entre {a} a menos e {b} a mais", { a: Math.round(Math.abs(lo)), b: Math.round(hi) }) : T("algo entre {a} e {b}", { a: Math.max(1, a), b });
};
const SINAL = (v) => { const r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + n0.format(Math.abs(r)); };
const SINAL1 = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + n1.format(Math.abs(v));
const LIMITE = (v) => (Math.round(v) === 0 && v !== 0 ? SINAL1(v) : SINAL(v));  // −0,5 não vira "0"
const comprovado = (e) => e.ajustado_lo > 0 || e.ajustado_hi < 0;
const CONSIDERANDO = () => T("mesmo considerando idioma, aparelho, horário, tema e época");
const COR = { afasta: "var(--ruim)", aproxima: "var(--bom)", medida: "var(--atencao)", neutro: "var(--neutro)" };
const legenda = (k) => ({ afasta: T("afasta"), aproxima: T("aproxima"), medida: T("efeito da forma de medir"), neutro: T("não faz diferença comprovada") })[k];
function grupoEfeito(e) {
  if (!comprovado(e)) return "neutro";
  if (e.fator === "faixa_horaria") return "medida";
  return e.ajustado_pp < 0 ? "afasta" : "aproxima";
}

// Barras simples "voltam de cada 100" em HTML, com a margem de erro: se adaptam à largura (celular incluído).
function barras100(itens, max = 30) {
  const pos = (v) => (100 * Math.min(Math.max(v, 0), max)) / max;
  return `<div class="b100" role="img" aria-label="${T("Voltam de cada 100 pessoas")}">${itens.map((it) => `
    <span class="nome">${esc(it.nome)}</span>
    <span class="barra" tabindex="0" data-dica="${esc(`<b>${esc(it.nome)}</b><br>` + T("Voltam {n} de cada 100", { n: C100(it.valor) }) + (it.lo != null ? `<br>${T("margem de erro:")} ${T("entre {a} e {b}", { a: C100(it.lo), b: C100(it.hi) })}` : ""))}"><i style="width:${pos(it.valor)}%;background:${it.cor || "var(--marca)"}"></i>${it.lo != null ? `<s style="left:${pos(it.lo)}%;width:${pos(it.hi) - pos(it.lo)}%"></s>` : ""}</span>
    <b>${C100(it.valor)}</b>`).join("")}</div>`;
}

// O que mais pesa: cada efeito com a margem de erro (ponto e linha), ordenado pelo tamanho.
function graficoPeso(itens) {
  const W = 760, lh = 34, m = { l: 230, r: 120, t: 28, b: 28 };
  const H = m.t + m.b + lh * itens.length;
  const a = Math.floor(Math.min(-5, ...itens.map((e) => e.ajustado_lo)) / 5) * 5, b = Math.ceil(Math.max(5, ...itens.map((e) => e.ajustado_hi)) / 5) * 5;
  const x = (v) => m.l + ((v - a) / (b - a)) * (W - m.l - m.r);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("O que mais pesa no retorno")}">`;
  for (let v = a; v <= b; v += 5) s += `<line class="grade" x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${H - m.b}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle">${SINAL(v)}</text>`;
  s += `<line x1="${x(0)}" x2="${x(0)}" y1="${m.t - 6}" y2="${H - m.b}" stroke="var(--texto)" stroke-width="1.2"/>`;
  s += `<text x="${x(0) - 8}" y="${m.t - 12}" text-anchor="end">${T("← voltam menos")}</text><text x="${x(0) + 8}" y="${m.t - 12}">${T("voltam mais →")}</text>`;
  itens.forEach((e, i) => {
    const yc = m.t + i * lh + lh / 2, g = grupoEfeito(e), cor = COR[g];
    s += `<text class="rot" x="${m.l - 10}" y="${yc + 4}" text-anchor="end">${esc(nomeEfeito(e))}</text>`;
    s += `<line x1="${x(e.ajustado_lo)}" x2="${x(e.ajustado_hi)}" y1="${yc}" y2="${yc}" stroke="${cor}" stroke-width="4" stroke-linecap="round" opacity=".4"/>`;
    s += `<circle cx="${x(e.ajustado_pp)}" cy="${yc}" r="6.5" fill="${cor}" stroke="var(--cartao)" stroke-width="1.5"/>`;
    s += `<text x="${W - m.r + 12}" y="${yc + 4}" style="fill:var(--texto);font-weight:600">${g === "neutro" ? "≈ 0" : SINAL(e.ajustado_pp)}</text><text x="${W - m.r + 52}" y="${yc + 4}">${T("{a} a {b}", { a: LIMITE(e.ajustado_lo), b: LIMITE(e.ajustado_hi) })}</text>`;
    const txt = `<b>${esc(nomeEfeito(e))}</b><br>${g === "neutro" ? T("Não faz diferença comprovada") : QTD100(e.ajustado_pp)}, ${CONSIDERANDO()}.<br>${T("Margem de erro:")} ${ENTRE100(e.ajustado_lo, e.ajustado_hi)} ${T("em cada 100")}.<br>`
      + T("Voltam {n} de cada 100 ({p} pessoas); comparação: {ref}, {r}.", { n: C100(e.retorno_pct), p: N(e.n), ref: esc(rot(e.referencia)), r: C100(e.retorno_ref_pct) });
    s += `<rect class="alvo" tabindex="0" x="0" y="${yc - lh / 2}" width="${W}" height="${lh}" aria-label="${esc(nomeEfeito(e))}: ${SINAL(e.ajustado_pp)}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

// Quanto da diferença vinha do perfil: a diferença que se vê (círculo vazio) e a que sobra comparando pessoas parecidas (cheio).
function parteDoPerfil(e) {
  if (Math.abs(e.bruto_pp) < 2) return T("não há diferença para explicar");
  const parte = (e.bruto_pp - e.ajustado_pp) / e.bruto_pp;
  if (parte <= 0.15) return T("quase nada vinha do perfil");
  if (parte < 0.4) return T("uma parte menor vinha do perfil");
  if (parte < 0.6) return T("cerca de metade vinha do perfil");
  if (parte < 0.85) return T("a maior parte vinha do perfil");
  return T("quase tudo vinha do perfil");
}
function graficoPerfil(itens) {
  const W = 1150, lh = 32, m = { l: 330, r: 290, t: 10, b: 28 };
  const H = m.t + m.b + lh * itens.length;
  const ext = itens.flatMap((e) => [e.bruto_pp, e.ajustado_pp]);
  const a = Math.floor(Math.min(-5, ...ext) / 5) * 5, b = Math.ceil(Math.max(5, ...ext) / 5) * 5;
  const x = (v) => m.l + ((v - a) / (b - a)) * (W - m.l - m.r);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Quanto da diferença vinha do perfil de quem chega")}">`;
  for (let v = a; v <= b; v += 5) s += `<line class="grade" x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${H - m.b}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle">${SINAL(v)}</text>`;
  s += `<line x1="${x(0)}" x2="${x(0)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--texto)" stroke-width="1.2"/>`;
  itens.forEach((e, i) => {
    const yc = m.t + i * lh + lh / 2, parte = parteDoPerfil(e);
    s += `<text class="rot" x="${m.l - 10}" y="${yc + 4}" text-anchor="end">${esc(nomeEfeito(e))}</text>`;
    s += `<line x1="${x(e.bruto_pp)}" x2="${x(e.ajustado_pp)}" y1="${yc}" y2="${yc}" stroke="var(--neutro)" stroke-width="2"/>`;
    s += `<circle cx="${x(e.bruto_pp)}" cy="${yc}" r="6" fill="var(--cartao)" stroke="var(--marca)" stroke-width="2"/>`;
    s += `<circle cx="${x(e.ajustado_pp)}" cy="${yc}" r="6" fill="var(--marca)"/>`;
    s += `<text x="${W - m.r + 12}" y="${yc + 4}">${parte}</text>`;
    const txt = `<b>${esc(nomeEfeito(e))}</b><br>${T("Comparando todo mundo:")} ${QTD100(e.bruto_pp)}.<br>${T("Comparando pessoas parecidas:")} ${QTD100(e.ajustado_pp)}.<br>${parte[0].toUpperCase() + parte.slice(1)}.`;
    s += `<rect class="alvo" tabindex="0" x="0" y="${yc - lh / 2}" width="${W}" height="${lh}" aria-label="${esc(nomeEfeito(e))}: ${parte}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

// Retorno semana a semana, com a faixa do acaso (onde a semana cairia só por sorte) e a semana analisada em destaque.
function graficoSemanas(coortes, media, destaque) {
  const W = 1100, H = 300, m = { l: 44, r: 16, t: 16, b: 30 };
  const ok = coortes.filter((c) => c.suficiente);
  const topo = Math.ceil(Math.max(30, ...ok.map((c) => Math.max(c.acaso_hi, c.retorno_pct))) / 10) * 10;
  const x = (i) => m.l + (i * (W - m.l - m.r)) / Math.max(1, coortes.length - 1);
  const y = (v) => m.t + (H - m.t - m.b) * (1 - Math.max(0, v) / topo);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Retorno semana a semana")}">`;
  for (let v = 0; v <= topo; v += passoEixo(topo)) s += `<line class="grade" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`;
  const idx = coortes.map((c, i) => [c, i]).filter(([c]) => c.suficiente);
  if (idx.length > 1) {
    const banda = idx.map(([c, i]) => `${x(i)},${y(c.acaso_hi)}`).concat(idx.slice().reverse().map(([c, i]) => `${x(i)},${y(c.acaso_lo)}`)).join(" ");
    s += `<polygon points="${banda}" fill="var(--fundo)" stroke="var(--linha)"/>`;
    s += `<polyline points="${idx.map(([c, i]) => `${x(i)},${y(c.retorno_pct)}`).join(" ")}" fill="none" stroke="var(--marca-clara)" stroke-width="1.5"/>`;
  }
  s += `<line class="media" x1="${m.l}" x2="${W - m.r}" y1="${y(media)}" y2="${y(media)}"/>`;
  coortes.forEach((c, i) => {
    const alvo = destaque && String(c.semana).slice(0, 10) === String(destaque).slice(0, 10);
    if (i % 6 === 0) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${DIA_MES_ANO(c.semana)}</text>`;
    if (c.suficiente) {
      const fora = c.retorno_pct < c.acaso_lo || c.retorno_pct > c.acaso_hi;
      s += `<circle cx="${x(i)}" cy="${y(c.retorno_pct)}" r="${alvo ? 7 : 4}" fill="${alvo ? "var(--ruim)" : fora ? "var(--atencao)" : "var(--marca)"}" stroke="var(--cartao)" stroke-width="1.5"/>`;
      if (alvo) s += `<text x="${x(i)}" y="${y(c.retorno_pct) + 22}" text-anchor="middle" style="fill:var(--ruim);font-weight:600">${DIA_MES(c.semana)}</text>`;
    }
    const txt = `<b>${T("Semana de {d}", { d: DATA(c.semana) })}</b><br>` + (c.suficiente ? T("{n} pessoas chegaram · {k} voltaram", { n: N(c.novos), k: N(c.voltaram) }) + `<br>${T("Retorno:")} <b>${P(c.retorno_pct)}</b><br>${T("Faixa do acaso:")} ${FAIXA(Math.max(0, c.acaso_lo), c.acaso_hi)}` : POUCAS(30));
    s += `<rect class="alvo" tabindex="0" x="${x(i) - 8}" y="${m.t}" width="16" height="${H - m.t - m.b}" aria-label="${T("Semana de {d}", { d: DATA(c.semana) })}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

const achados = () => [
  { id: "chegada", titulo: T("Quem chega só testando ou pedindo imagem quase não volta"),
    decisao: T("Mudar a primeira resposta para quem só está testando (mostrar exemplos do que o assistente faz bem) e, para quem pede imagem, oferecer uma alternativa útil em vez de só dizer “não consigo”. Validar com um teste A/B.") },
  { id: "gpt4", titulo: T("Usar GPT-4 não faz as pessoas voltarem mais"),
    decisao: T("Não pagar por um modelo mais caro esperando reter mais gente. O investimento rende mais na primeira experiência.") },
  { id: "celular", titulo: T("Quem usa pelo celular volta menos"),
    decisao: T("Revisar a experiência no celular (velocidade, teclado, respostas longas demais para a tela) e testar uma versão melhorada em A/B.") },
];
const segmento = (k) => ({ chegada: T("Pedido real × só testa ou pede imagem"), dispositivo: T("Computador × celular"), gpt4: T("GPT-4 × GPT-3.5") })[k] || k;

// Leitura comum às duas telas: os efeitos válidos e os grupos de cada achado.
function lerResposta(d) {
  const ef = d.efeitos.filter((e) => e.natureza !== "mediador" && e.suficiente && e.ajustado_pp != null);
  const pega = (nivel, fator) => ef.find((e) => e.nivel === nivel && (!fator || e.fator === fator));
  const grupo = (achado, g) => d.achados.find((a) => a.achado === achado && a.grupo === g) || {};
  const afasta = ef.filter((e) => grupoEfeito(e) === "afasta").sort((a, b) => a.ajustado_pp - b.ajustado_pp);
  return { ef, pega, grupo, afasta };
}

// Faixa-resumo no topo do Explorar: a resposta da base inteira, que não muda com os filtros.
function faixaResposta(d) {
  const { pega, afasta } = lerResposta(d);
  const gpt4 = pega("True", "gpt4");
  return `<div class="resumo-resposta"><div class="titulo"><b>${T("A resposta, em resumo")}</b> <span>${T("(base inteira, não muda com os filtros)")}</span></div>
    <ul><li>${T("<b>{n} de cada 100</b> pessoas voltam em até 7 dias.", { n: C100(d.geral.retorno_pct) })}</li>
      <li>${T("<b>Afasta</b>, em cada 100:")} ${afasta.slice(0, 3).map((e) => `${esc(nomeEfeito(e))} <b>${SINAL(e.ajustado_pp)}</b>`).join(" · ")}.</li>
      ${gpt4 && !comprovado(gpt4) ? `<li>${T("Usar GPT-4 <b>não faz diferença comprovada</b>.")}</li>` : ""}</ul>
    <a href="#resposta">${T("Ver a resposta completa")}</a></div>`;
}

// ---------- tela A resposta ----------
async function paginaResposta(el) {
  $("#filtros").hidden = true;
  const d = await api("/api/analise");
  const g = d.geral;
  const { ef, pega, grupo } = lerResposta(d);
  const t = Object.fromEntries(d.testes.map((x) => [x.nome, x]));
  const teste = pega("saudacao_teste"), imagem = pega("imagem_midia"), gpt4 = pega("True", "gpt4"), celular = pega("celular");

  // "O que mais pesa": tudo o que tem efeito comprovado, mais o GPT-4 (a pergunta mais comum); o resto vira lista.
  const peso = ef.filter((e) => comprovado(e) || e.fator === "gpt4").sort((a, b) => Math.abs(b.ajustado_pp) - Math.abs(a.ajustado_pp));
  const neutros = ef.filter((e) => !peso.includes(e)).sort((a, b) => Math.abs(b.ajustado_pp) - Math.abs(a.ajustado_pp));
  const perfil = ef.filter((e) => Math.abs(e.bruto_pp) >= 5 || e.fator === "gpt4").sort((a, b) => Math.abs(b.bruto_pp) - Math.abs(a.bruto_pp));
  const ipw = d.gpt4.find((x) => x.metodo === "IPW");
  const smd = ipw ? (ipw.detalhe.match(/([\d.]+)\s*->\s*([\d.]+)/) || []).slice(1).map(Number) : [];
  const diag = t.modelo_efeitos;
  const diagnostico = (diag ? T("Diagnóstico do modelo: {n} pessoas; pseudo-R² = {r} (a primeira experiência explica pouco do retorno, o que é esperado com tão pouca informação por pessoa).", { n: N(diag.n), r: n0.format(Math.round(diag.valor * 1000) / 1000) }) : "")
    + (smd.length === 2 ? " " + T("No IPW, o maior desequilíbrio entre os grupos cai de {a} para {b} desvio-padrão.", { a: n1.format(smd[0]), b: n1.format(smd[1]) }) : "");
  const mesmoDia = (d.sensibilidade.find((s) => s.cenario.startsWith("regra anterior")) || { retorno_pct: 28 }).retorno_pct;

  const cardAchado = (a) => {
    let barras = "", efeito = "";
    const it = (nome, gr, cor) => ({ nome, valor: gr.retorno_pct, lo: gr.ic_lo, hi: gr.ic_hi, cor });
    if (a.id === "chegada") {
      barras = barras100([
        it(T("Só cumprimenta ou testa"), grupo("chegada", "saudacao_teste"), "var(--ruim)"),
        it(T("Pede imagem, vídeo ou áudio"), grupo("chegada", "imagem_midia"), "var(--ruim)"),
        it(T("Chega com um pedido real"), grupo("chegada", "pedido_real"), "var(--neutro)"),
      ]);
      efeito = T("Faz diferença: <b>{a}</b> e <b>{b}</b>, {considerando}. São {n} de cada 100 pessoas que chegam.", { a: QTD100(teste.ajustado_pp), b: QTD100(imagem.ajustado_pp), considerando: CONSIDERANDO(), n: C100(100 * (teste.n + imagem.n) / g.usuarios) });
    } else if (a.id === "gpt4") {
      barras = barras100([it(T("1ª conversa com GPT-4"), grupo("modelo", "GPT-4")), it(T("1ª conversa com GPT-3.5"), grupo("modelo", "GPT-3.5"), "var(--marca-clara)")]);
      efeito = T("Não faz diferença comprovada, {considerando} ({faixa} em cada 100). E não é porque “quem escolhe GPT-4 já é mais fiel”: medimos isso também (abaixo).", { considerando: CONSIDERANDO(), faixa: ENTRE100(gpt4.ajustado_lo, gpt4.ajustado_hi) });
    } else {
      barras = barras100([it(T("Celular"), grupo("dispositivo", "celular"), "var(--ruim)"), it(T("Computador"), grupo("dispositivo", "computador"), "var(--neutro)")]);
      efeito = T("Faz diferença: <b>{a}</b> ({faixa}), {considerando}.", { a: QTD100(celular.ajustado_pp), faixa: ENTRE100(celular.ajustado_lo, celular.ajustado_hi), considerando: CONSIDERANDO() });
    }
    return `<div class="cartao achado"><h2>${a.titulo}</h2><p class="ajuda">${T("Voltaram em até 7 dias, de cada 100 pessoas (a linha fina é a margem de erro):")}</p>${barras}
      <p>${efeito}</p><div class="decisao"><b>${T("O que fazer:")}</b> ${a.decisao}</div></div>`;
  };

  const regime = d.gpt4.filter((x) => x.metodo !== "IPW");
  const sw = d.semana;
  const real = sw ? sw.grupos.find((s) => s.segmento === "chegada" && s.grupo === "pedido real" && s.suficiente) : null;
  const med = d.efeitos.filter((e) => e.natureza === "mediador" && e.suficiente);
  const turnos = med.find((e) => e.fator === "turnos_exp1"), temas = med.find((e) => e.fator === "varios_temas");
  const homog = t.homogeneidade_semanas ? n1.format(t.homogeneidade_semanas.p) : null;

  el.innerHTML = `
    <h1>${T("A resposta")}</h1>
    <p class="pergunta">${T("O que faz uma pessoa que experimentou o assistente voltar em até 7 dias, quanto pesa cada fator e quanto disso vinha do perfil de quem chega. Base: <b>{n} pessoas</b> que usaram o assistente pela primeira vez.", { n: N(g.usuarios) })}</p>

    <div class="grade g13">
      <div class="cartao kpi destaque"><div class="rotulo">${T("Voltam em até 7 dias")}</div><div class="valor">${T("{n} de cada 100", { n: C100(g.retorno_pct) })}</div><div class="det">${T("margem de erro: entre {a} e {b} · {n} pessoas", { a: C100(g.ic_lo), b: C100(g.ic_hi), n: N(g.usuarios) })}</div>
        <p class="det" style="margin-top:14px">${T("Voltar = usar de novo em outro dia, até 7 dias depois do primeiro uso. Se voltar no mesmo dia contasse, seriam {n} de cada 100.", { n: C100(mesmoDia) })}</p></div>
      <div class="cartao"><h2>${T("O que mais pesa no retorno")}</h2>
        <p class="ajuda">${T("Quantas pessoas a mais ou a menos voltam, em cada 100, comparando pessoas parecidas em idioma, aparelho, horário, tema e época. A linha fina é a margem de erro: quando ela cruza o zero, não dá para afirmar que há diferença.")}</p>
        ${graficoPeso(peso)}
        <div class="legenda">${["afasta", "medida", "neutro"].concat(peso.some((e) => grupoEfeito(e) === "aproxima") ? ["aproxima"] : []).map((k) => `<span><i style="background:${COR[k]}"></i>${legenda(k)}</span>`).join("")}</div>
        <p class="ajuda" style="margin-top:10px">${T("<b>Começou à noite</b> é efeito da forma de medir: quem começa às 23h e continua depois da meia-noite já conta como “voltou outro dia”. Não é algo que o produto controle.")}</p>
        <p class="ajuda"><b>${T("Também sem diferença comprovada:")}</b> ${neutros.map((e) => esc(nomeEfeito(e))).join(" · ")}.</p>
        ${explicacao(T("Comparamos quem tem cada característica com quem não tem, mas entre pessoas parecidas em todo o resto. Assim, por exemplo, a diferença do celular não vem de quem usa celular pedir temas diferentes. A margem de erro mostra onde o efeito real deve estar; quando ela inclui o zero, não dá para afirmar que há diferença."),
          T("Regressão logística com todos os fatores e a época (regime de oferta do GPT-4) como controle; efeito marginal médio em pontos percentuais, intervalo de confiança de 95% pelo método delta, erros robustos (HC1). Turnos e número de temas no 1º dia ficam fora por serem consequência do engajamento (mediadores). Grupos com menos de 30 pessoas não aparecem.") + " " + diagnostico, { [T("Efeitos")]: d.sql.efeitos, [T("Diagnóstico")]: d.sql.testes })}
      </div>
    </div>

    <div class="cartao" style="margin-bottom:16px"><h2>${T("Quanto da diferença vinha do perfil de quem chega")}</h2>
      <p class="ajuda">${T("Círculo vazio: a diferença que se vê comparando todo mundo. Círculo cheio: a diferença que sobra comparando pessoas parecidas. O que some entre os dois vinha do perfil de quem chega, não do assistente.")}</p>
      ${graficoPerfil(perfil)}
      <div class="legenda"><span><i style="background:var(--cartao);border:2px solid var(--marca);border-radius:50%"></i>${T("comparando todo mundo")}</span><span><i style="background:var(--marca);border-radius:50%"></i>${T("comparando pessoas parecidas")}</span></div>
      <p class="achado-nota">${T("Ainda não está provado que mudar a primeira experiência fará as pessoas voltarem. Por isso, cada decisão vem com um teste A/B.")}</p>
      ${explicacao(T("A diferença “comparando todo mundo” mistura o efeito da característica com o perfil de quem a tem (tema, aparelho, idioma, horário e época). Comparando pessoas parecidas, sobra a parte que não se explica por esse perfil."), T("Círculo vazio: diferença bruta de proporções; círculo cheio: efeito marginal médio da regressão logística (o mesmo do gráfico acima). Parte que vinha do perfil = (bruto − ajustado) ÷ bruto."), { [T("Efeitos")]: d.sql.efeitos })}
    </div>

    <h2 class="secao">${T("Os três achados e o que fazer")}</h2>
    <div class="grade g3">${achados().map(cardAchado).join("")}</div>

    <div class="grade g2">
      <div class="cartao"><h2>${T("O GPT-4 faz diferença ou é quem escolhe?")}</h2>
        <p class="grande-frase">${T("Usar GPT-4 <b>não faz</b> as pessoas voltarem mais.")}</p>
        <p class="ajuda">${T("Uma dúvida comum: quem escolhe o GPT-4 talvez já seja mais engajado, e isso esconderia ou inflaria o efeito. Medimos de três jeitos, e nenhum mostra diferença comprovada:")}</p>
        <table><tr><th>${T("Forma de medir")}</th><th class="num">${T("Em cada 100 pessoas")}</th></tr>
          ${regime.map((x) => `<tr><td>${x.detalhe.startsWith("GPT-4 opcional") ? T("Quando a pessoa escolhia o GPT-4") : T("Quando o GPT-4 era o padrão para todos")}</td><td class="num">${ENTRE100(x.lo, x.hi)}</td></tr>`).join("")}
          ${ipw ? `<tr><td>${T("Comparando pessoas parecidas")}</td><td class="num">${ENTRE100(ipw.lo, ipw.hi)}</td></tr>` : ""}
        </table>
        <p class="ajuda" style="margin-top:10px">${T("Todas as faixas vão de “alguns a menos” a “alguns a mais”: o efeito pode ser zero. E, como escolher ou não o GPT-4 dá o mesmo resultado, não há sinal de que “quem escolhe já volta mais”.")}</p>
        ${explicacao(T("Se o efeito viesse de quem escolhe, ele apareceria quando o GPT-4 era opcional e sumiria quando todos usavam. Os dois resultados são iguais e próximos de zero."), T("Diferença de proporções por regime de oferta (abr–jun/23 e nov/23: opcional; dez/23–abr/24: ~90% das conversas) e ponderação pelo inverso do escore de propensão (IPW) com época, horário, dia, dispositivo, idioma, tamanho da 1ª mensagem e tema; intervalos de 95% (Newcombe e bootstrap).") + (smd.length === 2 ? " " + T("No IPW, o maior desequilíbrio entre os grupos cai de {a} para {b} desvio-padrão.", { a: n1.format(smd[0]), b: n1.format(smd[1]) }) : ""), { "GPT-4": d.sql.gpt4 })}
      </div>
      <div class="cartao"><h2>${sw ? T("A semana de {d}: por que o retorno caiu?", { d: DATA(sw.semana) }) : T("A semana analisada")}</h2>
        ${sw ? `<p class="ajuda">${T("Voltaram em até 7 dias, de cada 100 pessoas (a linha fina é a margem de erro):")}</p>
        ${barras100([{ nome: T("4 semanas anteriores"), valor: sw.retorno_antes_pct, lo: sw.antes_lo, hi: sw.antes_hi, cor: "var(--neutro)" }, { nome: T("Semana de {d}", { d: DIA_MES(sw.semana) }), valor: sw.retorno_semana_pct, lo: sw.semana_lo, hi: sw.semana_hi, cor: "var(--ruim)" }])}
        <p class="ajuda">${T("<b>A queda de {d} veio de quem chegou ou de como as pessoas voltaram?</b> Em pontos de cada 100:", { d: DIA_MES(sw.semana) })}</p>
        <table><tr><th>${T("Separando por")}</th><th class="num">${T("Mudança no perfil de quem chegou")}</th><th class="num">${T("Mudança no retorno dentro de cada perfil")}</th></tr>
          ${sw.segmentos.map((s) => `<tr><td>${esc(segmento(s.segmento))}</td><td class="num">${SINAL1(s.mix_pp)}</td><td class="num"><b>${SINAL1(s.taxa_pp)}</b></td></tr>`).join("")}</table>
        <p style="margin-top:10px">${real ? T("<b>Não mudou o tipo de pessoa que chegou</b>: {a} de cada 100 chegaram com um pedido real, contra {b} antes. <b>Mudou o retorno de quem chegou</b>: entre quem chegou com pedido real, {c} de cada 100 voltavam; nessa semana, {d}.", { a: C100(real.peso_semana_pct), b: C100(real.peso_antes_pct), c: C100(real.retorno_antes_pct), d: C100(real.retorno_semana_pct) }) : T("<b>Não mudou o tipo de pessoa que chegou. Mudou o retorno de quem chegou.</b>")}</p>
        <p class="achado-nota">${T("Mas atenção: chegam cerca de 45 pessoas por semana, e com tão pouca gente o número oscila bastante por acaso. Olhando todas as semanas juntas, <b>não há diferença comprovada entre elas</b> (gráfico abaixo). Para decidir, acompanhe a tendência de várias semanas, não uma semana isolada.")}</p>
        ${explicacao(T("Separamos a queda em duas partes: a que viria de chegarem mais pessoas de um tipo que volta menos (perfil) e a que vem de cada tipo voltar menos do que antes (retorno dentro de cada perfil). Quase toda a queda foi de retorno, não de perfil."), T("Decomposição de Kitagawa contra as 4 semanas anteriores.") + (t.semana_analisada ? " " + T("Diferença: {v} pp (IC 95% {lo} a {hi}; p = {p}).", { v: n1.format(t.semana_analisada.valor), lo: n1.format(t.semana_analisada.lo), hi: n1.format(t.semana_analisada.hi), p: n1.format(t.semana_analisada.p) }) : "") + (homog ? " " + T("Teste qui-quadrado de homogeneidade entre as semanas com 30 pessoas ou mais: p = {p}.", { p: homog }) : ""), { [T("Antes e na semana")]: d.sql.semana_total, [T("Decomposição")]: d.sql.semana_segmentos, [T("Testes")]: d.sql.testes })}` : `<p class="estado">${T("Sem semana analisada nesta carga.")}</p>`}
      </div>
    </div>

    <div class="cartao" style="margin-bottom:16px"><h2>${T("Retorno semana a semana")}</h2>
      <p class="ajuda">${T("Cada ponto é uma semana de chegada. A faixa cinza mostra quanto o número oscila só por acaso, com cerca de 45 pessoas por semana: um ponto dentro dela não indica mudança real.")} ${sw ? T("A semana de {d} está destacada.", { d: DATA(sw.semana) }) : ""} ${T("Semanas com menos de 30 pessoas ficam sem ponto.")}</p>
      ${graficoSemanas(d.coortes, g.retorno_pct, sw ? sw.semana : null)}
      <div class="legenda"><span><i style="background:var(--marca)"></i>${T("semana dentro da faixa do acaso")}</span><span><i style="background:var(--atencao)"></i>${T("fora da faixa")}</span>${sw ? `<span><i style="background:var(--ruim)"></i>${T("semana analisada")}</span>` : ""}<span><i class="faixa" style="background:var(--fundo);border-color:var(--linha)"></i>${T("faixa do acaso")}</span><span><i class="linha"></i>${T("média da base")}</span></div>
      ${explicacao(T("Se todas as semanas tivessem o mesmo retorno da base inteira ({n} de cada 100), 95 de cada 100 semanas cairiam dentro da faixa cinza só por sorte. Com cerca de 37 semanas, é normal uma ou duas ficarem fora.", { n: C100(g.retorno_pct) }), T("Faixa = p ± 1,96 × √(p(1−p)/n), com p = retorno da base inteira e n = pessoas da semana.") + (homog ? " " + T("Teste qui-quadrado de homogeneidade entre as semanas com 30 pessoas ou mais: p = {p} (não rejeita que todas tenham o mesmo retorno).", { p: homog }) : ""), { [T("Retorno por semana")]: d.sql.coortes })}
    </div>

    <div class="grade g2">
      <div class="cartao"><h2>${T("Sinais de engajamento: descrevem o retorno, não o explicam")}</h2>
        ${turnos && temas ? `<p>${T("Quem conversa 5 vezes ou mais no primeiro dia volta <b>{a} de cada 100</b> (contra {b} de quem conversa menos), e quem usa mais de um tema volta <b>{c}</b> (contra {d}).", { a: C100(turnos.retorno_pct), b: C100(turnos.retorno_ref_pct), c: C100(temas.retorno_pct), d: C100(temas.retorno_ref_pct) })}</p>` : ""}
        <p class="ajuda">${T("Isso é consequência de uma boa primeira experiência, não algo que o produto ligue diretamente. Por isso fica fora da comparação acima.")}</p>
      </div>
      <div class="cartao"><h2>${T("Insatisfação na primeira conversa")}</h2>
        ${t.insatisfacao ? `<p>${T("Entre quem mandou mais de uma mensagem, quem corrigiu, repetiu ou reclamou volta praticamente o mesmo que os demais: <b>{faixa} em cada 100</b>. A diferença pode ser acaso.", { faixa: ENTRE100(t.insatisfacao.lo, t.insatisfacao.hi) })}</p>` : ""}
        ${explicacao(T("Uma inteligência artificial marcou, nas conversas com mais de uma mensagem, quem corrigiu, repetiu ou reclamou da resposta. A marcação se repete em 93 de cada 100 casos quando refeita."), T("Mesmo modelo dos efeitos, só com quem mandou mais de uma mensagem ({n} pessoas); IC 95% pelo método delta; estabilidade da marcação: κ de Cohen = 0,93.", { n: t.insatisfacao ? N(t.insatisfacao.n) : "—" }), { [T("Testes")]: d.sql.testes })}
      </div>
    </div>

    <div class="grade g2">
      <div class="cartao"><h2>${T("O número muda conforme a forma de medir?")}</h2>
        <p class="ajuda">${T("Cada linha muda uma única regra de contagem. Quase nada muda, exceto contar quem volta <b>no mesmo dia</b>, que sobe bastante o número. Por isso deixamos claro qual regra usamos.")}</p>
        <div class="rolagem"><table><tr><th>${T("Regra")}</th><th class="num">${T("Voltam de cada 100")}</th><th class="num">${T("Margem de erro")}</th></tr>
        ${d.sensibilidade.map((s) => `<tr${s.cenario.startsWith("referência") ? ' class="ref"' : ""}><td>${esc(regra(s.cenario))}</td><td class="num">${C100(s.retorno_pct)}</td><td class="num">${esc(String(s.ic95 || "").replace(/(\d+[.,]\d)[–-](\d+[.,]\d)/, (_, a, b) => T("{a} a {b}", { a: C100(Number(a.replace(",", "."))), b: C100(Number(b.replace(",", "."))) })))}</td></tr>`).join("")}</table></div>
      </div>
      <div class="cartao"><h2>${T("Como sabemos o tema de cada conversa?")}</h2><p>${comoClassificamos().simples}</p>
        <details><summary>${T("Detalhe técnico")}</summary><div class="tecnico">${comoClassificamos().tecnico}</div></details>
        <h2 style="margin-top:18px">${T("O que isto prova e o que não prova")}</h2>
        <p>${T("<b>Prova</b> que quem chega só testando ou pedindo imagem volta muito menos, e que o modelo não muda o retorno, mesmo considerando idioma, aparelho, horário, tema e época. <b>Não prova</b> que mudar a primeira experiência fará essas pessoas voltarem: pode haver motivos que os dados não mostram (motivação, necessidade). Por isso cada decisão vem com um teste A/B.")}</p>
      </div>
    </div>`;
  return d.procedencia;
}

// ---------- Documentação: os documentos do repositório, sem sair do dashboard ----------
async function paginaDocumentacao(el, _qs, nome) {
  $("#filtros").hidden = true;
  const lista = await api("/api/documentos");
  const atual = lista.some((x) => x.nome === nome) ? nome : lista[0].nome;
  const doc = await api(`/api/documentos/${encodeURIComponent(atual)}`);
  const grupos = [...new Set(lista.map((x) => x.grupo))];
  el.innerHTML = `
    <h1>${T("Documentação")}</h1>
    <p class="pergunta">${T("As decisões, a análise passo a passo, os indicadores e a arquitetura, como estão no repositório.")}${LINGUA === "pt" ? "" : " " + T("Os documentos estão em português.")}</p>
    <div class="docs">
      <aside class="docs-indice" aria-label="${T("Documentos")}">${grupos.map((g) => `<h3>${esc(T(g))}</h3><ul>${lista.filter((x) => x.grupo === g).map((x) => `<li><a href="#documentacao/${x.nome}" ${x.nome === atual ? 'aria-current="page"' : ""}>${esc(T(x.titulo))}</a></li>`).join("")}</ul>`).join("")}</aside>
      <article class="cartao doc" lang="pt-BR">${doc.html}</article>
    </div>`;
  window.scrollTo(0, 0);
  return null;
}
const PAGINAS = { resposta: paginaResposta, explorar: paginaExplorar, documentacao: paginaDocumentacao };

function rodape(p) {
  if (!p) { $("#rodape").innerHTML = ""; return; }
  $("#rodape").innerHTML = `<b>${T("Fonte:")}</b> ${T("WildChat-1M (allenai), conversas com country = 'Brazil'")} · ${T("{a} conversas do Brasil, de {b} na base", { a: N(p.linhas_brasil), b: N(p.linhas_fonte) })} ·
    <b>${T("Atualizado em")}</b> ${new Date(p.carga_em).toLocaleString(LOCAIS[LINGUA])} (${T("versão")} ${esc(p.versao_codigo)}) ·
    ${p.reconciliacao_ok ? T("números conferidos contra a base bruta ✓") : `<b>${T("ATENÇÃO: a conferência contra a base bruta falhou")}</b>`}<br>
    <b>${T("Definição:")}</b> ${T("Voltou = usou o assistente em outro dia (horário de São Paulo), entre o 1º e o 7º dia depois do primeiro dia de uso. Pessoa = endereço de internet (IP), anonimizado.")} ${T("Nenhuma tela mostra texto de conversa, IP ou navegador, nem números de grupos com menos de 30 pessoas.")}`;
}

async function mostrar() {
  const [caminho, qs] = (location.hash.slice(1) || "resposta").split("?");
  const [bruta, sub] = caminho.split("/");
  const aba = bruta === "analise" ? "resposta" : bruta;  // endereço antigo da tela
  const pagina = PAGINAS[aba] ? aba : "resposta";
  document.querySelectorAll("nav a").forEach((a) => (a.dataset.aba === pagina ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const el = $("#conteudo");
  el.innerHTML = `<p class="estado">${T("Carregando…")}</p>`;
  try {
    rodape(await PAGINAS[pagina](el, new URLSearchParams(qs || ""), sub));
    ligarDicas(el);
  } catch (e) {
    el.innerHTML = `<p class="erro">${esc(e.message)}</p>`;
  }
}

async function iniciar() {
  try { TRADUCOES = await (await fetch("/static/i18n.json")).json(); } catch (e) { TRADUCOES = {}; }  // sem o arquivo, a tela fica em português
  document.querySelectorAll("[data-lingua]").forEach((b) => b.addEventListener("click", () => trocarLingua(b.dataset.lingua)));
  aplicarLingua();
  mostrar();
}

window.addEventListener("hashchange", mostrar);
iniciar();
