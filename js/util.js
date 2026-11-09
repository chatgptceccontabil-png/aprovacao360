// =====================================================================
// Aprovação 360° — utilitários (datas, textos e criação de elementos)
// =====================================================================
(function (raiz) {
  'use strict';

  // RN26: "hoje" na data local de São Paulo, em ISO (AAAA-MM-DD)
  function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function dataBR(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function addDias(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function difDias(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000); }

  // Aceita AAAA-MM-DD ou DD/MM/AAAA; devolve ISO ou null
  function paraISO(txt) {
    var s = String(txt || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) { m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) m = [m[0], m[3], m[2], m[1]]; }
    if (!m) return null;
    var iso = m[1] + '-' + m[2] + '-' + m[3];
    var d = new Date(iso + 'T12:00:00Z');
    return (!isNaN(d) && d.toISOString().slice(0, 10) === iso) ? iso : null;
  }

  // RN22: texto normalizado (minúsculas, sem acentos, sem pontuação, espaços únicos)
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // RN22: similaridade por bigramas de Dice (0 a 1)
  function dice(a, b) {
    a = norm(a).replace(/ /g, ''); b = norm(b).replace(/ /g, '');
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    var m = {}, i, g, n = 0;
    for (i = 0; i < a.length - 1; i++) { g = a.substr(i, 2); m[g] = (m[g] || 0) + 1; }
    for (i = 0; i < b.length - 1; i++) { g = b.substr(i, 2); if (m[g] > 0) { m[g]--; n++; } }
    return 2 * n / (a.length + b.length - 2);
  }

  function num1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  function pct(a, q) { return q > 0 ? Math.round(a / q * 100) + '%' : '—'; }

  // Cria elementos com segurança (textos nunca viram HTML)
  // h('button', { class: 'btn', onclick: fn, disabled: true }, 'Texto', filho, [filhos])
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) anexar(el, arguments[i]);
    return el;
  }
  function anexar(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { anexar(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }

  var STATUS = {
    nao_iniciado: { label: 'Nunca visto', cls: 'st-nao' },
    em_estudo: { label: 'Em estudo', cls: 'st-estudo' },
    revisao: { label: 'Revisão', cls: 'st-revisao' },
    dominado: { label: 'Dominado', cls: 'st-dominado' }
  };

  raiz.A360U = { hojeISO: hojeISO, dataBR: dataBR, addDias: addDias, difDias: difDias, paraISO: paraISO, norm: norm, dice: dice, num1: num1, pct: pct, h: h, STATUS: STATUS };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.A360U;
})(typeof window !== 'undefined' ? window : globalThis);
