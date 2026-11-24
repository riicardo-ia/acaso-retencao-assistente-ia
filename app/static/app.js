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
let PREFERIDA = escolherLingua();  // a escolhida pela pessoa (lembrada no navegador)
let LINGUA = PREFERIDA;
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
  document.querySelectorAll("[data-t-placeholder]").forEach((el) => { el.placeholder = T(el.dataset.tPlaceholder); });
  document.querySelectorAll("[data-lingua]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lingua === LINGUA)));
}
function trocarLingua(nova) {
  PREFERIDA = nova;
  try { localStorage.setItem("lingua", nova); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
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
  simples: T("Uma inteligência artificial leu o que cada pessoa escreveu e escolheu o tema da conversa entre <b>11 opções definidas por nós</b>, sem poder inventar outra. Antes de usar, testamos se ela é confiável: repetindo a classificação, o tema foi o mesmo em <b>96% das conversas</b>."),
  tecnico: `<ul>
    <li>${T("<b>Rótulos predefinidos:</b> os 11 temas saíram dos próprios dados (agrupamento estatístico das conversas) e foram revisados manualmente.")}</li>
    <li>${T("<b>Classificação:</b> o modelo GPT-5.4 lê as mensagens do usuário e escolhe um dos 11 rótulos. Mensagens muito curtas (“oi”, “teste”) viram “só cumprimenta ou testa” sem passar pela IA.")}</li>
    <li>${T("<b>Validação com teste de hipóteses:</b> estabilidade entre duas classificações independentes (κ de Cohen = 0,95; a hipótese de baixa concordância foi rejeitada) e 5 de 5 comportamentos previstos confirmados (por exemplo, pedidos de imagem recebem mais recusas; qui-quadrado, p &lt; 0,001).")}</li>
    <li>${T("<b>Revisão manual:</b> onde dois modelos discordaram, revisamos os padrões e escolhemos o mais coerente.")}</li>
  </ul>`,
});

let ULTIMO_PEDIDO = "";  // código do pedido (request_id): o mesmo que aparece no log do servidor
async function api(rota) {
  const r = await fetch(rota);
  ULTIMO_PEDIDO = r.headers.get("x-request-id") || "";
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
  const d = await api("/api/explorar?" + new URLSearchParams({ ...f, lang: LINGUA }));
  desenharFiltros(d.opcoes, f);
  const r = d.recorte, b = d.base;
  const comMes = d.serie.some((s) => s.suficiente);
  const ampliar = T("amplie o recorte para ver o número");
  el.innerHTML = `
    <h1>${T("Explorar")}</h1>
    <p class="pergunta">${T("Escolha um recorte nos filtros acima e veja quantas pessoas voltaram a usar o assistente em até 7 dias, como isso evoluiu e quais grupos voltam mais ou menos. Todos os números mudam com os filtros.")}</p>
    <div class="frases" id="recorte"><h2>${T("O que este recorte mostra")}</h2><ul>${d.frases.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <p class="nota">${T("Frases geradas por regras fixas: uma diferença só é chamada de “confirmada” quando é maior que a margem de erro (com 99% de confiança). São comparações simples; para o efeito comparando pessoas parecidas, veja <a href=\"#resposta\">A resposta</a>.")}</p></div>
    <div class="grade g4">
      ${kpi(T("Voltaram em até 7 dias"), r.suficiente ? P(r.retorno_pct) : "—", r.suficiente ? `${T("margem de erro:")} ${FAIXA(r.ic_lo, r.ic_hi)}` : ampliar, "destaque")}
      ${kpi(T("Pessoas no recorte"), r.suficiente ? N(r.n) : T("menos de {n}", { n: d.n_min }), T("usaram o assistente pela 1ª vez no período"))}
      ${kpi(T("Voltaram"), r.suficiente ? N(r.voltaram) : "—", r.suficiente ? T("usaram de novo em outro dia, em até 7 dias") : ampliar)}
      ${kpi(T("Toda a base"), P(b.retorno_pct), T("{n} pessoas, sem filtro", { n: N(b.n) }))}
    </div>
    <div class="grade g21">
      <div class="cartao" id="retorno-mes"><h2>${T("Retorno mês a mês")}</h2>
        <p class="ajuda">${T("Cada ponto: das pessoas que começaram naquele mês, quantas voltaram.")} ${MARGEM()} ${T("Meses com menos de {n} pessoas ficam sem ponto.", { n: d.n_min })}</p>
        ${!d.serie.length ? `<p class="estado">${T("Sem pessoas neste recorte.")}</p>` : comMes ? graficoLinha(d.serie, r.suficiente ? r.retorno_pct : null, d.n_min) : `<p class="estado">${T("Nenhum mês tem {n} pessoas ou mais neste recorte. Amplie o período ou retire algum filtro para ver a evolução.", { n: d.n_min })}</p>`}
        <div class="legenda" ${comMes ? "" : "hidden"}><span><i style="background:var(--marca)"></i>${T("retorno do mês")}</span><span><i class="faixa"></i>${T("margem de erro")}</span><span><i class="linha"></i>${T("média do recorte")}</span></div>
        ${explicacao(T("Para cada mês, contamos quem usou o assistente pela primeira vez naquele mês e quantas dessas pessoas voltaram a usar em outro dia, em até 7 dias."), T("Retorno = pessoas com uso entre D+1 e D+7 (dia local de São Paulo) ÷ pessoas novas; margem de erro = intervalo de confiança de 95% de Wilson, calculado no banco."), { [T("Retorno por mês")]: d.sql["Retorno por mês"] })}
      </div>
      <div class="cartao" id="novas-mes"><h2>${T("Pessoas novas por mês")}</h2>
        <p class="ajuda">${T("Quantas pessoas usaram o assistente pela primeira vez, mês a mês, neste recorte.")}</p>
        ${comMes ? graficoColunas(d.serie, d.n_min) : `<p class="estado">${T("Nenhum mês tem {n} pessoas ou mais neste recorte.", { n: d.n_min })}</p>`}
      </div>
    </div>
    <div class="grade g3">
      ${["dispositivo", "idioma", "modelo"].map((x) => cartaoGrupo(d, x)).join("")}
    </div>
    <div class="grade g2">
      ${cartaoGrupo(d, "tema", comoClassificamos())}
      <div class="cartao" id="chegada"><h2>${T("Com que tema as pessoas chegam")}</h2>
        <p class="ajuda">${T("<b style=\"color:var(--marca)\">Roxo:</b> % das pessoas, pelo tema da 1ª conversa. <b style=\"color:var(--laranja)\">Laranja:</b> % de todas as conversas dessas pessoas (quem usa muito pesa mais).")}</p>
        ${graficoChegada(d.chegada)}
        ${explicacao(comoClassificamos().simples, comoClassificamos().tecnico, { [T("Com que tema chegam")]: d.sql["Com que tema chegam"] })}
      </div>
    </div>`;
  return d.procedencia;
}
function cartaoGrupo(d, x, classificacao) {
  const filtrado = d.filtros[x];
  return `<div class="cartao" id="grupo-${x}"><h2>${T("Quem volta mais? Por {dim}", { dim: dimMinuscula(x) })}</h2>
    <p class="ajuda">${filtrado ? T("Filtrado em “{v}”.", { v: esc(rot(filtrado)) }) + " " : ""}${T("A barra é o retorno de cada grupo; a linha fina é a margem de erro; a linha tracejada é a média do recorte.")}</p>
    ${graficoBarras(d.grupos[x], d.recorte.suficiente ? d.recorte.retorno_pct : null, d.n_min, x === "tema" ? 760 : 420)}
    ${explicacao(classificacao ? classificacao.simples : T("Mesma conta do retorno, separada por grupo. Grupos com menos de 30 pessoas aparecem como “poucas pessoas”, sem número."), classificacao ? classificacao.tecnico : T("Comparação simples (não leva em conta outras diferenças entre os grupos). Margem de erro = IC de 95% de Wilson."), { [T("Por grupo (exemplo: por tema; as outras dimensões trocam só a coluna agrupada)")]: d.sql["Por grupo"] })}
  </div>`;
}

// ---------- A resposta: retornos em %, diferenças em pontos percentuais (p.p.) ----------
const SINAL = (v) => { const r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + n0.format(Math.abs(r)); };  // marcas do eixo
const SINAL1 = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + n1.format(Math.abs(v));
const DIF = (pp) => T("{v} pontos percentuais", { v: SINAL1(pp) });
const DIF_FAIXA = (lo, hi) => T("entre {a} e {b} pontos percentuais", { a: SINAL1(lo), b: SINAL1(hi) });
const comprovado = (e) => e.ajustado_lo > 0 || e.ajustado_hi < 0;
const CONSIDERANDO = () => T("mesmo considerando idioma, aparelho, horário, tema e época");
const COR = { afasta: "var(--ruim)", aproxima: "var(--bom)", medida: "var(--atencao)", neutro: "var(--neutro)" };
const legenda = (k) => ({ afasta: T("volta menos"), aproxima: T("volta mais"), medida: T("efeito da forma de medir"), neutro: T("não muda") })[k];
function grupoEfeito(e) {
  if (!comprovado(e)) return "neutro";
  if (e.fator === "faixa_horaria") return "medida";
  return e.ajustado_pp < 0 ? "afasta" : "aproxima";
}

// Barras simples do retorno em %, com a margem de erro: se adaptam à largura (celular incluído).
function barras100(itens, max = 30) {
  const pos = (v) => (100 * Math.min(Math.max(v, 0), max)) / max;
  return `<div class="b100" role="img" aria-label="${T("Retorno em até 7 dias, em %")}">${itens.map((it) => `
    <span class="nome">${esc(it.nome)}</span>
    <span class="barra" tabindex="0" data-dica="${esc(`<b>${esc(it.nome)}</b><br>` + T("Voltaram: {n}", { n: P(it.valor) }) + (it.lo != null ? `<br>${T("margem de erro:")} ${FAIXA(it.lo, it.hi)}` : ""))}"><i style="width:${pos(it.valor)}%;background:${it.cor || "var(--marca)"}"></i>${it.lo != null ? `<s style="left:${pos(it.lo)}%;width:${pos(it.hi) - pos(it.lo)}%"></s>` : ""}</span>
    <b>${P(it.valor)}</b>`).join("")}</div>`;
}

// Diferença em pontos percentuais, em palavras: "15,6 a menos", "6,4 a mais".
const PONTOS = (v) => (Math.abs(v) < 0.5 ? T("quase zero") : v < 0 ? T("{v} a menos", { v: n1.format(-v) }) : T("{v} a mais", { v: n1.format(v) }));
// Com quem cada fator é comparado, em linguagem do dia a dia.
const refNome = (e) => ({
  tema: T("pergunta de conhecimento geral"), dispositivo: T("computador"), faixa_horaria: T("começou à tarde"), idioma: T("conversa em português"),
  gpt4: "GPT-3.5", resposta_longa: T("respostas mais curtas"), msg_curta: T("mensagens mais longas"), recusa_1a: T("sem recusa"), fim_de_semana: T("dia de semana"),
})[e.fator] || rot(e.referencia);

// Margem de erro de um percentual (IC 95% de Wilson), a partir do número de pessoas do grupo.
function wilson(pct, n) {
  const p = pct / 100, z = 1.96, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d, r = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return [100 * (c - r), 100 * (c + r)];
}

// Pergunta 2: o retorno de quem tem cada característica, com a margem de erro nas pontas e o valor medido no meio.
function graficoPeso(itens, W = 1100) {
  const lh = 50, m = { l: 300, r: 70, t: 34, b: 26 };
  const H = m.t + m.b + lh * itens.length;
  const faixas = itens.map((e) => wilson(e.retorno_pct, e.n));
  const topo = Math.ceil(Math.max(30, ...faixas.map((f) => f[1])) / 10) * 10;
  const x = (v) => m.l + (v / topo) * (W - m.l - m.r);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("O que mais pesa no retorno")}">`;
  s += `<text x="${m.l}" y="14" style="fill:var(--texto);font-weight:600">${T("Voltam em até 7 dias")}</text>`;
  for (let v = 0; v <= topo; v += 10) s += `<line class="grade" x1="${x(v)}" x2="${x(v)}" y1="${m.t - 8}" y2="${H - m.b}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle">${v}%</text>`;
  itens.forEach((e, i) => {
    const yc = m.t + i * lh + lh / 2 + 6, cor = COR[grupoEfeito(e)], [lo, hi] = faixas[i];
    s += `<text class="rot" x="${m.l - 14}" y="${yc + 4}" text-anchor="end">${esc(nomeEfeito(e))}</text>`;
    s += `<line x1="${x(lo)}" x2="${x(hi)}" y1="${yc}" y2="${yc}" stroke="${cor}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<line x1="${x(lo)}" x2="${x(lo)}" y1="${yc - 6}" y2="${yc + 6}" stroke="${cor}" stroke-width="2"/><line x1="${x(hi)}" x2="${x(hi)}" y1="${yc - 6}" y2="${yc + 6}" stroke="${cor}" stroke-width="2"/>`;
    s += `<circle cx="${x(e.retorno_pct)}" cy="${yc}" r="7" fill="${cor}" stroke="var(--cartao)" stroke-width="1.5"/>`;
    s += `<text x="${x(lo) - 8}" y="${yc + 4}" text-anchor="end">${P(lo)}</text><text x="${x(hi) + 8}" y="${yc + 4}">${P(hi)}</text>`;
    s += `<text x="${x(e.retorno_pct)}" y="${yc - 13}" text-anchor="middle" style="fill:var(--texto);font-weight:700">${P(e.retorno_pct)}</text>`;
    const txt = `<b>${esc(nomeEfeito(e))}</b><br>${T("Voltam {a}; pode variar de {b} a {c}.", { a: P(e.retorno_pct), b: P(lo), c: P(hi) })}`;
    s += `<rect class="alvo" tabindex="0" x="0" y="${yc - lh / 2}" width="${W}" height="${lh}" aria-label="${esc(nomeEfeito(e))}: ${P(e.retorno_pct)}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

// Pergunta 3: a mesma diferença medida de dois jeitos. Se continua comparando pessoas parecidas, é do próprio fator; se some, vinha do perfil.
const doPerfil = (e) => Math.min(1, Math.max(0, (e.bruto_pp - e.ajustado_pp) / e.bruto_pp));
function veredito(p) {
  if (p <= 0.15) return T("É do próprio fator");
  if (p < 0.4) return T("A maior parte é do fator");
  if (p < 0.6) return T("Metade era o perfil");
  if (p < 0.85) return T("A maior parte era o perfil");
  return T("Era o perfil de quem chega");
}
// Peso em %: o efeito comparando pessoas parecidas dividido pelo retorno do grupo de comparação ("volta 74% menos").
const rel = (e, v) => (100 * v) / e.retorno_ref_pct;
const VOLTA = (v) => (Math.abs(v) < 3 ? T("volta quase o mesmo") : v < 0 ? T("volta {v} menos", { v: n0.format(Math.round(-v)) + "%" }) : T("volta {v} mais", { v: n0.format(Math.round(v)) + "%" }));
function graficoCausa(itens) {
  const W = 1100, lh = 50, m = { l: 300, r: 60, t: 40, b: 26 };
  const H = m.t + m.b + lh * itens.length;
  const a = Math.floor(Math.min(0, ...itens.map((e) => rel(e, e.ajustado_lo))) / 25) * 25, b = Math.ceil(Math.max(0, ...itens.map((e) => rel(e, e.ajustado_hi))) / 25) * 25;
  const x = (v) => m.l + 50 + ((v - a) / (b - a)) * (W - m.l - 50 - m.r);
  const marca = (v) => (v === 0 ? T("sem peso") : v < 0 ? T("{v} menos", { v: -v + "%" }) : T("{v} mais", { v: v + "%" }));
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Quanto pesa cada um e quanto disso é causa e não seleção?")}">`;
  s += `<text x="${m.l}" y="14" style="fill:var(--texto);font-weight:600">${T("Peso no retorno")}</text>`;
  for (let v = a; v <= b; v += 25) s += `<line class="grade" x1="${x(v)}" x2="${x(v)}" y1="${m.t - 8}" y2="${H - m.b}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle">${marca(v)}</text>`;
  s += `<line x1="${x(0)}" x2="${x(0)}" y1="${m.t - 8}" y2="${H - m.b}" stroke="var(--texto)" stroke-width="1.2"/>`;
  itens.forEach((e, i) => {
    const yc = m.t + i * lh + lh / 2 + 6, cor = COR[grupoEfeito(e)];
    const lo = rel(e, e.ajustado_lo), mid = rel(e, e.ajustado_pp), hi = rel(e, e.ajustado_hi);
    s += `<text class="rot" x="${m.l - 14}" y="${yc + 4}" text-anchor="end">${esc(nomeEfeito(e))}</text>`;
    s += `<line x1="${x(lo)}" x2="${x(hi)}" y1="${yc}" y2="${yc}" stroke="${cor}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<line x1="${x(lo)}" x2="${x(lo)}" y1="${yc - 6}" y2="${yc + 6}" stroke="${cor}" stroke-width="2"/><line x1="${x(hi)}" x2="${x(hi)}" y1="${yc - 6}" y2="${yc + 6}" stroke="${cor}" stroke-width="2"/>`;
    s += `<circle cx="${x(mid)}" cy="${yc}" r="7" fill="${cor}" stroke="var(--cartao)" stroke-width="1.5"/>`;
    s += `<text x="${x(lo) - 8}" y="${yc + 4}" text-anchor="end">${n0.format(Math.round(Math.abs(lo)))}%</text><text x="${x(hi) + 8}" y="${yc + 4}">${n0.format(Math.round(Math.abs(hi)))}%</text>`;
    s += `<text x="${x(mid)}" y="${yc - 13}" text-anchor="middle" style="fill:var(--texto);font-weight:700">${VOLTA(mid)}</text>`;
    const txt = `<b>${esc(nomeEfeito(e))}</b><br>${T("Comparado com {ref}, comparando pessoas parecidas:", { ref: esc(refNome(e)) })} ${VOLTA(mid)}.<br>${T("Pode variar de {a} a {b}.", { a: VOLTA(lo), b: VOLTA(hi) })}`;
    s += `<rect class="alvo" tabindex="0" x="0" y="${yc - lh / 2}" width="${W}" height="${lh}" aria-label="${esc(nomeEfeito(e))}: ${VOLTA(mid)}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

// Pergunta 1: o retorno de cada grupo, em %, com a margem de erro e a média de todos.
function graficoGrupos(secoes, media) {
  const W = 760, lh = 30, cab = 26, m = { l: 230, r: 70, t: 8, b: 26 };
  const linhas = secoes.reduce((n, s) => n + s.itens.length, 0);
  const H = m.t + m.b + lh * linhas + cab * secoes.length;
  const todos = secoes.flatMap((s) => s.itens).filter((it) => it.ic_hi != null);
  const topo = Math.ceil(Math.max(30, ...todos.map((it) => it.ic_hi)) / 10) * 10;
  const x = (v) => m.l + (v / topo) * (W - m.l - m.r);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("O que faz uma pessoa que experimentou o assistente voltar em até 7 dias?")}">`;
  for (let v = 0; v <= topo; v += passoEixo(topo)) s += `<line class="grade" x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${H - m.b}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle">${v}%</text>`;
  let y = m.t;
  secoes.forEach((sec) => {
    s += `<text x="${m.l - 10}" y="${y + 17}" text-anchor="end" style="fill:var(--suave);font-size:11px;font-weight:600;letter-spacing:.05em">${esc(sec.titulo.toUpperCase())}</text>`;
    y += cab;
    sec.itens.forEach((it) => {
      const yc = y + lh / 2;
      s += `<text class="rot" x="${m.l - 10}" y="${yc + 4}" text-anchor="end">${esc(it.nome)}</text>`;
      if (it.retorno_pct != null) {
        s += `<rect x="${m.l}" y="${yc - 9}" width="${x(it.retorno_pct) - m.l}" height="18" rx="4" fill="${it.cor || "var(--marca)"}"/>`;
        s += `<line x1="${x(it.ic_lo)}" x2="${x(it.ic_hi)}" y1="${yc}" y2="${yc}" stroke="var(--texto)" stroke-opacity=".45" stroke-width="2"/>`;
        s += `<text x="${x(Math.max(it.ic_hi, it.retorno_pct)) + 6}" y="${yc + 4}" style="fill:var(--texto);font-weight:600">${P(it.retorno_pct)}</text>`;
        const txt = `<b>${esc(it.nome)}</b><br>${T("{n} pessoas · {k} voltaram", { n: N(it.n), k: N(it.voltaram) })}<br>${T("Retorno:")} <b>${P(it.retorno_pct)}</b><br>${T("Margem de erro:")} ${FAIXA(it.ic_lo, it.ic_hi)}`;
        s += `<rect class="alvo" tabindex="0" x="0" y="${yc - lh / 2}" width="${W}" height="${lh}" aria-label="${esc(it.nome)}: ${P(it.retorno_pct)}" data-dica="${esc(txt)}"/>`;
      }
      y += lh;
    });
  });
  s += `<line class="media" x1="${x(media)}" x2="${x(media)}" y1="${m.t}" y2="${H - m.b}"/>`;
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


// Os efeitos válidos e os grupos de cada achado.
function lerResposta(d) {
  const ef = d.efeitos.filter((e) => e.natureza !== "mediador" && e.suficiente && e.ajustado_pp != null);
  const pega = (nivel, fator) => ef.find((e) => e.nivel === nivel && (!fator || e.fator === fator));
  const grupo = (achado, g) => d.achados.find((a) => a.achado === achado && a.grupo === g) || {};
  const afasta = ef.filter((e) => grupoEfeito(e) === "afasta").sort((a, b) => a.ajustado_pp - b.ajustado_pp);
  return { ef, pega, grupo, afasta };
}

// ---------- tela A resposta ----------
async function paginaResposta(el) {
  $("#filtros").hidden = true;
  const d = await api("/api/analise");
  const g = d.geral;
  const { ef, pega, grupo, afasta } = lerResposta(d);
  const t = Object.fromEntries(d.testes.map((x) => [x.nome, x]));
  const teste = pega("saudacao_teste"), imagem = pega("imagem_midia"), gpt4 = pega("True", "gpt4"), celular = pega("celular");

  // "O que mais pesa": tudo o que tem efeito comprovado, mais o GPT-4 (a pergunta mais comum); o resto vira lista.
  const peso = ef.filter((e) => comprovado(e) || e.fator === "gpt4").sort((a, b) => Math.abs(b.ajustado_pp) - Math.abs(a.ajustado_pp));
  const neutros = ef.filter((e) => !peso.includes(e)).sort((a, b) => Math.abs(b.ajustado_pp) - Math.abs(a.ajustado_pp));
  const perfil = ef.filter((e) => (comprovado(e) && e.fator !== "gpt4") || ["resposta_longa", "msg_curta"].includes(e.fator)).sort((a, b) => Math.abs(b.ajustado_pp) - Math.abs(a.ajustado_pp));
  // Pergunta 1: os grupos dos achados, em %; pergunta 3: os três maiores fatores mantêm a diferença comparando pessoas parecidas?
  const gr = (achado, g, nome, cor) => ({ ...grupo(achado, g), nome, cor });
  const secoes = [
    { titulo: T("Como a pessoa chega"), itens: [gr("chegada", "pedido_real", T("Chega com um pedido real")), gr("chegada", "saudacao_teste", T("Só cumprimenta ou testa"), "var(--ruim)"),
      gr("chegada", "imagem_midia", T("Pede imagem, vídeo ou áudio"), "var(--ruim)"), gr("chegada", "burlar_regras", T("Tenta burlar as regras"), "var(--ruim)")] },
    { titulo: T("Aparelho"), itens: [gr("dispositivo", "computador", T("Computador")), gr("dispositivo", "celular", T("Celular"), "var(--ruim)")] },
    { titulo: T("Modelo da 1ª conversa"), itens: [gr("modelo", "GPT-4", "GPT-4", "var(--marca-clara)"), gr("modelo", "GPT-3.5", "GPT-3.5", "var(--marca-clara)")] },
  ];
  const r1 = T("Volta mais quem chega com um pedido real ({a}) e quem usa pelo computador ({b}). Quem chega só testando ({c}) ou pedindo imagem ({d}) quase não volta. O modelo quase não muda o retorno: GPT-4 {e} e GPT-3.5 {f}.",
    { a: P(grupo("chegada", "pedido_real").retorno_pct), b: P(grupo("dispositivo", "computador").retorno_pct), c: P(grupo("chegada", "saudacao_teste").retorno_pct),
      d: P(grupo("chegada", "imagem_midia").retorno_pct), e: P(grupo("modelo", "GPT-4").retorno_pct), f: P(grupo("modelo", "GPT-3.5").retorno_pct) });
  const r2 = T("O que mais pesa é o que a pessoa pede na primeira conversa: quem só testa ou pede imagem volta cerca de {a} pontos a menos. Pelo celular, {b} pontos a menos. O modelo não muda o retorno.", { a: n0.format(Math.round(-(teste.ajustado_pp + imagem.ajustado_pp) / 2)), b: n0.format(Math.round(-celular.ajustado_pp)) });
  const semSelecao = afasta.slice(0, 3).every((e) => (e.bruto_pp - e.ajustado_pp) / e.bruto_pp <= 0.15);
  const r3 = (semSelecao ? T("Nos três fatores que mais pesam, a diferença continua quase igual quando comparamos pessoas parecidas: ela é do próprio fator, não do perfil de quem chega.") : T("Veja em cada fator quanto da diferença continua quando comparamos pessoas parecidas."))
    + " " + T("Em outros, como a mensagem curta, a diferença vinha do perfil e some. Para provar que é causa, falta um teste A/B.");
  const ipw = d.gpt4.find((x) => x.metodo === "IPW");
  const smd = ipw ? (ipw.detalhe.match(/([\d.]+)\s*->\s*([\d.]+)/) || []).slice(1).map(Number) : [];
  const diag = t.modelo_efeitos;
  const diagnostico = (diag ? T("Diagnóstico do modelo: {n} pessoas; pseudo-R² = {r} (a primeira experiência explica pouco do retorno, o que é esperado com tão pouca informação por pessoa).", { n: N(diag.n), r: n0.format(Math.round(diag.valor * 1000) / 1000) }) : "")
    + (smd.length === 2 ? " " + T("No IPW, o maior desequilíbrio entre os grupos cai de {a} para {b} desvio-padrão.", { a: n1.format(smd[0]), b: n1.format(smd[1]) }) : "");
  const mesmoDia = d.sensibilidade.find((s) => s.cenario.startsWith("regra anterior")) || { retorno_pct: null, ic95: "" };
  const [mesmoLo, mesmoHi] = (String(mesmoDia.ic95).match(/\d+[.,]\d+/g) || []).map((x) => Number(x.replace(",", ".")));


  const sw = d.semana;
  const homog = t.homogeneidade_semanas ? n1.format(t.homogeneidade_semanas.p) : null;

  el.innerHTML = `
    <h1>${T("A resposta")}</h1>
    <p class="pergunta">${T("O que faz uma pessoa que experimentou o assistente voltar em até 7 dias, quanto pesa cada fator e quanto disso vinha do perfil de quem chega. Base: <b>{n} pessoas</b> que usaram o assistente pela primeira vez.", { n: N(g.usuarios) })}</p>

    <div class="grade g13">
      <div class="pilha" id="cartoes">
        <div class="cartao kpi destaque"><div class="rotulo">${T("Voltam em até 7 dias")}</div><div class="valor">${P(g.retorno_pct)}</div><div class="det">${T("margem de erro:")} ${FAIXA(g.ic_lo, g.ic_hi)}</div>
          <p class="det">${T("Voltar = usar de novo em outro dia, até 7 dias depois do primeiro uso.")}</p></div>
        <div class="cartao kpi"><div class="rotulo">${T("Pessoas analisadas")}</div><div class="valor">${N(g.usuarios)}</div><div class="det">${T("usaram o assistente pela 1ª vez entre {a} e {b}", { a: MES(d.coortes[0].semana), b: MES(d.coortes[d.coortes.length - 1].semana) })}</div></div>
        <div class="cartao kpi"><div class="rotulo">${T("Se voltar no mesmo dia contasse")}</div><div class="valor">${P(mesmoDia.retorno_pct)}</div>${mesmoHi != null ? `<div class="det">${T("margem de erro:")} ${FAIXA(mesmoLo, mesmoHi)}</div>` : ""}<div class="det">${T("é a regra de contagem que mais muda o número; usamos a de outro dia")}</div></div>
      </div>
      <div class="cartao bloco-pergunta" id="pergunta-1"><h2><span class="num">1</span>${T("O que faz uma pessoa que experimentou o assistente voltar em até 7 dias?")}</h2>
        <p class="resposta-curta">${r1}</p>
        ${graficoGrupos(secoes, g.retorno_pct)}
        <div class="legenda"><span><i style="background:var(--marca)"></i>${T("retorno de cada grupo")}</span><span><i class="linha"></i>${T("média de todos ({n})", { n: P(g.retorno_pct) })}</span><span>${T("a linha fina é a margem de erro")}</span></div>
        <p class="ajuda" style="margin-top:10px">${T("Comparação simples entre grupos: ela ainda mistura o efeito de cada característica com o perfil de quem está no grupo. As perguntas 2 e 3 separam uma coisa da outra.")}</p>
        ${explicacao(T("Para cada grupo, contamos quantas pessoas usaram o assistente pela primeira vez e quantas voltaram em outro dia, em até 7 dias."), T("Retorno = pessoas com uso entre D+1 e D+7 ÷ pessoas novas do grupo; margem de erro = intervalo de confiança de 95% de Wilson, calculado no banco."), { [T("Retorno por grupo")]: d.sql.achados })}
      </div>
    </div>

    <div class="cartao bloco-pergunta" id="pergunta-2" style="margin-bottom:16px"><h2><span class="num">2</span>${T("Quais fatores têm o maior efeito no retorno?")}</h2>
      <p class="resposta-curta">${r2}</p>
      <p class="ajuda">${T("Cada linha mostra quantas pessoas com essa característica voltam: o número no meio é o valor medido, e as pontas mostram até onde ele pode variar (margem de erro).")}</p>
      ${graficoPeso(peso, 1100)}
      <div class="legenda">${["afasta", "medida", "neutro"].concat(peso.some((e) => grupoEfeito(e) === "aproxima") ? ["aproxima"] : []).map((k) => `<span><i style="background:${COR[k]};border-radius:50%"></i>${legenda(k)}</span>`).join("")}</div>
      <p class="ajuda" style="margin-top:10px">${T("<b>Começou à noite</b> é efeito da forma de medir: quem começa às 23h e continua depois da meia-noite já conta como “voltou outro dia”. Não é algo que o produto controle.")}</p>
      <p class="ajuda"><b>${T("Também não mudam o retorno:")}</b> ${neutros.map((e) => esc(nomeEfeito(e))).join(" · ")}.</p>
      ${explicacao(T("Comparamos quem tem cada característica com quem não tem, mas entre pessoas parecidas em todo o resto. Assim, por exemplo, a diferença do celular não vem de quem usa celular pedir temas diferentes. A margem de erro mostra onde o efeito real deve estar; quando ela inclui o zero, não dá para afirmar que há diferença."),
          T("Regressão logística com todos os fatores e a época (regime de oferta do GPT-4) como controle; efeito marginal médio em pontos percentuais, intervalo de confiança de 95% pelo método delta, erros robustos (HC1). Turnos e número de temas no 1º dia ficam fora por serem consequência do engajamento (mediadores). Grupos com menos de 30 pessoas não aparecem.") + " " + diagnostico, { [T("Efeitos")]: d.sql.efeitos, [T("Diagnóstico")]: d.sql.testes })}
    </div>

    <div class="cartao bloco-pergunta" id="pergunta-3" style="margin-bottom:16px"><h2><span class="num">3</span>${T("Quanto pesa cada um e quanto disso é causa e não seleção?")}</h2>
      <p class="resposta-curta">${r3}</p>
      <p class="ajuda">${T("Cada linha mostra quanto quem tem essa característica volta a mais ou a menos do que o grupo com quem é comparado (passe o mouse para ver qual), comparando pessoas parecidas: mesmo idioma, aparelho, horário, tema e época. O número no meio é o valor medido, e as pontas mostram até onde ele pode variar. Quanto mais longe da linha “sem peso”, mais a característica pesa.")}</p>
      ${graficoCausa(perfil)}
      <div class="legenda">${["afasta", "medida", "neutro"].concat(perfil.some((e) => grupoEfeito(e) === "aproxima") ? ["aproxima"] : []).map((k) => `<span><i style="background:${COR[k]};border-radius:50%"></i>${legenda(k)}</span>`).join("")}</div>
      ${explicacao(T("A diferença “comparando todo mundo” mistura o efeito da característica com o perfil de quem a tem (tema, aparelho, idioma, horário e época). Comparando pessoas parecidas, sobra a parte que não se explica por esse perfil."), T("Peso em % = efeito marginal médio da regressão logística ÷ retorno do grupo de comparação; as pontas usam o intervalo de confiança de 95% do efeito (método delta, erros robustos HC1), divididas pelo mesmo retorno."), { [T("Efeitos")]: d.sql.efeitos })}
    </div>


    <div class="cartao" id="semanas" style="margin-bottom:16px"><h2>${T("Retorno semana a semana")}</h2>
      <p class="ajuda">${T("Cada ponto é uma semana de chegada. A faixa cinza mostra quanto o número oscila só por acaso, com cerca de 45 pessoas por semana: um ponto dentro dela não indica mudança real.")} ${sw ? T("A semana de {d} está destacada.", { d: DATA(sw.semana) }) : ""} ${T("Semanas com menos de 30 pessoas ficam sem ponto.")}</p>
      ${graficoSemanas(d.coortes, g.retorno_pct, sw ? sw.semana : null)}
      <div class="legenda"><span><i style="background:var(--marca)"></i>${T("semana dentro da faixa do acaso")}</span><span><i style="background:var(--atencao)"></i>${T("fora da faixa")}</span>${sw ? `<span><i style="background:var(--ruim)"></i>${T("semana analisada")}</span>` : ""}<span><i class="faixa" style="background:var(--fundo);border-color:var(--linha)"></i>${T("faixa do acaso")}</span><span><i class="linha"></i>${T("média da base")}</span></div>
      ${explicacao(T("Se todas as semanas tivessem o mesmo retorno da base inteira ({n}), 95% das semanas cairiam dentro da faixa cinza só por sorte. Com cerca de 37 semanas, é normal uma ou duas ficarem fora.", { n: P(g.retorno_pct) }), T("Faixa = p ± 1,96 × √(p(1−p)/n), com p = retorno da base inteira e n = pessoas da semana.") + (homog ? " " + T("Teste qui-quadrado de homogeneidade entre as semanas com 30 pessoas ou mais: p = {p} (não rejeita que todas tenham o mesmo retorno).", { p: homog }) : ""), { [T("Retorno por semana")]: d.sql.coortes })}
    </div>

    <div class="grade g2">
      <div class="cartao" id="sensibilidade"><h2>${T("O número muda conforme a forma de medir?")}</h2>
        <p class="ajuda">${T("Cada linha muda uma única regra de contagem. Quase nada muda, exceto contar quem volta <b>no mesmo dia</b>, que sobe bastante o número. Por isso deixamos claro qual regra usamos.")}</p>
        <div class="rolagem"><table><tr><th>${T("Regra")}</th><th class="num">${T("Retorno")}</th><th class="num">${T("Margem de erro")}</th></tr>
        ${d.sensibilidade.map((s) => `<tr${s.cenario.startsWith("referência") ? ' class="ref"' : ""}><td>${esc(regra(s.cenario))}</td><td class="num">${P(s.retorno_pct)}</td><td class="num">${esc(String(s.ic95 || "").replace(/(\d+[.,]\d)[–-](\d+[.,]\d)/, (_, a, b) => T("{a} a {b}", { a: P(Number(a.replace(",", "."))), b: P(Number(b.replace(",", "."))) })))}</td></tr>`).join("")}</table></div>
      </div>
      <div class="cartao" id="temas"><h2>${T("Como sabemos o tema de cada conversa?")}</h2><p>${comoClassificamos().simples}</p>
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
  const doc = await api(`/api/documentos/${encodeURIComponent(atual)}?lang=${LINGUA}`);
  const grupos = [...new Set(lista.map((x) => x.grupo))];
  el.innerHTML = `
    <h1>${T("Documentação")}</h1>
    <p class="pergunta">${T("As decisões, a análise passo a passo, os indicadores e a arquitetura, como estão no repositório.")}</p>
    <div class="docs">
      <aside class="docs-indice" aria-label="${T("Documentos")}">${grupos.map((g) => `<h3>${esc(T(g))}</h3><ul>${lista.filter((x) => x.grupo === g).map((x) => `<li><a href="#documentacao/${x.nome}" ${x.nome === atual ? 'aria-current="page"' : ""}>${esc(T(x.titulo))}</a></li>`).join("")}</ul>`).join("")}</aside>
      <article class="cartao doc">${doc.html}</article>
    </div>`;
  window.scrollTo(0, 0);  // a seção pedida pela busca (?s=) é posicionada depois, em mostrar()
  return null;
}
const PAGINAS = { resposta: paginaResposta, explorar: paginaExplorar, documentacao: paginaDocumentacao };

function rodape(p) {
  if (!p) { $("#rodape").innerHTML = ""; return; }
  $("#rodape").innerHTML = `<b>${T("Fonte:")}</b> ${T("WildChat-1M (allenai), conversas com country = 'Brazil'")} · ${T("{a} conversas do Brasil, de {b} na base", { a: N(p.linhas_brasil), b: N(p.linhas_fonte) })} ·
    <b>${T("Atualizado em")}</b> ${new Date(p.carga_em).toLocaleString(LOCAIS[LINGUA])} (${T("versão")} ${esc(p.versao_codigo)}) ·
    ${p.reconciliacao_ok ? T("números conferidos contra a base bruta ✓") : `<b>${T("ATENÇÃO: a conferência contra a base bruta falhou")}</b>`}${ULTIMO_PEDIDO ? ` · ${T("código do pedido")} <code>${esc(ULTIMO_PEDIDO)}</code>` : ""}<br>
    <b>${T("Definição:")}</b> ${T("Voltou = usou o assistente em outro dia (horário de São Paulo), entre o 1º e o 7º dia depois do primeiro dia de uso. Pessoa = endereço de internet (IP), anonimizado.")} ${T("Nenhuma tela mostra texto de conversa, IP ou navegador, nem números de grupos com menos de 30 pessoas.")}`;
}

async function mostrar() {
  const [caminho, qs] = (location.hash.slice(1) || "resposta").split("?");
  const [bruta, sub] = caminho.split("/");
  const aba = bruta === "analise" ? "resposta" : bruta;  // endereço antigo da tela
  const pagina = PAGINAS[aba] ? aba : "resposta";
  document.querySelectorAll("nav a").forEach((a) => (a.dataset.aba === pagina ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  if (PREFERIDA !== LINGUA) { LINGUA = PREFERIDA; aplicarLingua(); }
  const el = $("#conteudo");
  el.innerHTML = `<p class="estado">${T("Carregando…")}</p>`;
  try {
    const params = new URLSearchParams(qs || "");
    rodape(await PAGINAS[pagina](el, params, sub));
    ligarDicas(el);
    const alvo = params.get("ir") || params.get("s");
    if (alvo) { const no = document.getElementById(alvo); if (no) no.scrollIntoView({ block: "start" }); }
  } catch (e) {
    el.innerHTML = `<p class="erro">${esc(e.message)}</p>`;
  }
}

// ---------- busca: telas e filtros na própria página; documentos no servidor (índice em memória) ----------
const normalizar = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const catalogoTelas = () => [
  ["resposta", "cartoes", T("Voltam em até 7 dias"), "retorno margem erro pessoas analisadas mesmo dia definição voltar"],
  ["resposta", "pergunta-1", T("O que faz uma pessoa que experimentou o assistente voltar em até 7 dias?"), "grupo pedido real celular computador gpt-4 gpt-3.5"],
  ["resposta", "pergunta-2", T("Quais fatores têm o maior efeito no retorno?"), "efeito fator regressão ranking margem pontos percentuais"],
  ["resposta", "pergunta-3", T("Quanto pesa cada um e quanto disso é causa e não seleção?"), "causa seleção perfil bruto ajustado a/b"],
  ["resposta", "semanas", T("Retorno semana a semana"), "faixa do acaso coorte homogeneidade"],
  ["resposta", "sensibilidade", T("O número muda conforme a forma de medir?"), "regra definição sessão fuso janela utc"],
  ["resposta", "temas", T("Como sabemos o tema de cada conversa?"), "classificação ia llm kappa validação"],
  ["explorar", "recorte", T("O que este recorte mostra"), "filtros frases"],
  ["explorar", "retorno-mes", T("Retorno mês a mês"), "tendência"],
  ["explorar", "novas-mes", T("Pessoas novas por mês"), "volume"],
  ...["dispositivo", "idioma", "modelo", "tema"].map((x) => ["explorar", `grupo-${x}`, T("Quem volta mais? Por {dim}", { dim: dimMinuscula(x) }), ""]),
  ["explorar", "chegada", T("Com que tema as pessoas chegam"), "conversas pessoas"],
].map(([aba, id, titulo, extra]) => ({ titulo, sub: aba === "resposta" ? T("A resposta") : T("Explorar"), href: `#${aba}?ir=${id}`, busca: normalizar(`${titulo} ${extra}`) }));
const VALORES = {
  tema: ["estudo", "programacao", "reescrita", "marketing", "ficcao", "conhecimento", "vida_pratica", "imagem_midia", "burlar_regras", "saudacao_teste", "outro"],
  idioma: ["português", "inglês", "outro"], dispositivo: ["celular", "computador"], modelo: ["GPT-4", "GPT-3.5"],
};
const catalogoFiltros = () => Object.entries(VALORES).flatMap(([d, vs]) => vs.map((v) => {
  const nome = d === "idioma" && v === "outro" ? T("Outro idioma") : rot(v);
  return { titulo: nome, sub: T("Ver no Explorar, filtrado por {dim}", { dim: dimMinuscula(d) }), href: `#explorar?${d}=${encodeURIComponent(v)}`, busca: normalizar(`${nome} ${v}`) };
}));
let buscaEspera = null, buscaPedido = null;
function ligarBusca() {
  const campo = $("#busca"), lista = $("#busca-resultados");
  const fechar = () => { lista.hidden = true; };
  const desenhar = (grupos) => {
    const html = grupos.filter(([, itens]) => itens.length).map(([nome, itens]) => `<div class="grupo">${esc(nome)}</div>${itens.map((it) => `<a href="${esc(it.href)}"><b>${esc(it.titulo)}</b><small>${esc(it.sub)}</small></a>`).join("")}`).join("");
    lista.innerHTML = html || `<p class="vazio">${T("Nada encontrado.")}</p>`;
    lista.hidden = false;
  };
  campo.addEventListener("input", () => {
    clearTimeout(buscaEspera);
    const q = campo.value.trim();
    if (q.length < 2) { fechar(); return; }
    buscaEspera = setTimeout(async () => {  // espera a pessoa parar de digitar
      const termos = normalizar(q).split(/\s+/).filter((x) => x.length >= 2);
      const casa = (it) => termos.every((x) => it.busca.includes(x));
      const telas = catalogoTelas().filter(casa).slice(0, 6), filtros = catalogoFiltros().filter(casa).slice(0, 4);
      desenhar([[T("Nas telas"), telas], [T("Nos filtros"), filtros], [T("Nos documentos"), []]]);
      if (buscaPedido) buscaPedido.abort();
      buscaPedido = new AbortController();
      try {
        const docs = await (await fetch(`/api/busca?q=${encodeURIComponent(q)}&lang=${LINGUA}`, { signal: buscaPedido.signal })).json();
        if (campo.value.trim() !== q) return;
        desenhar([[T("Nas telas"), telas], [T("Nos filtros"), filtros], [T("Nos documentos"), docs.map((x) => ({ titulo: x.secao, sub: `${T(x.titulo_documento)} · ${x.trecho}`, href: `#documentacao/${x.documento}${x.ancora ? `?s=${x.ancora}` : ""}` }))]]);
      } catch (e) { /* busca cancelada por outra mais nova */ }
    }, 250);
  });
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { fechar(); campo.blur(); }
    if (e.key === "Enter") { const primeiro = $("a", lista); if (primeiro) { location.hash = primeiro.getAttribute("href").slice(1); fechar(); } }
  });
  lista.addEventListener("click", (e) => { if (e.target.closest("a")) fechar(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".busca")) fechar(); });
}

async function iniciar() {
  try { TRADUCOES = await (await fetch("/static/i18n.json")).json(); } catch (e) { TRADUCOES = {}; }  // sem o arquivo, a tela fica em português
  document.querySelectorAll("[data-lingua]").forEach((b) => b.addEventListener("click", () => trocarLingua(b.dataset.lingua)));
  aplicarLingua();
  ligarBusca();
  mostrar();
}

window.addEventListener("hashchange", mostrar);
iniciar();
