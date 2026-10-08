# FinCalc

Conjunto de calculadoras financeiras feito com HTML, CSS e JavaScript puro, sem dependências nem build.

🔗 **Acesse online:** https://jooaoantoniio.github.io/fincalc/

## Funcionalidades

| Página | Descrição |
| --- | --- |
| `index.html` | Página inicial com acesso a todas as ferramentas |
| `calculadora.html` | Juros compostos com valor inicial, aportes mensais e tabela de evolução |
| `parcelamento.html` | Simulação de financiamento pelas tabelas **Price** e **SAC** |
| `salario.html` | Salário líquido CLT com descontos de **INSS** e **IRRF** (tabelas de 2026) |
| `orcamento.html` | Controle de receitas e despesas com análise pela regra **50/30/20** |
| `metas.html` | Metas de economia com cálculo do prazo para atingir cada objetivo |

O orçamento e as metas ficam salvos no `localStorage` do navegador.

## Estrutura

```
fincalc/
├── index.html
├── calculadora.html
├── parcelamento.html
├── salario.html
├── orcamento.html
├── metas.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── README.md
```

Todas as páginas usam o mesmo `css/style.css` e `js/app.js`. Cada página informa qual módulo deve ser carregado pelo atributo `data-page` no `<body>`.

## Como usar

Abra o `index.html` no navegador. Se preferir rodar um servidor local:

```bash
# Python
python -m http.server 8000

# ou Node
npx serve .
```

Depois acesse `http://localhost:8000`.

## Atualizando as tabelas de impostos

As faixas de INSS e IRRF ficam no início da seção **Salário líquido** do `js/app.js` (`INSS_FAIXAS`, `IRRF_FAIXAS`, `DEDUCAO_DEPENDENTE`, `DESCONTO_SIMPLIFICADO` e as constantes do redutor). Confira os valores oficiais da Receita Federal e do INSS a cada ano.

## Aviso

Os resultados são apenas simulações e não substituem a orientação de um profissional.
