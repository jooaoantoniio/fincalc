/* ==========================================================
   FinCalc — lógica das calculadoras
   Cada página define <body data-page="..."> e só o módulo
   correspondente é inicializado.
   ========================================================== */

// ---------- Utilitários ----------
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number.isFinite(v) ? v : 0);
const pct = (v) => (v * 100).toFixed(2).replace(".", ",") + "%";

const $ = (sel) => document.querySelector(sel);
const num = (id) => {
  const raw = String($("#" + id).value).replace(",", ".");
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : 0;
};

const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* armazenamento indisponível */
    }
  },
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function showResult(...ids) {
  ids.forEach((id) => $("#" + id).classList.add("show"));
}

// Destaca o link da página atual no menu
function markActiveNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.getAttribute("href") === page) a.classList.add("active");
  });
}

// ---------- Juros compostos ----------
function initCalculadora() {
  $("#form-juros").addEventListener("submit", (e) => {
    e.preventDefault();

    const inicial = num("inicial");
    const aporte = num("aporte");
    const taxaInformada = num("taxa") / 100;
    const periodo = num("periodo");
    const taxaTipo = $("#taxa-tipo").value;
    const periodoTipo = $("#periodo-tipo").value;

    // Converte tudo para base mensal
    const taxa = taxaTipo === "anual" ? Math.pow(1 + taxaInformada, 1 / 12) - 1 : taxaInformada;
    const meses = Math.round(periodoTipo === "anos" ? periodo * 12 : periodo);

    if (meses <= 0) return alert("Informe um período maior que zero.");

    let saldo = inicial;
    let investido = inicial;
    const linhas = [];

    for (let m = 1; m <= meses; m++) {
      const juros = saldo * taxa;
      saldo += juros + aporte;
      investido += aporte;
      linhas.push({ m, juros, investido, saldo });
    }

    $("#res-total").textContent = fmt(saldo);
    $("#res-investido").textContent = fmt(investido);
    $("#res-juros").textContent = fmt(saldo - investido);
    $("#res-taxa").textContent = pct(taxa) + " a.m.";

    $("#tabela-juros tbody").innerHTML = linhas
      .map(
        (l) =>
          `<tr><td>${l.m}</td><td>${fmt(l.juros)}</td><td>${fmt(l.investido)}</td><td>${fmt(l.saldo)}</td></tr>`
      )
      .join("");

    showResult("resultado", "resultado-tabela");
  });
}

// ---------- Parcelamento (Price e SAC) ----------
function initParcelamento() {
  $("#form-parcelamento").addEventListener("submit", (e) => {
    e.preventDefault();

    const valor = num("valor");
    const entrada = num("entrada");
    const taxa = num("taxa") / 100;
    const n = Math.round(num("parcelas"));
    const sistema = $("#sistema").value;
    const principal = valor - entrada;

    if (principal <= 0) return alert("A entrada deve ser menor que o valor do bem.");
    if (n <= 0) return alert("Informe o número de parcelas.");

    let saldo = principal;
    let totalPago = 0;
    const linhas = [];

    for (let i = 1; i <= n; i++) {
      const juros = saldo * taxa;
      let amortizacao, parcela;

      if (sistema === "price") {
        parcela = taxa === 0 ? principal / n : (principal * taxa) / (1 - Math.pow(1 + taxa, -n));
        amortizacao = parcela - juros;
      } else {
        amortizacao = principal / n;
        parcela = amortizacao + juros;
      }

      saldo = Math.max(saldo - amortizacao, 0);
      totalPago += parcela;
      linhas.push({ i, parcela, juros, amortizacao, saldo });
    }

    const primeira = linhas[0].parcela;
    const ultima = linhas[linhas.length - 1].parcela;

    $("#res-parcela").textContent = sistema === "price" ? fmt(primeira) : `${fmt(primeira)} → ${fmt(ultima)}`;
    $("#res-parcela-label").textContent = sistema === "price" ? "Valor da parcela" : "Primeira → última parcela";
    $("#res-financiado").textContent = fmt(principal);
    $("#res-total").textContent = fmt(totalPago + entrada);
    $("#res-juros").textContent = fmt(totalPago - principal);

    $("#tabela-parcelas tbody").innerHTML = linhas
      .map(
        (l) =>
          `<tr><td>${l.i}</td><td>${fmt(l.parcela)}</td><td>${fmt(l.juros)}</td><td>${fmt(l.amortizacao)}</td><td>${fmt(l.saldo)}</td></tr>`
      )
      .join("");

    showResult("resultado", "resultado-tabela");
  });
}

// ---------- Salário líquido (CLT) ----------
// Tabelas vigentes em 2026 — confira os valores oficiais a cada ano.
const INSS_FAIXAS = [
  { ate: 1621.0, aliquota: 0.075 },
  { ate: 2902.84, aliquota: 0.09 },
  { ate: 4354.27, aliquota: 0.12 },
  { ate: 8475.55, aliquota: 0.14 },
];

const IRRF_FAIXAS = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
];

const DEDUCAO_DEPENDENTE = 189.59;
const DESCONTO_SIMPLIFICADO = 607.2;

// Redutor da Lei 15.270/2025 (isenção até R$ 5.000)
const REDUTOR_LIMITE_ISENCAO = 5000;
const REDUTOR_LIMITE_FINAL = 7350;
const REDUTOR_VALOR_MAX = 312.89;

function calcularINSS(bruto) {
  let inss = 0;
  let anterior = 0;
  for (const faixa of INSS_FAIXAS) {
    if (bruto <= anterior) break;
    inss += (Math.min(bruto, faixa.ate) - anterior) * faixa.aliquota;
    anterior = faixa.ate;
  }
  return inss;
}

function calcularIRRF(bruto, inss, dependentes, pensao) {
  const deducoesLegais = inss + dependentes * DEDUCAO_DEPENDENTE + pensao;
  // Usa o desconto mais vantajoso: deduções legais ou simplificado
  const deducao = Math.max(deducoesLegais, DESCONTO_SIMPLIFICADO);
  const base = Math.max(bruto - deducao, 0);

  const faixa = IRRF_FAIXAS.find((f) => base <= f.ate);
  let imposto = Math.max(base * faixa.aliquota - faixa.deducao, 0);

  let redutor = 0;
  if (bruto <= REDUTOR_LIMITE_ISENCAO) {
    redutor = Math.min(REDUTOR_VALOR_MAX, imposto);
  } else if (bruto <= REDUTOR_LIMITE_FINAL) {
    redutor = Math.min(Math.max(978.62 - 0.133145 * bruto, 0), imposto);
  }
  imposto -= redutor;

  return { base, imposto, aliquota: faixa.aliquota, simplificado: deducao === DESCONTO_SIMPLIFICADO && deducoesLegais < DESCONTO_SIMPLIFICADO };
}

function initSalario() {
  $("#form-salario").addEventListener("submit", (e) => {
    e.preventDefault();

    const bruto = num("bruto");
    const dependentes = Math.max(Math.round(num("dependentes")), 0);
    const pensao = num("pensao");
    const outros = num("outros");

    if (bruto <= 0) return alert("Informe o salário bruto.");

    const inss = calcularINSS(bruto);
    const ir = calcularIRRF(bruto, inss, dependentes, pensao);
    const liquido = bruto - inss - ir.imposto - pensao - outros;

    $("#res-liquido").textContent = fmt(liquido);
    $("#res-bruto").textContent = fmt(bruto);
    $("#res-inss").textContent = "− " + fmt(inss);
    $("#res-inss-aliq").textContent = pct(inss / bruto) + " efetiva";
    $("#res-irrf").textContent = "− " + fmt(ir.imposto);
    $("#res-irrf-aliq").textContent = pct(ir.imposto / bruto) + " efetiva";
    $("#res-pensao").textContent = "− " + fmt(pensao);
    $("#res-outros").textContent = "− " + fmt(outros);
    $("#res-base").textContent = fmt(ir.base) + (ir.simplificado ? " (desconto simplificado)" : "");

    showResult("resultado");
  });
}

// ---------- Orçamento mensal ----------
function initOrcamento() {
  const KEY = "fincalc:orcamento";
  let itens = storage.get(KEY, []);

  const form = $("#form-orcamento");

  function render() {
    const receitas = itens.filter((i) => i.tipo === "receita");
    const despesas = itens.filter((i) => i.tipo === "despesa");
    const totalR = receitas.reduce((s, i) => s + i.valor, 0);
    const totalD = despesas.reduce((s, i) => s + i.valor, 0);
    const saldo = totalR - totalD;

    $("#total-receitas").textContent = fmt(totalR);
    $("#total-despesas").textContent = fmt(totalD);
    const saldoEl = $("#saldo");
    saldoEl.textContent = fmt(saldo);
    saldoEl.className = "value " + (saldo >= 0 ? "positive" : "negative");

    const lista = (arr) =>
      arr.length
        ? arr
            .map(
              (i) => `<li>
                <div class="grow"><div>${escapeHtml(i.descricao)}</div>
                <div class="tag">${escapeHtml(i.categoria || "")}</div></div>
                <strong>${fmt(i.valor)}</strong>
                <button class="btn btn-small" data-id="${i.id}" aria-label="Remover">✕</button>
              </li>`
            )
            .join("")
        : `<li class="empty">Nenhum item.</li>`;

    $("#lista-receitas").innerHTML = lista(receitas);
    $("#lista-despesas").innerHTML = lista(despesas);

    // Regra 50/30/20 em relação à receita
    const porCategoria = (cat) => despesas.filter((d) => d.categoria === cat).reduce((s, d) => s + d.valor, 0);
    const regra = [
      { cat: "Necessidades", meta: 0.5 },
      { cat: "Desejos", meta: 0.3 },
      { cat: "Poupança/Investimento", meta: 0.2 },
    ];

    $("#regra-503020").innerHTML = totalR
      ? regra
          .map(({ cat, meta }) => {
            const gasto = porCategoria(cat);
            const limite = totalR * meta;
            const uso = limite ? gasto / limite : 0;
            const cls = cat === "Poupança/Investimento" ? (uso >= 1 ? "done" : "") : uso > 1 ? "over" : "";
            return `<div class="goal">
              <div class="goal-header"><strong>${cat} (${meta * 100}%)</strong><span>${fmt(gasto)} / ${fmt(limite)}</span></div>
              <div class="progress"><div class="progress-bar ${cls}" style="width:${Math.min(uso * 100, 100)}%"></div></div>
            </div>`;
          })
          .join("")
      : `<p class="empty">Adicione uma receita para ver a análise.</p>`;
  }

  function toggleCategoria() {
    $("#grupo-categoria").style.display = $("#tipo").value === "despesa" ? "block" : "none";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const descricao = $("#descricao").value.trim();
    const valor = num("valor");
    const tipo = $("#tipo").value;
    if (!descricao || valor <= 0) return alert("Preencha descrição e um valor maior que zero.");

    itens.push({
      id: uid(),
      descricao,
      valor,
      tipo,
      categoria: tipo === "despesa" ? $("#categoria").value : "Receita",
    });
    storage.set(KEY, itens);
    form.reset();
    toggleCategoria();
    render();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    itens = itens.filter((i) => i.id !== btn.dataset.id);
    storage.set(KEY, itens);
    render();
  });

  $("#limpar").addEventListener("click", () => {
    if (!itens.length || !confirm("Apagar todos os itens do orçamento?")) return;
    itens = [];
    storage.set(KEY, itens);
    render();
  });

  $("#tipo").addEventListener("change", toggleCategoria);
  toggleCategoria();
  render();
}

// ---------- Metas financeiras ----------
function mesesParaMeta(alvo, atual, aporte, taxa) {
  if (atual >= alvo) return 0;
  if (aporte <= 0 && taxa <= 0) return Infinity;
  let saldo = atual;
  let meses = 0;
  while (saldo < alvo && meses < 1200) {
    saldo = saldo * (1 + taxa) + aporte;
    meses++;
  }
  return saldo >= alvo ? meses : Infinity;
}

function formatarPrazo(meses) {
  if (meses === 0) return "Meta atingida! 🎉";
  if (!Number.isFinite(meses)) return "Inalcançável com esses valores";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anos) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (resto) partes.push(`${resto} ${resto > 1 ? "meses" : "mês"}`);
  const data = new Date();
  data.setMonth(data.getMonth() + meses);
  return `${partes.join(" e ")} (${data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})`;
}

function initMetas() {
  const KEY = "fincalc:metas";
  let metas = storage.get(KEY, []);
  const form = $("#form-metas");

  function render() {
    const lista = $("#lista-metas");
    if (!metas.length) {
      lista.innerHTML = `<p class="empty">Nenhuma meta cadastrada ainda.</p>`;
      return;
    }

    lista.innerHTML = metas
      .map((m) => {
        const progresso = Math.min(m.atual / m.alvo, 1);
        const meses = mesesParaMeta(m.alvo, m.atual, m.aporte, m.taxa / 100);
        return `<div class="goal">
          <div class="goal-header">
            <strong>${escapeHtml(m.nome)}</strong>
            <button class="btn btn-small" data-id="${m.id}" aria-label="Remover">✕</button>
          </div>
          <div class="progress"><div class="progress-bar ${progresso >= 1 ? "done" : ""}" style="width:${progresso * 100}%"></div></div>
          <div class="goal-info">${fmt(m.atual)} de ${fmt(m.alvo)} · ${Math.round(progresso * 100)}%</div>
          <div class="goal-info">Aporte de ${fmt(m.aporte)}/mês a ${String(m.taxa).replace(".", ",")}% a.m. → <strong>${formatarPrazo(meses)}</strong></div>
        </div>`;
      })
      .join("");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("#nome").value.trim();
    const alvo = num("alvo");
    if (!nome || alvo <= 0) return alert("Informe o nome e o valor da meta.");

    metas.push({ id: uid(), nome, alvo, atual: num("atual"), aporte: num("aporte"), taxa: num("taxa") });
    storage.set(KEY, metas);
    form.reset();
    render();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    metas = metas.filter((m) => m.id !== btn.dataset.id);
    storage.set(KEY, metas);
    render();
  });

  render();
}

// ---------- Inicialização ----------
const modules = {
  calculadora: initCalculadora,
  parcelamento: initParcelamento,
  salario: initSalario,
  orcamento: initOrcamento,
  metas: initMetas,
};

document.addEventListener("DOMContentLoaded", () => {
  markActiveNav();
  const init = modules[document.body.dataset.page];
  if (init) init();
  const year = $("#ano");
  if (year) year.textContent = new Date().getFullYear();
});
