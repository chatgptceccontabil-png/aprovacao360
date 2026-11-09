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

  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return false; });
    return Promise.resolve(false);
  }

  window.A360UI = { campo: campo, entrada: entrada, selecao: selecao, painel: painel, chipStatus: chipStatus, barra: barra, vazio: vazio, erroBanco: erroBanco, copiar: copiar };
})();
