// =====================================================================
// Aprovação 360° — componentes de tela reutilizáveis
// =====================================================================
(function () {
  'use strict';
  var h = A360U.h;

  // Campo de formulário com rótulo, ajuda e mensagem de erro
  function campo(rotulo, input, ajuda) {
    var id = input.id || ('c' + Math.random().toString(36).slice(2, 9));
    input.id = id;
    var erro = h('div', { class: 'campo-erro', role: 'alert', hidden: true });
    var el = h('div', { class: 'campo' }, h('label', { for: id }, rotulo), input, ajuda ? h('div', { class: 'campo-ajuda' }, ajuda) : null, erro);
    el.erro = function (msg) { erro.textContent = msg || ''; erro.hidden = !msg; input.classList.toggle('invalido', !!msg); };
    return el;
  }
  function entrada(props) { return h('input', Object.assign({ type: 'text' }, props)); }
  function selecao(opcoes, valor, props) {
    var s = h('select', props || {});
    opcoes.forEach(function (o) { var op = h('option', { value: o[0] }, o[1]); if (String(o[0]) === String(valor)) op.selected = true; s.appendChild(op); });
    return s;
  }

  // Painel lateral (no celular ocupa a tela). Esc ou clique fora fecha.
  function painel(titulo, conteudo, acoes) {
    var fundo = h('div', { class: 'painel-fundo' });
    var caixa = h('div', { class: 'painel', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
    function fechar() { document.removeEventListener('keydown', esc); fundo.remove(); }
    function esc(e) { if (e.key === 'Escape') fechar(); }
    caixa.appendChild(h('div', { class: 'painel-topo' }, h('h2', null, titulo), h('button', { class: 'btn-icone', 'aria-label': 'Fechar', onclick: fechar }, '×')));
    caixa.appendChild(h('div', { class: 'painel-corpo' }, conteudo));
    if (acoes) caixa.appendChild(h('div', { class: 'painel-acoes' }, acoes));
    fundo.appendChild(caixa);
    fundo.addEventListener('mousedown', function (e) { if (e.target === fundo) fechar(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(fundo);
    var primeiro = caixa.querySelector('input, select, textarea'); if (primeiro) primeiro.focus();
    return { fechar: fechar, caixa: caixa };
  }

  function chipStatus(st) {
    var s = A360U.STATUS[st] || A360U.STATUS.nao_iniciado;
    return h('span', { class: 'chip ' + s.cls }, '● ' + s.label);
  }

  function barra(pct, cls) {
    return h('div', { class: 'barra' }, h('div', { class: 'barra-cheia ' + (cls || ''), style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
  }

  function vazio(titulo, texto, botoes) {
    return h('div', { class: 'cartao vazio' }, h('p', null, h('strong', null, titulo)), texto ? h('p', null, texto) : null, botoes ? h('div', { class: 'barra-acoes centro-h' }, botoes) : null);
  }

  // Mensagem de erro do banco em português
  function erroBanco(e) {
    var m = String((e && (e.message || e.details)) || e || '');
    if (/a360_concursos_codigo_uq|duplicate key.*codigo/i.test(m)) return 'Já existe um concurso com esse código.';
    if (/a360_concursos_datas/.test(m)) return 'A data da prova não pode ser anterior à data de publicação.';
    if (/codigo_check|a360_concursos_codigo_check/.test(m)) return 'O código não pode ter espaços e deve ter até 40 caracteres.';
    if (/link_edital_check|url_check|url_projeto/.test(m)) return 'Informe um endereço que comece com http:// ou https://';
    if (/function .*a360_importar_edital.* does not exist|Could not find the function/i.test(m)) return 'Falta instalar a função de importação no banco: rode o arquivo supabase/02-importar-edital.sql no SQL Editor do Supabase.';
    if (/JWT|expired|not authenticated|Sessão expirada/i.test(m)) return 'Sua sessão expirou. Saia e entre de novo.';
    if (/fetch|network|Failed/i.test(m)) return 'Sem conexão com o banco. Verifique a internet.';
    return m || 'Erro desconhecido.';
  }

  // Gráfico de linha simples em SVG (0 a 100%), com rótulos e valores
  function graficoLinha(pontos) {
    var NS = 'http://www.w3.org/2000/svg';
    function el(t, a) { var e = document.createElementNS(NS, t); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }
    var W = 640, H = 220, ml = 36, mr = 12, mt = 14, mb = 30, n = pontos.length;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Evolução do percentual de acerto: ' + pontos.map(function (p) { return p.rotulo + ' ' + String(p.valor).replace('.', ',') + '%'; }).join(', '), class: 'grafico' });
    function x(i) { return n === 1 ? (ml + W - mr) / 2 : ml + i * (W - ml - mr) / (n - 1); }
    function y(v) { return mt + (100 - v) * (H - mt - mb) / 100; }
    [0, 25, 50, 75, 100].forEach(function (v) {
      svg.appendChild(el('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), stroke: '#E3E8EF', 'stroke-width': 1 }));
      var t = el('text', { x: ml - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5B6472' }); t.textContent = v + '%'; svg.appendChild(t);
    });
    if (n > 1) svg.appendChild(el('polyline', { points: pontos.map(function (p, i) { return x(i) + ',' + y(p.valor); }).join(' '), fill: 'none', stroke: '#0A6CDB', 'stroke-width': 2.5 }));
    pontos.forEach(function (p, i) {
      svg.appendChild(el('circle', { cx: x(i), cy: y(p.valor), r: 4, fill: '#0A6CDB' }));
      var v = el('text', { x: x(i), y: y(p.valor) - 9, 'text-anchor': 'middle', 'font-size': 11, fill: '#1B2F48', 'font-weight': 600 }); v.textContent = String(p.valor).replace('.', ','); svg.appendChild(v);
      if (n <= 12 || i % Math.ceil(n / 12) === 0) { var r = el('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', 'font-size': 11, fill: '#5B6472' }); r.textContent = p.rotulo; svg.appendChild(r); }
    });
    return svg;
  }

  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return false; });
    return Promise.resolve(false);
  }

  window.A360UI = { campo: campo, entrada: entrada, selecao: selecao, painel: painel, chipStatus: chipStatus, barra: barra, vazio: vazio, erroBanco: erroBanco, copiar: copiar, graficoLinha: graficoLinha };
})();
