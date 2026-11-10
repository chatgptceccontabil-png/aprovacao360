// =====================================================================
// Aprovação 360° — Cronômetro (RN17) e Biblioteca de links (etapa 7)
// =====================================================================
(function () {
  'use strict';
  var h = A360U.h, UI = A360UI, U = A360U;
  window.A360T = window.A360T || {};
  var TIPOS = [['aula', 'Aula'], ['rapida', 'Aula rápida'], ['questoes', 'Questões'], ['revisao', 'Revisão'], ['simulado', 'Simulado'], ['lei_seca', 'Lei seca'], ['leitura', 'Leitura']];

  // ==================================================================
  // CRONÔMETRO
  // ==================================================================
  var cron = { ctx: null, timer: null };
  function chave() { return 'a360_cron_' + (cron.ctx && cron.ctx.estado.usuario ? cron.ctx.estado.usuario.id : 'x'); }
  function ler() { try { return JSON.parse(localStorage.getItem(chave()) || 'null'); } catch (e) { return null; } }
  function gravar(v) { try { if (v) localStorage.setItem(chave(), JSON.stringify(v)); else localStorage.removeItem(chave()); } catch (e) { /* navegador sem armazenamento: segue só na memória */ } cron.mem = v; }
  function atual() { return ler() || cron.mem || null; }
  function decorrido(s) { var fim = s.pausadoEm || Date.now(); return Math.max(0, fim - s.inicio - (s.pausas || 0)); }
  function fmt(ms) { var t = Math.floor(ms / 1000), hh = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = t % 60; return (hh ? hh + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); }

  function desenharCron() {
    var caixa = document.getElementById('cron'); if (!caixa) return;
    var s = atual();
    caixa.innerHTML = '';
    if (!s) {
      caixa.appendChild(h('button', { class: 'btn-cron', onclick: abrirInicio, 'aria-label': 'Ligar cronômetro de estudo' }, '▶ Cronômetro'));
      return;
    }
    caixa.appendChild(h('span', { class: 'cron-pilula' + (s.pausadoEm ? ' pausado' : '') },
      h('span', { class: 'cron-tempo', 'aria-live': 'off' }, fmt(decorrido(s))),
      h('span', { class: 'cron-disc' }, s.disciplina_nome),
      h('button', { class: 'cron-bt', 'aria-label': s.pausadoEm ? 'Continuar' : 'Pausar', onclick: pausar }, s.pausadoEm ? '▶' : '❚❚'),
      h('button', { class: 'cron-bt', 'aria-label': 'Parar e salvar', onclick: parar }, '■')));
  }

  function abrirInicio() {
    var ctx = cron.ctx, c = ctx.ativo();
    if (!c) { ctx.aviso('Escolha ou cadastre um concurso antes de usar o cronômetro.'); return; }
    A360D.carregarEdital(ctx.sb, c.id).then(function (discs) {
      if (!discs.length) { ctx.aviso('Importe o edital antes de usar o cronômetro.'); return; }
      var disc = UI.selecao(discs.map(function (d) { return [d.id, d.nome]; }), discs[0].id);
      var ass = h('select');
      function encher() {
        ass.innerHTML = ''; ass.appendChild(h('option', { value: '' }, '— disciplina inteira —'));
        var d = discs.filter(function (x) { return x.id === disc.value; })[0];
        (d ? d.assuntos : []).forEach(function (a) { ass.appendChild(h('option', { value: a.id }, a.descricao)); });
      }
      disc.addEventListener('change', encher); encher();
      var tipo = UI.selecao(TIPOS, 'aula');
      var ligar = h('button', { class: 'btn btn-primario' }, '▶ Começar');
      var p = UI.painel('Cronômetro de estudo', h('div', null, UI.campo('Disciplina', disc), UI.campo('Assunto (opcional)', ass), UI.campo('Tipo de estudo', tipo),
        h('p', { class: 'pequeno suave' }, 'Pausas não contam. Pode fechar ou recarregar a página: a contagem continua guardada neste navegador.')), [ligar]);
      ligar.addEventListener('click', function () {
        var d = discs.filter(function (x) { return x.id === disc.value; })[0];
        var a = d.assuntos.filter(function (x) { return x.id === ass.value; })[0];
        gravar({ inicio: Date.now(), pausas: 0, pausadoEm: null, concurso_id: c.id, disciplina_id: d.id, disciplina_nome: d.nome,
          assunto_id: a ? a.id : null, assunto_nome: a ? a.descricao : null, tipo: tipo.value });
        p.fechar(); desenharCron(); ctx.aviso('Cronômetro ligado: ' + d.nome + (a ? ' › ' + a.descricao : '') + '.');
      });
    }).catch(function (e) { ctx.aviso(UI.erroBanco(e)); });
  }

  function pausar() {
    var s = atual(); if (!s) return;
    if (s.pausadoEm) { s.pausas = (s.pausas || 0) + (Date.now() - s.pausadoEm); s.pausadoEm = null; }
    else s.pausadoEm = Date.now();
    gravar(s); desenharCron();
  }

  function parar() {
    var ctx = cron.ctx, s = atual(); if (!s) return;
    if (!s.pausadoEm) { s.pausadoEm = Date.now(); gravar(s); desenharCron(); }
    var min = Math.floor(decorrido(s) / 60000);
    if (min < 1) { gravar(null); desenharCron(); ctx.aviso('Sessão muito curta, não foi salva.'); return; }
    if (min > 360 && !ctx.confirmar('O cronômetro está ligado há ' + fmt(decorrido(s)) + '. Você ainda está estudando? (OK para salvar mesmo assim, Cancelar para revisar o tempo)')) return;
    var minIn = UI.entrada({ type: 'number', min: 1, max: 720, value: Math.min(min, 720) });
    var salvar = h('button', { class: 'btn btn-primario' }, 'Salvar');
    var desc = h('button', { class: 'btn btn-perigo' }, 'Descartar');
    var cont = h('button', { class: 'btn btn-secundario' }, 'Continuar estudando');
    var cm = UI.campo('Minutos líquidos (pode ajustar)', minIn);
    var p = UI.painel('Salvar sessão', h('div', null,
      h('p', null, h('strong', null, 'Salvar ' + min + ' min'), ' de ' + s.disciplina_nome + (s.assunto_nome ? ' › ' + s.assunto_nome : '') + ' (' + TIPOS.filter(function (t) { return t[0] === s.tipo; })[0][1].toLowerCase() + ')?'), cm), [salvar, cont, desc]);
    cont.addEventListener('click', function () { p.fechar(); pausar(); });
    desc.addEventListener('click', function () {
      if (!ctx.confirmar('Descartar esta sessão? O tempo não será registrado.')) return;
      gravar(null); p.fechar(); desenharCron(); ctx.aviso('Sessão descartada.');
    });
    salvar.addEventListener('click', function () {
      var m = parseInt(minIn.value, 10);
      if (!(m >= 1 && m <= 720)) { cm.erro('Use de 1 a 720 minutos.'); return; }
      salvar.disabled = true;
      ctx.sb.rpc('a360_registrar_sessao', { dados: { concurso_id: s.concurso_id, disciplina_id: s.disciplina_id, assunto_id: s.assunto_id, data: U.hojeISO(), tipo: s.tipo, minutos: m, origem: 'cronometro' } }).then(function (r) {
        salvar.disabled = false;
        if (r.error) {
          var t = String(r.error.message || '');
          ctx.aviso(/a360_registrar_sessao/.test(t) && /exist|find/i.test(t) ? 'Falta instalar a etapa 7: rode supabase/05-sessoes.sql no SQL Editor. O tempo continua guardado.' : UI.erroBanco(r.error));
          return;
        }
        gravar(null); p.fechar(); desenharCron();
        ctx.aviso('Sessão de ' + m + ' min salva.' + (r.data && r.data.primeira_revisao ? ' 1ª revisão em ' + U.dataBR(r.data.primeira_revisao) + '.' : ''));
        ctx.rotear();
      });
    });
  }

  window.A360CRON = {
    iniciar: function (ctx) {
      cron.ctx = ctx; desenharCron();
      clearInterval(cron.timer);
      cron.timer = setInterval(function () { var s = atual(); if (s && !s.pausadoEm) { var t = document.querySelector('#cron .cron-tempo'); if (t) t.textContent = fmt(decorrido(s)); } }, 1000);
    },
    // RN18: sessões do cronômetro de um dia (para o aviso na importação do CHECKPOINT)
    sessoesDoDia: function (sb, concursoId, data) {
      return sb.from('a360_sessoes').select('id,disciplina_id,assunto_id,minutos').eq('concurso_id', concursoId).eq('data', data).eq('origem', 'cronometro').is('excluido_em', null)
        .then(function (r) { return r.error ? [] : (r.data || []); }, function () { return []; });
    }
  };

  // ==================================================================
  // BIBLIOTECA
  // ==================================================================
  var TIPOS_LINK = [['lei', 'Lei seca'], ['pdf', 'PDF'], ['video', 'Vídeo'], ['questoes', 'Questões'], ['jurisprudencia', 'Jurisprudência'], ['outro', 'Outro']];
  var TL = {}; TIPOS_LINK.forEach(function (t) { TL[t[0]] = t[1]; });

  A360T.biblioteca = function (ctx, el, vivo) {
    var c = ctx.ativo();
    el.appendChild(h('div', { class: 'titulo-acoes' }, h('h1', null, 'Biblioteca'), c ? h('button', { class: 'btn btn-primario', id: 'btn-novo-link' }, '+ Link') : null));
    if (!c) { el.appendChild(UI.vazio('Nenhum concurso ativo.', 'Importe o EDITAL para começar.', [h('a', { class: 'btn btn-primario', href: '#/importar?aba=edital' }, 'Importar EDITAL')])); return; }
    var area = h('div', null, h('p', { class: 'suave' }, 'Carregando…'));
    el.appendChild(area);
    return Promise.all([A360D.carregarEdital(ctx.sb, c.id), ctx.sb.from('a360_links').select('*').eq('concurso_id', c.id).is('excluido_em', null).order('titulo')]).then(function (r) {
      if (!vivo()) return;
      if (r[1].error) throw r[1].error;
      var discs = r[0], links = r[1].data || [];
      document.getElementById('btn-novo-link').onclick = function () { formLink(ctx, c, discs, null); };
      area.innerHTML = '';
      if (!links.length) {
        area.appendChild(UI.vazio('Guarde aqui os links de estudo.', 'Lei seca (Planalto, Código Tributário Municipal, LC 116/2003), PDFs, videoaulas e cadernos de questões. Os links de um assunto entram sozinhos no prompt quando você estuda esse assunto.',
          [h('button', { class: 'btn btn-primario', onclick: function () { formLink(ctx, c, discs, null); } }, '+ Link')]));
        return;
      }
      var nomeD = {}, nomeA = {};
      discs.forEach(function (d) { nomeD[d.id] = d.nome; d.assuntos.forEach(function (a) { nomeA[a.id] = a.descricao; }); });
      var busca = UI.entrada({ type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar link' });
      var fd = UI.selecao([['', 'Todas as disciplinas']].concat(discs.map(function (d) { return [d.id, d.nome]; })), '', { 'aria-label': 'Disciplina' });
      var ft = UI.selecao([['', 'Todos os tipos']].concat(TIPOS_LINK), '', { 'aria-label': 'Tipo' });
      var ff = h('label', { class: 'check' }, h('input', { type: 'checkbox' }), ' Só favoritos');
      area.appendChild(h('div', { class: 'barra-acoes filtros' }, busca, fd, ft, ff));
      var grade = h('div', { class: 'grade-cartoes' });
      area.appendChild(grade);
      function desenhar() {
        grade.innerHTML = '';
        var q = U.norm(busca.value), so = ff.querySelector('input').checked;
        var fs = links.filter(function (l) {
          if (fd.value && l.disciplina_id !== fd.value) return false;
          if (ft.value && l.tipo !== ft.value) return false;
          if (so && !l.favorito) return false;
          return !q || U.norm(l.titulo + ' ' + l.url + ' ' + (nomeA[l.assunto_id] || '') + ' ' + (nomeD[l.disciplina_id] || '')).indexOf(q) >= 0;
        }).sort(function (a, b) { return (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0); });
        if (!fs.length) grade.appendChild(h('div', { class: 'cartao vazio' }, 'Nenhum link neste filtro.'));
        fs.forEach(function (l) {
          var estrela = h('button', { class: 'btn-estrela' + (l.favorito ? ' on' : ''), 'aria-label': l.favorito ? 'Tirar dos favoritos' : 'Favoritar' }, l.favorito ? '★' : '☆');
          estrela.addEventListener('click', function () {
            ctx.sb.from('a360_links').update({ favorito: !l.favorito }).eq('id', l.id).then(function (r2) { if (r2.error) { ctx.aviso(UI.erroBanco(r2.error)); return; } l.favorito = !l.favorito; desenhar(); });
          });
          grade.appendChild(h('div', { class: 'cartao cartao-link' },
            h('div', { class: 'linha-topo' }, h('span', { class: 'chip st-revisao' }, TL[l.tipo] || l.tipo), estrela),
            h('a', { class: 'link-titulo', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.titulo),
            h('div', { class: 'pequeno suave' }, (nomeD[l.disciplina_id] || 'Geral') + (l.assunto_id ? ' › ' + (nomeA[l.assunto_id] || '') : '')),
            h('div', { class: 'pequeno suave quebra' }, l.url),
            h('div', { class: 'barra-acoes' },
              h('button', { class: 'btn-link', onclick: function () { formLink(ctx, c, discs, l); } }, 'Editar'),
              h('button', { class: 'btn-link perigo', onclick: function () {
                if (!ctx.confirmar('Excluir o link "' + l.titulo + '"?')) return;
                ctx.sb.from('a360_links').update({ excluido_em: new Date().toISOString() }).eq('id', l.id).then(function (r2) { if (r2.error) { ctx.aviso(UI.erroBanco(r2.error)); return; } ctx.aviso('Link excluído.'); ctx.rotear(); });
              } }, 'Excluir'))));
        });
      }
      busca.addEventListener('input', desenhar); [fd, ft, ff.querySelector('input')].forEach(function (x) { x.addEventListener('change', desenhar); });
      desenhar();
    });
  };

  function formLink(ctx, c, discs, l) {
    l = l || {};
    var titulo = UI.entrada({ value: l.titulo || '', placeholder: 'CTN – Planalto' });
    var url = UI.entrada({ type: 'url', value: l.url || '', placeholder: 'https://…' });
    var tipo = UI.selecao(TIPOS_LINK, l.tipo || 'lei');
    var disc = UI.selecao([['', '— Geral (sem disciplina) —']].concat(discs.map(function (d) { return [d.id, d.nome]; })), l.disciplina_id || '');
    var ass = h('select');
    function encher() {
      ass.innerHTML = ''; ass.appendChild(h('option', { value: '' }, '— disciplina inteira —'));
      var d = discs.filter(function (x) { return x.id === disc.value; })[0];
      (d ? d.assuntos : []).forEach(function (a) { var o = h('option', { value: a.id }, a.descricao); if (a.id === l.assunto_id) o.selected = true; ass.appendChild(o); });
      ass.disabled = !d;
    }
    disc.addEventListener('change', encher); encher();
    var cs = { t: UI.campo('Título *', titulo), u: UI.campo('Endereço (URL) *', url), tp: UI.campo('Tipo', tipo), d: UI.campo('Disciplina', disc), a: UI.campo('Assunto', ass, 'Links de um assunto entram no prompt quando você estuda esse assunto.') };
    var salvar = h('button', { class: 'btn btn-primario' }, l.id ? 'Salvar' : 'Salvar link');
    var p = UI.painel(l.id ? 'Editar link' : 'Novo link', h('div', null, cs.t, cs.u, cs.tp, cs.d, cs.a), [salvar]);
    salvar.addEventListener('click', function () {
      cs.t.erro(''); cs.u.erro('');
      var ok = true, u = url.value.trim();
      if (!titulo.value.trim()) { cs.t.erro('Informe um título.'); ok = false; }
      if (!/^https?:\/\/\S+$/i.test(u)) { cs.u.erro('Informe um endereço que comece com http:// ou https://'); ok = false; }
      if (!ok) return;
      var d = { titulo: titulo.value.trim(), url: u, tipo: tipo.value, disciplina_id: disc.value || null, assunto_id: (disc.value && ass.value) || null };
      salvar.disabled = true;
      var q = l.id ? ctx.sb.from('a360_links').update(d).eq('id', l.id) : ctx.sb.from('a360_links').insert(Object.assign(d, { concurso_id: c.id }));
      q.then(function (r) {
        salvar.disabled = false;
        if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
        p.fechar(); ctx.aviso('Link salvo.'); ctx.rotear();
      });
    });
  }
})();
