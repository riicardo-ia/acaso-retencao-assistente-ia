"use strict";
// Dashboard: só exibe o que a API devolve (o número é calculado no banco).
// Sem biblioteca, sem CDN: gráficos em SVG e HTML próprios.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n0 = new Intl.NumberFormat("pt-BR");
const n1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const N = (v) => (v == null ? "—" : n0.format(v));
const P = (v) => (v == null ? "—" : n1.format(v) + "%");
const PP = (v) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + n1.format(Math.abs(v)) + " pontos");
const FAIXA = (lo, hi, suf = "%") => `entre ${n1.format(lo)}${suf} e ${n1.format(hi)}${suf}`;
const DATA = (s) => new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR");
const MES = (s) => { const t = new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); return t.replace(". de ", "/").replace(".", ""); };

const ROTULOS = {
  estudo: "Estudo e trabalho acadêmico", programacao: "Programação e tecnologia", reescrita: "Reescrita, resumo e tradução",
  marketing: "Marketing e conteúdo profissional", ficcao: "Ficção, roleplay e criação", conhecimento: "Conhecimento geral",
  vida_pratica: "Vida prática e conselhos", imagem_midia: "Pede imagem, vídeo ou áudio", burlar_regras: "Tenta burlar as regras",
  saudacao_teste: "Só cumprimenta ou testa", outro: "Outro tema",
  português: "Português", inglês: "Inglês", celular: "Celular", computador: "Computador",
  noite: "Começou à noite (18h–24h)", madrugada: "Começou de madrugada (0h–6h)", manhã: "Começou de manhã (6h–12h)", tarde: "Começou à tarde",
};
const rot = (k) => ROTULOS[k] || k;
const REGRAS = {
  "referência: outro dia local, D+1 a D+7": "Usada no dashboard: voltou em outro dia, até 7 dias depois",
  "regra anterior: nova sessão (pausa > 30 min) até 7 x 24 h": "Se voltar no mesmo dia contasse (depois de 30 min de pausa)",
  "  └ sessão com pausa de 15 min": "… com pausa de 15 min",
  "  └ sessão com pausa de 60 min": "… com pausa de 60 min",
  "usuário = IP + user-agent": "Pessoa = endereço de internet + navegador",
  "usuário = IPs unidos pela conversa": "Pessoa = endereços unidos quando aparecem na mesma conversa",
  "uso = só início de conversa": "Só conta abrir conversa nova (não reabrir uma antiga)",
  "janela de 3 dias": "Janela de 3 dias em vez de 7",
  "janela de 14 dias": "Janela de 14 dias em vez de 7",
  "sem corte das 2 primeiras semanas": "Incluindo as 2 primeiras semanas da base",
  "sem corte do fim (janela incompleta)": "Incluindo quem começou nos últimos dias da base",
  "sem IPs anômalos (>= 10 user-agents)": "Sem endereços compartilhados por muita gente",
  "dia contado em UTC": "Dia contado no horário universal (UTC)",
};
const DIMS = { idioma: "Idioma", dispositivo: "Dispositivo", tema: "Tema da 1ª conversa", modelo: "Modelo" };

const COMO_CLASSIFICAMOS = {
  simples: `Uma inteligência artificial leu o que cada pessoa escreveu e escolheu o tema da conversa entre <b>11 opções definidas por nós</b>, sem poder inventar outra. Antes de usar, testamos se ela é confiável: repetindo a classificação, o tema foi o mesmo em <b>96 de cada 100 conversas</b>.`,
  tecnico: `<ul>
    <li><b>Rótulos predefinidos:</b> os 11 temas saíram dos próprios dados (agrupamento estatístico das conversas) e foram revisados manualmente.</li>
    <li><b>Classificação:</b> o modelo GPT-5.4 lê as mensagens do usuário e escolhe um dos 11 rótulos. Mensagens muito curtas ("oi", "teste") viram "só cumprimenta ou testa" sem passar pela IA.</li>
    <li><b>Validação com teste de hipóteses:</b> estabilidade entre duas classificações independentes (κ de Cohen = 0,95; a hipótese de baixa concordância foi rejeitada) e 5 de 5 comportamentos previstos confirmados (por exemplo, pedidos de imagem recebem mais recusas; qui-quadrado, p &lt; 0,001).</li>
    <li><b>Revisão manual:</b> onde dois modelos discordaram, revisamos os padrões e escolhemos o mais coerente.</li>
  </ul>`,
};

async function api(rota) {
  const r = await fetch(rota);
  if (!r.ok) throw new Error(r.status === 400 ? "Filtro inválido. Use o botão Limpar." : `A consulta falhou (${r.status}). Tente recarregar a página.`);
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
  return `<details><summary>Como calculamos?</summary><p class="simples">${simples}</p>${tecnico ? `<div class="tecnico"><b>Detalhe técnico:</b> ${tecnico}</div>` : ""}${s ? `<details><summary>Ver a consulta SQL</summary>${s}</details>` : ""}</details>`;
}
const passoEixo = (max, partes = 4) => { const b = Math.max(max, 1) / partes, p = 10 ** Math.floor(Math.log10(b)); return [1, 2, 2.5, 5, 10].map((f) => f * p).find((x) => x >= b); };
const MARGEM = "A faixa clara é a <b>margem de erro</b>: com poucas pessoas, o número pode variar por acaso dentro dela.";

// Linha do retorno por mês, com a margem de erro sombreada; meses com poucas pessoas aparecem vazados.
function graficoLinha(serie, media, nMin) {
  const W = 760, H = 280, m = { l: 44, r: 16, t: 14, b: 30 };
  const ok = serie.filter((s) => s.suficiente);
  const topo = Math.ceil(Math.max(30, ...ok.map((s) => s.ic_hi)) / 10) * 10;
  const x = (i) => m.l + (serie.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (serie.length - 1));
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / topo);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Retorno por mês">`;
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
    s += `<circle cx="${x(i)}" cy="${y(p.retorno_pct)}" r="5" fill="${p.suficiente ? "var(--marca)" : "var(--cartao)"}" stroke="${p.suficiente ? "var(--cartao)" : "var(--neutro)"}" stroke-width="2"/>`;
    const txt = `<b>${MES(p.mes)}</b><br>${N(p.n)} pessoas começaram · ${N(p.voltaram)} voltaram<br>Retorno: <b>${P(p.retorno_pct)}</b>` + (p.suficiente ? `<br>Margem de erro: ${FAIXA(p.ic_lo, p.ic_hi)}` : `<br>Poucas pessoas (menos de ${nMin}): não vale sozinho`);
    s += `<rect class="alvo" tabindex="0" aria-label="${MES(p.mes)}: ${P(p.retorno_pct)}" x="${x(i) - 14}" y="${m.t}" width="28" height="${H - m.t - m.b}" data-dica="${esc(txt)}"/>`;
  });
  return s + "</svg>";
}

// Colunas: quantas pessoas começaram em cada mês.
function graficoColunas(serie) {
  const W = 380, H = 280, m = { l: 40, r: 8, t: 14, b: 30 };
  const max = Math.max(1, ...serie.map((s) => s.n)), passo = passoEixo(max), topo = Math.ceil(max / passo) * passo;
  const bw = (W - m.l - m.r) / serie.length;
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / topo);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pessoas novas por mês">`;
  for (let v = 0; v <= topo; v += passo) s += `<line class="grade" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${N(v)}</text>`;
  serie.forEach((p, i) => {
    const x0 = m.l + i * bw;
    s += `<rect x="${x0 + bw * 0.15}" y="${y(p.n)}" width="${bw * 0.7}" height="${y(0) - y(p.n)}" rx="3" fill="var(--marca-clara)"/>`;
    if (i % 3 === 0) s += `<text x="${x0 + bw / 2}" y="${H - 8}" text-anchor="middle">${MES(p.mes)}</text>`;
    s += `<rect class="alvo" tabindex="0" x="${x0}" y="${m.t}" width="${bw}" height="${H - m.t - m.b}" aria-label="${MES(p.mes)}: ${N(p.n)} pessoas" data-dica="${esc(`<b>${MES(p.mes)}</b><br>${N(p.n)} pessoas usaram pela 1ª vez`)}"/>`;
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
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Retorno por grupo">`;
  for (let v = 0; v <= topo; v += passoEixo(topo)) s += `<line class="grade" x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${H - m.b}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle">${v}%</text>`;
  ord.forEach((l, i) => {
    const yc = m.t + i * lh + lh / 2;
    s += `<text class="rot" x="${m.l - 10}" y="${yc + 4}" text-anchor="end">${esc(rot(l.categoria))}</text>`;
    if (l.suficiente) {
      s += `<rect x="${m.l}" y="${yc - 9}" width="${x(l.retorno_pct) - m.l}" height="18" rx="4" fill="var(--marca)"/>`;
      s += `<line x1="${x(l.ic_lo)}" x2="${x(l.ic_hi)}" y1="${yc}" y2="${yc}" stroke="var(--texto)" stroke-opacity=".45" stroke-width="2"/>`;
      s += `<text x="${x(Math.max(l.ic_hi, l.retorno_pct)) + 6}" y="${yc + 4}" style="fill:var(--texto)">${P(l.retorno_pct)}</text>`;
    } else {
      s += `<rect x="${m.l}" y="${yc - 9}" width="${x(l.retorno_pct) - m.l}" height="18" rx="4" fill="var(--linha)"/>`;
      s += `<text x="${x(l.retorno_pct) + 6}" y="${yc + 4}">poucas pessoas</text>`;
    }
    const txt = `<b>${esc(rot(l.categoria))}</b><br>${N(l.n)} pessoas · ${N(l.voltaram)} voltaram<br>Retorno: <b>${P(l.retorno_pct)}</b>` + (l.suficiente ? `<br>Margem de erro: ${FAIXA(l.ic_lo, l.ic_hi)}` : `<br>Menos de ${nMin} pessoas: o número não vale sozinho`);
    s += `<rect class="alvo" tabindex="0" x="0" y="${yc - lh / 2}" width="${W}" height="${lh}" aria-label="${esc(rot(l.categoria))}: ${P(l.retorno_pct)}" data-dica="${esc(txt)}"/>`;
  });
  if (media != null) s += `<line class="media" x1="${x(media)}" x2="${x(media)}" y1="${m.t - 2}" y2="${H - m.b}"/>`;
  return s + "</svg>";
}

// Duas barras por tema: % das pessoas (1ª conversa) e % das conversas, mesma escala.
function graficoChegada(linhas) {
  const lh = 40, W = 760, m = { l: 230, r: 60, t: 6, b: 6 };
  const H = m.t + m.b + lh * linhas.length;
  const max = Math.max(1, ...linhas.map((l) => Math.max(l.pct_pessoas, l.pct_conversas)));
  const w = (v) => (v / max) * (W - m.l - m.r);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Com que tema as pessoas chegam">`;
  linhas.forEach((l, i) => {
    const y0 = m.t + i * lh;
    s += `<text class="rot" x="${m.l - 10}" y="${y0 + lh / 2 + 4}" text-anchor="end">${esc(rot(l.categoria))}</text>`;
    s += `<rect x="${m.l}" y="${y0 + 5}" width="${w(l.pct_pessoas)}" height="13" rx="3" fill="var(--marca)"/><text x="${m.l + w(l.pct_pessoas) + 6}" y="${y0 + 16}">${P(l.pct_pessoas)}</text>`;
    s += `<rect x="${m.l}" y="${y0 + 21}" width="${w(l.pct_conversas)}" height="13" rx="3" fill="var(--laranja)"/><text x="${m.l + w(l.pct_conversas) + 6}" y="${y0 + 32}">${P(l.pct_conversas)}</text>`;
  });
  return s + "</svg>";
}

function nomeEfeito(e) {
  if (["tema", "dispositivo", "faixa_horaria"].includes(e.fator)) return rot(e.nivel);
  if (e.fator === "idioma") return e.nivel === "outro" ? "Conversa em outro idioma" : `Conversa em ${rot(e.nivel).toLowerCase()}`;
  return e.rotulo;
}

// ---------- filtros (só na tela Explorar) ----------
function lerFiltros(qs) {
  const f = {};
  ["inicio", "fim", "idioma", "dispositivo", "tema", "modelo"].forEach((k) => { const v = qs.get(k); if (v) f[k] = v; });
  return f;
}
function desenharFiltros(op, f) {
  const el = $("#filtros");
  const sel = (dim) => `<label>${DIMS[dim]}<select data-f="${dim}"><option value="">Todos</option>${op[dim].map((v) => `<option value="${esc(v)}" ${f[dim] === v ? "selected" : ""}>${esc(rot(v))}</option>`).join("")}</select></label>`;
  const qtd = Object.keys(f).length;
  el.innerHTML = `
    <label>1º uso a partir de<input type="date" data-f="inicio" min="${op.inicio}" max="${op.fim}" value="${f.inicio || op.inicio}"></label>
    <label>até<input type="date" data-f="fim" min="${op.inicio}" max="${op.fim}" value="${f.fim || op.fim}"></label>
    ${sel("idioma")}${sel("dispositivo")}${sel("tema")}${sel("modelo")}
    <button type="button" data-limpar>Limpar</button>
    <span class="ativos">${qtd ? `${qtd} filtro${qtd > 1 ? "s" : ""} ativo${qtd > 1 ? "s" : ""}` : "Sem filtros: toda a base"}</span>`;
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

// ---------- telas ----------
async function paginaExplorar(el, qs) {
  const f = lerFiltros(qs);
  const d = await api("/api/explorar?" + new URLSearchParams(f));
  desenharFiltros(d.opcoes, f);
  const r = d.recorte, b = d.base;
  el.innerHTML = `
    <h1>Explorar</h1>
    <p class="pergunta">Escolha um recorte nos filtros acima e veja quantas pessoas voltaram a usar o assistente em até 7 dias, como isso evoluiu e quais grupos voltam mais ou menos. Todos os números mudam com os filtros.</p>
    <div class="frases"><h2>O que este recorte mostra</h2><ul>${d.frases.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <p class="nota">Frases geradas por regras fixas: uma diferença só é chamada de "confirmada" quando é maior que a margem de erro (com 99% de confiança). São comparações simples; para o efeito comparando pessoas parecidas, veja a <a href="#analise">Análise completa</a>.</p></div>
    <div class="grade g4">
      ${kpi("Voltaram em até 7 dias", r.suficiente ? P(r.retorno_pct) : "—", r.suficiente ? `margem de erro: ${FAIXA(r.ic_lo, r.ic_hi)}` : `menos de ${d.n_min} pessoas: amplie o recorte`, "destaque")}
      ${kpi("Pessoas no recorte", N(r.n), "usaram o assistente pela 1ª vez no período")}
      ${kpi("Voltaram", N(r.voltaram), "usaram de novo em outro dia, em até 7 dias")}
      ${kpi("Toda a base", P(b.retorno_pct), `${N(b.n)} pessoas, sem filtro`)}
    </div>
    <div class="grade g21">
      <div class="cartao"><h2>Retorno mês a mês</h2>
        <p class="ajuda">Cada ponto: das pessoas que começaram naquele mês, quantas voltaram. ${MARGEM} Pontos vazados têm poucas pessoas.</p>
        ${!d.serie.length ? `<p class="estado">Sem pessoas neste recorte.</p>` : (d.serie.some((s) => s.suficiente) ? "" : `<p class="ajuda"><b>Nenhum mês tem ${d.n_min} pessoas ou mais neste recorte</b>: os pontos aparecem só como referência.</p>`) + graficoLinha(d.serie, r.suficiente ? r.retorno_pct : null, d.n_min)}
        <div class="legenda"><span><i style="background:var(--marca)"></i>retorno do mês</span><span><i class="faixa"></i>margem de erro</span><span><i class="linha"></i>média do recorte</span></div>
        ${explicacao("Para cada mês, contamos quem usou o assistente pela primeira vez naquele mês e quantas dessas pessoas voltaram a usar em outro dia, em até 7 dias.", "Retorno = pessoas com uso entre D+1 e D+7 (dia local de São Paulo) ÷ pessoas novas; margem de erro = intervalo de confiança de 95% de Wilson, calculado no banco.", { "Retorno por mês": d.sql["Retorno por mês"] })}
      </div>
      <div class="cartao"><h2>Pessoas novas por mês</h2>
        <p class="ajuda">Quantas pessoas usaram o assistente pela primeira vez, mês a mês, neste recorte.</p>
        ${graficoColunas(d.serie)}
      </div>
    </div>
    <div class="grade g3">
      ${["dispositivo", "idioma", "modelo"].map((dim) => cartaoGrupo(d, dim)).join("")}
    </div>
    <div class="grade g2">
      ${cartaoGrupo(d, "tema", COMO_CLASSIFICAMOS)}
      <div class="cartao"><h2>Com que tema as pessoas chegam</h2>
        <p class="ajuda"><b style="color:var(--marca)">Roxo:</b> % das pessoas, pelo tema da 1ª conversa. <b style="color:var(--laranja)">Laranja:</b> % de todas as conversas dessas pessoas (quem usa muito pesa mais).</p>
        ${graficoChegada(d.chegada)}
        ${explicacao(COMO_CLASSIFICAMOS.simples, COMO_CLASSIFICAMOS.tecnico, { "Com que tema chegam": d.sql["Com que tema chegam"] })}
      </div>
    </div>`;
  return d.procedencia;
}
function cartaoGrupo(d, dim, classificacao) {
  const filtrado = d.filtros[dim];
  return `<div class="cartao"><h2>Quem volta mais? Por ${DIMS[dim].toLowerCase()}</h2>
    <p class="ajuda">${filtrado ? `Filtrado em “${esc(rot(filtrado))}”. ` : ""}A barra é o retorno de cada grupo; a linha fina é a margem de erro; a linha tracejada é a média do recorte.</p>
    ${graficoBarras(d.grupos[dim], d.recorte.suficiente ? d.recorte.retorno_pct : null, d.n_min, dim === "tema" ? 760 : 420)}
    ${explicacao(classificacao ? classificacao.simples : "Mesma conta do retorno, separada por grupo. Grupos com menos de 30 pessoas ficam em cinza, sem número próprio.", classificacao ? classificacao.tecnico : "Comparação simples (não leva em conta outras diferenças entre os grupos). Margem de erro = IC de 95% de Wilson.", { "Por grupo (exemplo: por tema; as outras dimensões trocam só a coluna agrupada)": d.sql["Por grupo"] })}
  </div>`;
}

// ---------- Análise completa: linguagem de negócio ("de cada 100 pessoas") ----------
const C100 = (v) => n0.format(Math.round(v));                       // 18,4% -> "18" de cada 100
const QTD100 = (pp) => `${C100(Math.abs(pp))} ${pp < 0 ? "a menos" : "a mais"} em cada 100`;
const ENTRE100 = (lo, hi) => {
  const a = Math.round(Math.min(Math.abs(lo), Math.abs(hi))), b = Math.round(Math.max(Math.abs(lo), Math.abs(hi)));
  return lo < 0 && hi > 0 ? `algo entre ${Math.round(Math.abs(lo))} a menos e ${Math.round(hi)} a mais` : `algo entre ${Math.max(1, a)} e ${b}`;
};
const comprovado = (e) => e.ajustado_lo > 0 || e.ajustado_hi < 0;
const CONSIDERANDO = "mesmo considerando idioma, aparelho, horário, tema e época";

// Barras simples "voltam de cada 100" em HTML: se adaptam à largura (celular incluído).
function barras100(itens, max = 30) {
  return `<div class="b100" role="img" aria-label="Voltam de cada 100 pessoas">${itens.map((it) => `
    <span class="nome">${esc(it.nome)}</span>
    <span class="barra"><i style="width:${(100 * Math.min(it.valor, max)) / max}%;background:${it.cor || "var(--marca)"}"></i></span>
    <b>${C100(it.valor)}</b>`).join("")}</div>`;
}

// Lista "o que faz diferença": barra do tamanho do efeito, sem eixo nem jargão.
function listaFatores(itens, cor) {
  const max = Math.max(1, ...itens.map((e) => Math.abs(e.ajustado_pp)));
  return `<div class="fatores">${itens.map((e) => `
    <div class="fator" tabindex="0" data-dica="${esc(`<b>${esc(nomeEfeito(e))}</b><br>Voltam ${C100(e.retorno_pct)} de cada 100 (${N(e.n)} pessoas). Comparação: ${esc(rot(e.referencia))}, ${C100(e.retorno_ref_pct)} de cada 100.`)}">
      <span class="nome">${esc(nomeEfeito(e))}</span>
      <span class="barra"><i style="width:${(100 * Math.abs(e.ajustado_pp)) / max}%;background:${cor}"></i></span>
      <span class="valor"><b>${QTD100(e.ajustado_pp)}</b><br><small>${ENTRE100(e.ajustado_lo, e.ajustado_hi)}</small></span>
    </div>`).join("")}</div>`;
}

const ACHADOS = [
  { id: "chegada", titulo: "Quem chega só testando ou pedindo imagem quase não volta",
    decisao: "Mudar a primeira resposta para quem só está testando (mostrar exemplos do que o assistente faz bem) e, para quem pede imagem, oferecer uma alternativa útil em vez de só dizer “não consigo”. Validar com um teste A/B." },
  { id: "gpt4", titulo: "Usar GPT-4 não faz as pessoas voltarem mais",
    decisao: "Não pagar por um modelo mais caro esperando reter mais gente. O investimento rende mais na primeira experiência." },
  { id: "celular", titulo: "Quem usa pelo celular volta menos",
    decisao: "Revisar a experiência no celular (velocidade, teclado, respostas longas demais para a tela) e testar uma versão melhorada em A/B." },
];

async function paginaAnalise(el) {
  $("#filtros").hidden = true;
  const d = await api("/api/analise");
  const g = d.geral;
  const ef = d.efeitos.filter((e) => e.natureza !== "mediador" && e.suficiente && e.ajustado_pp != null);
  const pega = (nivel, fator) => ef.find((e) => e.nivel === nivel && (!fator || e.fator === fator));
  const t = Object.fromEntries(d.testes.map((x) => [x.nome, x]));
  const teste = pega("saudacao_teste"), imagem = pega("imagem_midia"), gpt4 = pega("True", "gpt4"), celular = pega("celular");

  const cardAchado = (a) => {
    let barras = "", efeito = "";
    if (a.id === "chegada") {
      barras = barras100([
        { nome: "Só cumprimenta ou testa", valor: teste.retorno_pct, cor: "var(--ruim)" },
        { nome: "Pede imagem, vídeo ou áudio", valor: imagem.retorno_pct, cor: "var(--ruim)" },
        { nome: "Média de todos", valor: g.retorno_pct, cor: "var(--neutro)" },
      ]);
      efeito = `Faz diferença: <b>${QTD100(teste.ajustado_pp)}</b> e <b>${QTD100(imagem.ajustado_pp)}</b>, ${CONSIDERANDO}. São ${C100(100 * (teste.n + imagem.n) / g.usuarios)} de cada 100 pessoas que chegam.`;
    } else if (a.id === "gpt4") {
      barras = barras100([
        { nome: "1ª conversa com GPT-4", valor: gpt4.retorno_pct },
        { nome: "1ª conversa com GPT-3.5", valor: gpt4.retorno_ref_pct, cor: "var(--marca-clara)" },
      ]);
      efeito = `Não faz diferença comprovada, ${CONSIDERANDO} (${ENTRE100(gpt4.ajustado_lo, gpt4.ajustado_hi)} em cada 100). E não é porque “quem escolhe GPT-4 já é mais fiel”: medimos isso também (abaixo).`;
    } else {
      barras = barras100([
        { nome: "Celular", valor: celular.retorno_pct, cor: "var(--ruim)" },
        { nome: "Computador", valor: celular.retorno_ref_pct, cor: "var(--neutro)" },
      ]);
      efeito = `Faz diferença: <b>${QTD100(celular.ajustado_pp)}</b> (${ENTRE100(celular.ajustado_lo, celular.ajustado_hi)}), ${CONSIDERANDO}.`;
    }
    return `<div class="cartao achado"><h2>${a.titulo}</h2><p class="ajuda">Voltaram em até 7 dias, de cada 100 pessoas:</p>${barras}
      <p>${efeito}</p><div class="decisao"><b>O que fazer:</b> ${a.decisao}</div></div>`;
  };

  const afasta = ef.filter((e) => comprovado(e) && e.ajustado_pp < 0).sort((a, b) => a.ajustado_pp - b.ajustado_pp);
  const aproxima = ef.filter((e) => comprovado(e) && e.ajustado_pp > 0 && e.fator !== "faixa_horaria");
  const medida = ef.filter((e) => comprovado(e) && e.fator === "faixa_horaria");
  const neutros = ef.filter((e) => !comprovado(e)).sort((a, b) => Math.abs(b.ajustado_pp) - Math.abs(a.ajustado_pp));

  const regime = d.gpt4.filter((x) => x.metodo !== "IPW");
  const ipw = d.gpt4.find((x) => x.metodo === "IPW");
  const ch = d.semana.filter((s) => s.segmento === "chegada");
  const antes = 100 * ch.reduce((a, s) => a + s.peso_antes * s.retorno_antes, 0);
  const naSemana = 100 * ch.reduce((a, s) => a + s.peso_semana * s.retorno_semana, 0);
  const real = ch.find((s) => s.grupo === "pedido real");
  const sem = d.semana.length ? d.semana[0].semana : null;

  el.innerHTML = `
    <h1>Análise completa</h1>
    <p class="pergunta">O que faz uma pessoa que experimentou o assistente voltar a usá-lo em até 7 dias? Esta tela resume o que concluímos com toda a base: <b>${N(g.usuarios)} pessoas</b>, das quais <b>${C100(g.retorno_pct)} de cada 100 voltaram</b> em outro dia.</p>
    <div class="grade g3">${ACHADOS.map(cardAchado).join("")}</div>

    <div class="cartao" style="margin-bottom:16px"><h2>O que faz diferença no retorno</h2>
      <p class="ajuda">Para cada característica da primeira experiência, quantas pessoas a mais ou a menos voltam em cada 100, ${CONSIDERANDO}. Ordenado do maior para o menor efeito. O valor entre parênteses mostra a faixa provável.</p>
      <div class="grade g2" style="margin:0">
        <div><h3 class="bloco ruim">Afasta as pessoas</h3>${listaFatores(afasta, "var(--ruim)")}
          ${aproxima.length ? `<h3 class="bloco bom">Aproxima as pessoas</h3>${listaFatores(aproxima, "var(--bom)")}` : ""}
          ${medida.length ? `<h3 class="bloco atencao">Efeito da forma de medir, não do produto</h3>${listaFatores(medida, "var(--atencao)")}<p class="ajuda">Como contamos o retorno por dia, quem começa à noite e continua depois da meia-noite já conta como “voltou outro dia”. Não é algo que o produto controle.</p>` : ""}</div>
        <div><h3 class="bloco neutro">Não faz diferença comprovada</h3>
          <p class="ajuda">Pode até haver alguma diferença, mas ela é pequena demais para separar do acaso com estes dados.</p>
          <ul class="chips">${neutros.map((e) => `<li data-dica="${esc(`<b>${esc(nomeEfeito(e))}</b><br>${QTD100(e.ajustado_pp)} (${ENTRE100(e.ajustado_lo, e.ajustado_hi)})`)}" tabindex="0">${esc(nomeEfeito(e))}</li>`).join("")}</ul></div>
      </div>
      ${explicacao(`Comparamos quem tem cada característica com quem não tem, mas entre pessoas parecidas em todo o resto. Assim, por exemplo, a diferença do celular não vem de quem usa celular pedir temas diferentes. A faixa provável é a margem de erro: com esse número de pessoas, o efeito real deve estar dentro dela. Quando a faixa inclui o zero, não dá para afirmar que há diferença.`,
        "Regressão logística com todos os fatores e a época (regime de oferta do GPT-4) como controle; efeito marginal médio em pontos percentuais, intervalo de confiança de 95% pelo método delta, erros robustos (HC1). Turnos e número de temas no 1º dia ficam fora por serem consequência do engajamento (mediadores). Grupos com menos de 30 pessoas não aparecem.", { "Efeitos": d.sql.efeitos })}
    </div>

    <div class="grade g2">
      <div class="cartao"><h2>O GPT-4 faz diferença ou é quem escolhe?</h2>
        <p class="grande-frase">Usar GPT-4 <b>não faz</b> as pessoas voltarem mais.</p>
        <p class="ajuda">Uma dúvida comum: quem escolhe o GPT-4 talvez já seja mais engajado, e isso esconderia ou inflaria o efeito. Medimos de três jeitos, e nenhum mostra diferença comprovada:</p>
        <table><tr><th>Forma de medir</th><th class="num">Em cada 100 pessoas</th></tr>
          ${regime.map((x) => `<tr><td>${x.detalhe.startsWith("GPT-4 opcional") ? "Quando a pessoa escolhia o GPT-4" : "Quando o GPT-4 era o padrão para todos"}</td><td class="num">${ENTRE100(x.lo, x.hi)}</td></tr>`).join("")}
          ${ipw ? `<tr><td>Comparando pessoas parecidas</td><td class="num">${ENTRE100(ipw.lo, ipw.hi)}</td></tr>` : ""}
        </table>
        <p class="ajuda" style="margin-top:10px">Todas as faixas vão de “alguns a menos” a “alguns a mais”: o efeito pode ser zero. E, como escolher ou não o GPT-4 dá o mesmo resultado, não há sinal de que “quem escolhe já volta mais”.</p>
        ${explicacao("Se o efeito viesse de quem escolhe, ele apareceria quando o GPT-4 era opcional e sumiria quando todos usavam. Os dois resultados são iguais e próximos de zero.", `Diferença de proporções por regime de oferta (abr–jun/23 e nov/23: opcional; dez/23–abr/24: ~90% das conversas) e ponderação pelo inverso do escore de propensão (IPW) com época, horário, dia, dispositivo, idioma, tamanho da 1ª mensagem e tema${ipw ? ` (${esc(ipw.detalhe).replace("SMD máx.", "maior desequilíbrio entre grupos")})` : ""}; intervalos de 95% (Newcombe e bootstrap).`, { "GPT-4": d.sql.gpt4 })}
      </div>
      <div class="cartao"><h2>${sem ? `A semana de ${DATA(sem)}: por que o retorno caiu?` : "A semana analisada"}</h2>
        <p class="ajuda">Voltaram em até 7 dias, de cada 100 pessoas:</p>
        ${barras100([{ nome: "4 semanas anteriores", valor: antes, cor: "var(--neutro)" }, { nome: `Semana de ${sem ? DATA(sem).slice(0, 5) : ""}`, valor: naSemana, cor: "var(--ruim)" }])}
        <p><b>Não mudou o tipo de pessoa que chegou</b>: ${real ? `${C100(100 * real.peso_semana)} de cada 100 chegaram com um pedido real, contra ${C100(100 * real.peso_antes)} antes` : "o perfil foi o mesmo"}. <b>Mudou o retorno de quem chegou</b>${real ? `: entre quem chegou com pedido real, ${C100(100 * real.retorno_antes)} de cada 100 voltavam; nessa semana, ${C100(100 * real.retorno_semana)}` : ""}.</p>
        <p class="achado">Mas atenção: chegam cerca de 45 pessoas por semana, e com tão pouca gente o número oscila bastante por acaso. Olhando todas as semanas juntas, <b>não há diferença comprovada entre elas</b>. Para decidir, acompanhe a tendência de várias semanas, não uma semana isolada.</p>
        ${explicacao("Separamos a queda em duas partes: a que viria de chegarem mais pessoas de um tipo que volta menos (perfil) e a que vem de cada tipo voltar menos do que antes (taxa). Quase toda a queda foi de taxa.", `Decomposição de Kitagawa contra as 4 semanas anteriores; diferença ${t.semana_analisada ? `${n1.format(t.semana_analisada.valor)} pp (IC 95% ${n1.format(t.semana_analisada.lo)} a ${n1.format(t.semana_analisada.hi)}; p = ${n1.format(t.semana_analisada.p)})` : ""}; teste qui-quadrado de homogeneidade entre as semanas com 30 pessoas ou mais${t.homogeneidade_semanas ? ` (p = ${n1.format(t.homogeneidade_semanas.p)})` : ""}.`, { "Decomposição": d.sql.semana, "Testes": d.sql.testes })}
      </div>
    </div>

    <div class="grade g2">
      <div class="cartao"><h2>O número muda conforme a forma de medir?</h2>
        <p class="ajuda">Cada linha muda uma única regra de contagem. Quase nada muda, exceto contar quem volta <b>no mesmo dia</b>, que sobe bastante o número. Por isso deixamos claro qual regra usamos.</p>
        <div class="rolagem"><table><tr><th>Regra</th><th class="num">Voltam de cada 100</th></tr>
        ${d.sensibilidade.map((s) => `<tr${s.cenario.startsWith("referência") ? ' class="ref"' : ""}><td>${esc(REGRAS[s.cenario] || s.cenario)}</td><td class="num">${C100(s.retorno_pct)}</td></tr>`).join("")}</table></div>
      </div>
      <div class="cartao"><h2>Como sabemos o tema de cada conversa?</h2><p>${COMO_CLASSIFICAMOS.simples}</p>
        <details><summary>Detalhe técnico</summary><div class="tecnico">${COMO_CLASSIFICAMOS.tecnico}</div></details>
        <h2 style="margin-top:18px">O que isto prova e o que não prova</h2>
        <p><b>Prova</b> que quem chega só testando ou pedindo imagem volta muito menos, e que o modelo não muda o retorno, mesmo considerando idioma, aparelho, horário, tema e época. <b>Não prova</b> que mudar a primeira experiência fará essas pessoas voltarem: pode haver motivos que os dados não mostram (motivação, necessidade). Por isso cada decisão vem com um teste A/B.</p>
      </div>
    </div>`;
  return d.procedencia;
}

const PAGINAS = { explorar: paginaExplorar, analise: paginaAnalise };

function rodape(p) {
  $("#rodape").innerHTML = `<b>Fonte:</b> ${esc(p.fonte)} · ${N(p.linhas_brasil)} conversas do Brasil, de ${N(p.linhas_fonte)} na base ·
    <b>Atualizado em</b> ${new Date(p.carga_em).toLocaleString("pt-BR")} (versão ${esc(p.versao_codigo)}) ·
    ${p.reconciliacao_ok ? "números conferidos contra a base bruta ✓" : "<b>ATENÇÃO: a conferência contra a base bruta falhou</b>"}<br>
    <b>Definição:</b> ${esc(p.definicao_retorno)} Nenhuma tela mostra texto de conversa, IP ou navegador; grupos com menos de 30 pessoas não têm número próprio.`;
}

async function mostrar() {
  const [aba, qs] = (location.hash.slice(1) || "explorar").split("?");
  const pagina = PAGINAS[aba] ? aba : "explorar";
  document.querySelectorAll("nav a").forEach((a) => (a.dataset.aba === pagina ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const el = $("#conteudo");
  el.innerHTML = `<p class="estado">Carregando…</p>`;
  try {
    rodape(await PAGINAS[pagina](el, new URLSearchParams(qs || "")));
    ligarDicas(el);
  } catch (e) {
    el.innerHTML = `<p class="erro">${esc(e.message)}</p>`;
  }
}

window.addEventListener("hashchange", mostrar);
mostrar();
