// =====================================================================
// Aprovação 360° — Caderno de erros, Ciclo de estudos e Simulados (etapa 6)
// =====================================================================
(function () {
  'use strict';
  var h = A360U.h, UI = A360UI, U = A360U, C = A360C;
  window.A360T = window.A360T || {};
  var MOTIVOS = [['conceito', 'Conceito'], ['letra_da_lei', 'Letra da lei'], ['pegadinha', 'Pegadinha'], ['interpretacao', 'Interpretação'], ['calculo', 'Cálculo'], ['atencao', 'Falta de atenção'], ['chute', 'Chute']];
  var MOT = {}; MOTIVOS.forEach(function (m) { MOT[m[0]] = m[1]; });

  function semConcurso(ctx, el) {
    var c = ctx.ativo();
    if (!c) el.appendChild(UI.vazio('Nenhum concurso ativo.', 'Importe o EDITAL para começar.', [h('a', { class: 'btn btn-primario', href: '#/importar?aba=edital' }, 'Importar EDITAL')]));
    return c;
  }
  function faltaSQL(arquivo) { return h('div', { class: 'cartao erro-caixa' }, 'Falta instalar esta etapa no banco: rode o arquivo supabase/' + arquivo + ' no SQL Editor do Supabase.'); }
  function baixar(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo || 'text/plain;charset=utf-8' });
    var a = h('a', { href: URL.createObjectURL(blob), download: nome });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function cabecalhoPrompt(ctx, c) {
    return { hoje: U.hojeISO(), concurso: c, sequencia: ctx.estado.sequencia || 0 };
  }

  // ==================================================================
  // CADERNO DE ERROS
  // ==================================================================
  A360T.erros = function (ctx, el, vivo) {
    el.appendChild(h('h1', null, 'Caderno de erros'));
    var c = semConcurso(ctx, el); if (!c) return;
    var area = h('div', { class: 'area' }, h('p', { class: 'suave' }, 'Carregando…'));
    el.appendChild(area);
    return A360D.carregarEdital(ctx.sb, c.id).then(function (discs) {
      var ids = discs.map(function (d) { return d.id; });
      var q = ids.length ? ctx.sb.from('a360_erros').select('*').in('disciplina_id', ids).is('excluido_em', null).order('data', { ascending: false }) : Promise.resolve({ data: [] });
      return q.then(function (r) {
        if (!vivo()) return;
        if (r.error) throw r.error;
        desenharErros(ctx, c, area, discs, r.data || []);
      });
    });
  };

  function desenharErros(ctx, c, area, discs, erros) {
    area.innerHTML = '';
    var porAss = {}, porDisc = {};
    discs.forEach(function (d) { porDisc[d.id] = d; d.assuntos.forEach(function (a) { porAss[a.id] = { a: a, d: d }; }); });
    var hoje = U.hojeISO();
    var f = { disc: UI.selecao([['', 'Todas as disciplinas']].concat(discs.map(function (d) { return [d.id, d.nome]; })), '', { 'aria-label': 'Disciplina' }),
      motivo: UI.selecao([['', 'Todos os motivos']].concat(MOTIVOS), '', { 'aria-label': 'Motivo' }),
      rev: UI.selecao([['abertos', 'Não revisados'], ['revisados', 'Revisados'], ['todos', 'Todos']], 'abertos', { 'aria-label': 'Situação' }),
      per: UI.selecao([['todos', 'Todo o período'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']], 'todos', { 'aria-label': 'Período' }) };
    var treinar = h('button', { class: 'btn btn-primario' }, 'Treinar estes erros na IA');
    area.appendChild(h('div', { class: 'titulo-acoes' }, h('div', { class: 'barra-acoes filtros' }, f.disc, f.motivo, f.rev, f.per),
      h('div', { class: 'barra-acoes' }, treinar,
        h('button', { class: 'btn btn-secundario', onclick: function () { formErro(ctx, c, discs); } }, '+ Erro'),
        h('button', { class: 'btn btn-secundario', onclick: function () { exportarCSV(filtrados()); } }, 'Exportar CSV'))));
    var graf = h('div', { class: 'duas-colunas' }), lista = h('section', { class: 'cartao' });
    area.appendChild(graf); area.appendChild(lista);

    function filtrados() {
      return erros.filter(function (e) {
        if (f.disc.value && e.disciplina_id !== f.disc.value) return false;
        if (f.motivo.value && e.motivo !== f.motivo.value) return false;
        if (f.rev.value === 'abertos' && e.revisado) return false;
        if (f.rev.value === 'revisados' && !e.revisado) return false;
        if (f.per.value !== 'todos' && U.difDias(hoje, e.data) >= parseInt(f.per.value, 10)) return false;
        return !!porAss[e.assunto_id];
      });
    }
    function desenhar() {
      var fs = filtrados();
      graf.innerHTML = ''; lista.innerHTML = '';
      // por motivo
      var cnt = {}, max = 1;
      fs.forEach(function (e) { cnt[e.motivo] = (cnt[e.motivo] || 0) + 1; if (cnt[e.motivo] > max) max = cnt[e.motivo]; });
      var gm = h('section', { class: 'cartao col' }, h('h2', null, 'Por motivo'));
      var algum = false;
      MOTIVOS.forEach(function (m) {
        if (!cnt[m[0]]) return; algum = true;
        gm.appendChild(h('div', { class: 'barra-motivo' }, h('span', { class: 'bm-rot' }, m[1]), h('div', { class: 'bm-barra' }, UI.barra(cnt[m[0]] / max * 100, 'aco')), h('strong', null, String(cnt[m[0]]))));
      });
      if (!algum) gm.appendChild(h('p', { class: 'suave pequeno' }, 'Nenhum erro neste filtro.'));
      // top 5 em 30 dias e recorrentes
      var top = {}, abertos = erros.filter(function (e) { return !e.revisado && porAss[e.assunto_id]; });
      erros.forEach(function (e) { if (porAss[e.assunto_id] && U.difDias(hoje, e.data) < 30) top[e.assunto_id] = (top[e.assunto_id] || 0) + 1; });
      var topL = Object.keys(top).sort(function (a, b) { return top[b] - top[a]; }).slice(0, 5);
      var rec = C.errosRecorrentes(abertos, hoje);
      var gt = h('section', { class: 'cartao col' }, h('h2', null, 'Mais erros em 30 dias'));
      if (!topL.length) gt.appendChild(h('p', { class: 'suave pequeno' }, 'Nenhum erro nos últimos 30 dias.'));
      topL.forEach(function (id) { var i = porAss[id]; gt.appendChild(h('div', { class: 'linha-simples' }, h('span', null, i.d.nome + ' › ' + i.a.descricao), h('strong', null, String(top[id])))); });
      if (rec.length) {
        gt.appendChild(h('h3', null, 'Recorrentes'));
        rec.slice(0, 5).forEach(function (r) { var i = porAss[r.assunto_id]; if (i) gt.appendChild(h('div', { class: 'pequeno' }, '• ' + i.d.nome + ' › ' + i.a.descricao + ' — ' + (r.motivo ? MOT[r.motivo] + ' repetido' : r.total + ' erros abertos'))); });
      }
      graf.appendChild(gm); graf.appendChild(gt);
      // lista
      lista.appendChild(h('h2', null, fs.length + ' erro(s)'));
      if (!fs.length) lista.appendChild(h('p', { class: 'suave' }, erros.length ? 'Nenhum erro neste filtro.' : 'Os erros chegam pelas linhas ERRO do CHECKPOINT, ou você pode incluir à mão em "+ Erro".'));
      fs.forEach(function (e) {
        var i = porAss[e.assunto_id];
        var bt = h('button', { class: 'btn btn-peq ' + (e.revisado ? 'btn-ok' : 'btn-secundario') }, e.revisado ? '✔ Revisado' : 'Marcar revisado');
        bt.addEventListener('click', function () {
          bt.disabled = true;
          var nv = !e.revisado;
          ctx.sb.from('a360_erros').update({ revisado: nv, data_revisado: nv ? hoje : null }).eq('id', e.id).then(function (r) {
            bt.disabled = false;
            if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
            e.revisado = nv; e.data_revisado = nv ? hoje : null; desenhar();
          });
        });
        lista.appendChild(h('div', { class: 'linha-erro' },
          h('span', { class: 'pequeno suave le-data' }, U.dataBR(e.data).slice(0, 5)),
          h('span', { class: 'chip st-revisao' }, MOT[e.motivo] || e.motivo),
          h('div', { class: 'le-texto' }, h('div', { class: 'forte pequeno' }, i.d.nome + ' › ' + i.a.descricao), h('div', null, e.descricao)), bt));
      });
    }
    [f.disc, f.motivo, f.rev, f.per].forEach(function (s) { s.addEventListener('change', desenhar); });
    treinar.addEventListener('click', function () {
      var fs = filtrados().filter(function (e) { return !e.revisado; }).slice(0, 15);
      if (!fs.length) { ctx.aviso('Nenhum erro não revisado no filtro atual.'); return; }
      var d = Object.assign(cabecalhoPrompt(ctx, c), { tipo: 'erros', recorrentes: fs.map(function (e) { var i = porAss[e.assunto_id]; return { disciplina: i.d.nome, assunto: i.a.descricao, motivo: e.motivo, descricao: e.descricao }; }) });
      A360PR.verPrompt(ctx, C.montarPrompt(d), null, 'Prompt: treinar ' + fs.length + ' erro(s)');
    });
    function exportarCSV(fs) {
      function cel(v) { v = String(v === null || v === undefined ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
      var linhas = [['Data', 'Disciplina', 'Assunto', 'Motivo', 'Descrição', 'Revisado'].join(';')];
      fs.forEach(function (e) { var i = porAss[e.assunto_id]; linhas.push([U.dataBR(e.data), i.d.nome, i.a.descricao, MOT[e.motivo], e.descricao, e.revisado ? 'Sim' : 'Não'].map(cel).join(';')); });
      baixar('caderno-de-erros.csv', '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
    }
    desenhar();
  }

  function formErro(ctx, c, discs) {
    if (!discs.length) { ctx.aviso('Importe o edital antes de registrar erros.'); return; }
    var disc = UI.selecao(discs.map(function (d) { return [d.id, d.nome]; }), discs[0].id);
    var ass = h('select');
    function encherAssuntos() {
      ass.innerHTML = '';
      var d = discs.filter(function (x) { return x.id === disc.value; })[0];
      (d ? d.assuntos : []).forEach(function (a) { ass.appendChild(h('option', { value: a.id }, a.descricao)); });
    }
    disc.addEventListener('change', encherAssuntos); encherAssuntos();
    var data = UI.entrada({ type: 'date', value: U.hojeISO(), max: U.hojeISO() });
    var motivo = UI.selecao(MOTIVOS, 'conceito');
    var desc = h('textarea', { rows: 4, maxlength: 500, placeholder: 'O que errei e qual é o certo (com artigo, se houver).' });
    var cs = { disc: UI.campo('Disciplina *', disc), ass: UI.campo('Assunto *', ass), data: UI.campo('Data *', data), motivo: UI.campo('Motivo *', motivo), desc: UI.campo('Descrição * (até 500 caracteres)', desc) };
    var salvar = h('button', { class: 'btn btn-primario' }, 'Registrar erro');
    var p = UI.painel('Novo erro', h('div', null, cs.disc, cs.ass, cs.data, cs.motivo, cs.desc), [salvar]);
    salvar.addEventListener('click', function () {
      Object.keys(cs).forEach(function (k) { cs[k].erro(''); });
      var ok = true;
      if (!ass.value) { cs.ass.erro('Escolha o assunto.'); ok = false; }
      if (!data.value) { cs.data.erro('Informe a data.'); ok = false; }
      if (!desc.value.trim()) { cs.desc.erro('Descreva o erro.'); ok = false; }
      if (!ok) return;
      salvar.disabled = true;
      ctx.sb.from('a360_erros').insert({ assunto_id: ass.value, disciplina_id: disc.value, data: data.value, motivo: motivo.value, descricao: desc.value.trim().slice(0, 500) }).then(function (r) {
        salvar.disabled = false;
        if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
        p.fechar(); ctx.aviso('Erro registrado.'); ctx.rotear();
      });
    });
  }

  // ==================================================================
  // CICLO DE ESTUDOS
  // ==================================================================
  A360T.ciclo = function (ctx, el, vivo) {
    el.appendChild(h('h1', null, 'Ciclo de estudos'));
    var c = semConcurso(ctx, el); if (!c) return;
    var area = h('div', { class: 'area' }, h('p', { class: 'suave' }, 'Carregando…'));
    el.appendChild(area);
    var seg = C.inicioSemana(U.hojeISO());
    return Promise.all([
      A360D.carregarEdital(ctx.sb, c.id),
      ctx.sb.from('a360_planejamentos').select('*').eq('concurso_id', c.id).is('excluido_em', null).order('versao', { ascending: false }),
      ctx.sb.from('a360_sessoes').select('disciplina_id,minutos,status,data').eq('concurso_id', c.id).gte('data', seg).is('excluido_em', null)
    ]).then(function (r) {
      if (!vivo()) return;
      area.innerHTML = '';
      var discs = r[0], planos = (r[1].data || []), vig = planos.filter(function (p) { return p.vigente; })[0] || null;
      if (!discs.length) { area.appendChild(UI.vazio('Este concurso ainda não tem disciplinas.', 'Importe o EDITAL primeiro.', [h('a', { class: 'btn btn-primario', href: '#/importar?aba=edital' }, 'Importar EDITAL')])); return; }
      var minSem = {}; (r[2].data || []).forEach(function (s) { if (s.status === 'REALIZADO') minSem[s.disciplina_id] = (minSem[s.disciplina_id] || 0) + s.minutos; });
      function entrada(d) { return { id: d.id, nome: d.nome, peso: d.peso, incidencia: d.incidencia, feitas: d.feitas, acertos: d.acertos, pendente: d.assuntos.some(function (a) { return a.status !== 'dominado'; }) }; }
      var sugestao = C.distribuirCiclo(discs.map(entrada), vig ? Number(vig.horas_semana) : 20);
      // horas vigentes: as aprovadas (RN10); sem planejamento, mostra a sugestão
      var vigentes = sugestao.map(function (s) {
        var d = discs.filter(function (x) { return x.id === s.id; })[0];
        return Object.assign({}, s, { horas: vig && d.horas_ciclo !== null && d.horas_ciclo !== undefined ? Number(d.horas_ciclo) : s.horas });
      });
      var asPorDisc = {}; discs.forEach(function (d) { asPorDisc[d.id] = d.assuntos; });
      var prox = C.proximaDaVez(vigentes, minSem, asPorDisc);
      var mudou = vig && sugestao.some(function (s, i) { return Math.abs(s.horas - vigentes[i].horas) >= 0.5; });

      if (!vig) area.appendChild(h('div', { class: 'cartao aviso-caixa' }, h('strong', null, 'Defina suas horas por semana para montar o ciclo. '), 'Enquanto isso, o painel usa 20 h como padrão.'));
      area.appendChild(h('section', { class: 'cartao' },
        h('div', { class: 'titulo-acoes' },
          h('div', null, h('h2', null, vig ? 'Planejamento v' + vig.versao + ' · ' + U.num1(Number(vig.horas_semana)) + ' h por semana' : 'Sem planejamento aprovado'),
            vig ? h('div', { class: 'pequeno suave' }, 'aprovado em ' + U.dataBR(vig.data_aprovacao) + ' · meta de ' + vig.meta_questoes_semana + ' questões por semana' + (vig.observacoes ? ' · ' + vig.observacoes : '')) : null),
          h('button', { class: 'btn btn-primario', onclick: function () { formPlano(ctx, c, discs, entrada, vig, vigentes); } }, vig ? 'Nova versão do planejamento' : 'Definir planejamento')),
        mudou ? h('div', { class: 'aviso-caixa' }, 'Seus dados de acerto mudaram e a distribuição sugerida ficou diferente da aprovada. ', h('button', { class: 'btn-link', onclick: function () { formPlano(ctx, c, discs, entrada, vig, vigentes); } }, 'Recalcular?')) : null,
        h('p', { class: 'pequeno suave' }, 'Prioridade = peso × incidência × (1 − % de acerto). Com menos de 10 questões, o acerto conta como 50%. As horas só mudam quando você aprova uma nova versão.')));

      var tab = h('section', { class: 'cartao' });
      vigentes.slice().sort(function (a, b) { return b.pr - a.pr; }).forEach(function (row) {
        var feito = (minSem[row.id] || 0) / 60, pc = row.horas ? Math.min(100, feito / row.horas * 100) : 0;
        var conta = row.peso + ' × ' + row.incidencia + ' × (1 − ' + (row.feitas >= 10 ? U.pct(row.acertos, row.feitas) : '50%') + ')';
        tab.appendChild(h('div', { class: 'linha-ciclo' },
          h('div', { class: 'lc-nome' }, h('div', { class: 'forte' }, row.nome), h('div', { class: 'pequeno suave' }, conta + (row.feitas ? ' · ' + row.feitas + ' questões' : ''))),
          h('div', { class: 'lc-num' }, h('div', { class: 'pequeno suave' }, 'prioridade'), h('strong', null, U.num1(row.pr))),
          h('div', { class: 'lc-num' }, h('div', { class: 'pequeno suave' }, 'meta'), h('strong', null, U.num1(row.horas) + ' h')),
          h('div', { class: 'lc-barra' }, h('div', { class: 'pequeno suave' }, 'feito na semana: ' + U.num1(feito) + ' h'), UI.barra(pc)),
          prox && prox.disciplina.id === row.id ? h('span', { class: 'chip chip-prox' }, 'Próxima da vez') : null));
      });
      area.appendChild(tab);
      if (prox && prox.assunto) area.appendChild(h('section', { class: 'cartao info' }, h('strong', null, 'Próxima da vez: '), prox.disciplina.nome + ' › ' + prox.assunto.descricao, ' (a mais atrasada em relação à meta da semana).'));

      if (planos.length) {
        var hist = h('details', null, h('summary', null, 'Histórico de versões (' + planos.length + ')'));
        planos.forEach(function (p) { hist.appendChild(h('div', { class: 'linha-simples pequeno' }, h('span', null, 'v' + p.versao + ' · ' + U.dataBR(p.data_aprovacao) + (p.observacoes ? ' · ' + p.observacoes : '')), h('span', null, U.num1(Number(p.horas_semana)) + ' h · ' + p.meta_questoes_semana + ' questões' + (p.vigente ? ' · vigente' : '')))); });
        area.appendChild(h('section', { class: 'cartao' }, hist));
      }
    });
  };

  function formPlano(ctx, c, discs, entrada, vig, vigentes) {
    var horas = UI.entrada({ type: 'number', min: 1, max: 100, step: 0.5, value: vig ? Number(vig.horas_semana) : 20 });
    var meta = UI.entrada({ type: 'number', min: 0, step: 10, value: vig ? vig.meta_questoes_semana : 200 });
    var obs = UI.entrada({ placeholder: 'Ex.: aumento de horas nas férias' });
    var ch = UI.campo('Horas líquidas de estudo por semana *', horas), cm = UI.campo('Meta de questões por semana', meta), co = UI.campo('Justificativa da mudança', obs);
    var previa = h('div', { class: 'previa-ciclo' });
    var nova = [];
    function calcular() {
      previa.innerHTML = '';
      var hs = parseFloat(horas.value);
      if (!(hs > 0 && hs <= 100)) { previa.appendChild(h('p', { class: 'erro pequeno' }, 'Horas por semana deve ser maior que zero e no máximo 100.')); nova = []; return; }
      nova = C.distribuirCiclo(discs.map(entrada), hs);
      previa.appendChild(h('div', { class: 'linha-simples cab' }, h('span', null, 'Disciplina'), h('span', null, (vig ? 'atual → ' : '') + 'nova')));
      nova.slice().sort(function (a, b) { return b.pr - a.pr; }).forEach(function (n) {
        var at = vigentes.filter(function (v) { return v.id === n.id; })[0];
        previa.appendChild(h('div', { class: 'linha-simples' }, h('span', null, n.nome + ' (prioridade ' + U.num1(n.pr) + ')'),
          h('strong', null, (vig && at ? U.num1(at.horas) + ' h → ' : '') + U.num1(n.horas) + ' h')));
      });
    }
    horas.addEventListener('input', calcular); calcular();
    var aprovar = h('button', { class: 'btn btn-sucesso' }, 'Aprovar');
    var p = UI.painel(vig ? 'Nova versão do planejamento' : 'Definir planejamento', h('div', null, ch, cm, vig ? co : null, h('h3', null, 'Prévia da distribuição'), previa,
      h('p', { class: 'pequeno suave' }, 'Nada é gravado até você clicar em Aprovar. A versão atual fica no histórico.')), [aprovar]);
    aprovar.addEventListener('click', function () {
      ch.erro(''); cm.erro('');
      var hs = parseFloat(horas.value), mq = parseInt(meta.value || '0', 10);
      if (!(hs > 0 && hs <= 100)) { ch.erro('Horas por semana deve ser maior que zero e no máximo 100.'); return; }
      if (isNaN(mq) || mq < 0) { cm.erro('Use um número igual ou maior que zero.'); return; }
      aprovar.disabled = true;
      ctx.sb.rpc('a360_aprovar_planejamento', { dados: { concurso_id: c.id, horas_semana: hs, meta_questoes_semana: mq, observacoes: obs.value.trim() || null,
        distribuicao: nova.map(function (n) { return { disciplina_id: n.id, horas: n.horas }; }) } }).then(function (r) {
        aprovar.disabled = false;
        if (r.error) { ctx.aviso(/a360_aprovar_planejamento/.test(String(r.error.message)) && /exist|find/i.test(String(r.error.message)) ? 'Falta instalar a etapa 6: rode supabase/04-ciclo-simulados.sql no SQL Editor.' : UI.erroBanco(r.error)); return; }
        p.fechar(); ctx.aviso('Planejamento v' + r.data.versao + ' aprovado.'); ctx.rotear();
      });
    });
  }

  // ==================================================================
  // SIMULADOS
  // ==================================================================
  var ORIGENS = [['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['cursinho', 'Cursinho'], ['prova_anterior', 'Prova anterior'], ['outro', 'Outro']];
  var ORI = {}; ORIGENS.forEach(function (o) { ORI[o[0]] = o[1]; });

  A360T.simulados = function (ctx, el, vivo) {
    var c = ctx.ativo();
    el.appendChild(h('div', { class: 'titulo-acoes' }, h('h1', null, 'Simulados'), c ? h('button', { class: 'btn btn-primario', id: 'btn-novo-sim' }, '+ Simulado') : null));
    if (!semConcurso(ctx, el)) return;
    var area = h('div', { class: 'area' }, h('p', { class: 'suave' }, 'Carregando…'));
    el.appendChild(area);
    return Promise.all([
      A360D.carregarEdital(ctx.sb, c.id),
      ctx.sb.from('a360_simulados').select('*').eq('concurso_id', c.id).is('excluido_em', null).order('data')
    ]).then(function (r) {
      if (!vivo()) return;
      if (r[1].error) throw r[1].error;
      var discs = r[0], sims = r[1].data || [];
      var ids = sims.map(function (s) { return s.id; });
      var q = ids.length ? ctx.sb.from('a360_simulado_disciplinas').select('*').in('simulado_id', ids).is('excluido_em', null) : Promise.resolve({ data: [] });
      return q.then(function (r2) {
        if (!vivo()) return;
        var det = {}; (r2.data || []).forEach(function (x) { (det[x.simulado_id] = det[x.simulado_id] || []).push(x); });
        var bNovo = document.getElementById('btn-novo-sim');
        if (bNovo) bNovo.onclick = function () { formSimulado(ctx, c, discs, null, []); };
        desenharSimulados(ctx, c, area, discs, sims, det);
      });
    });
  };

  function desenharSimulados(ctx, c, area, discs, sims, det) {
    area.innerHTML = '';
    if (!sims.length) {
      area.appendChild(UI.vazio('Nenhum simulado registrado.', 'Registre aqui os simulados que fizer (os da IA com /simulado, de cursinho ou provas anteriores) para acompanhar a evolução.', [h('button', { class: 'btn btn-primario', onclick: function () { formSimulado(ctx, c, discs, null, []); } }, '+ Simulado')]));
      return;
    }
    var pts = sims.map(function (s) { return { rotulo: U.dataBR(s.data).slice(0, 5), valor: Math.round(s.acertos / s.total_questoes * 1000) / 10 }; });
    var ult = pts[pts.length - 1], media = pts.reduce(function (a, p) { return a + p.valor; }, 0) / pts.length;
    area.appendChild(h('div', { class: 'grade-indicadores' },
      h('div', { class: 'indicador' }, h('div', { class: 'ind-rotulo' }, 'Último simulado'), h('div', { class: 'ind-valor' }, U.num1(ult.valor) + '%'), h('div', { class: 'ind-sub' }, ult.rotulo)),
      h('div', { class: 'indicador' }, h('div', { class: 'ind-rotulo' }, 'Média'), h('div', { class: 'ind-valor' }, U.num1(media) + '%'), h('div', { class: 'ind-sub' }, sims.length + ' simulado(s)')),
      h('div', { class: 'indicador' }, h('div', { class: 'ind-rotulo' }, 'Evolução'), h('div', { class: 'ind-valor' }, (pts.length > 1 ? (ult.valor - pts[0].valor >= 0 ? '+' : '') + U.num1(ult.valor - pts[0].valor) + ' p.p.' : '—')), h('div', { class: 'ind-sub' }, 'do primeiro ao último'))));
    area.appendChild(h('section', { class: 'cartao' }, h('h2', null, '% de acerto ao longo do tempo'), UI.graficoLinha(pts)));
    var lista = h('section', { class: 'cartao' });
    sims.slice().reverse().forEach(function (s) {
      var pc = s.acertos / s.total_questoes * 100;
      lista.appendChild(h('div', { class: 'linha-sim' },
        h('div', { class: 'ls-info' }, h('div', { class: 'forte' }, s.nome), h('div', { class: 'pequeno suave' }, U.dataBR(s.data) + ' · ' + (ORI[s.origem] || s.origem) + ' · ' + s.acertos + ' de ' + s.total_questoes + (s.tempo_minutos ? ' · ' + s.tempo_minutos + ' min' : '') + (s.observacoes ? ' · ' + s.observacoes : ''))),
        h('strong', { class: 'ls-pct' }, U.num1(pc) + '%'),
        h('span', { class: 'acoes-linha' },
          h('button', { class: 'btn-link', onclick: function () { detalheSimulado(discs, s, det[s.id] || []); } }, 'Detalhe'),
          h('button', { class: 'btn-link', onclick: function () { formSimulado(ctx, c, discs, s, det[s.id] || []); } }, 'Editar'),
          h('button', { class: 'btn-link perigo', onclick: function () {
            if (!ctx.confirmar('Excluir o simulado "' + s.nome + '"?')) return;
            ctx.sb.from('a360_simulados').update({ excluido_em: new Date().toISOString() }).eq('id', s.id).then(function (r) { if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; } ctx.aviso('Simulado excluído.'); ctx.rotear(); });
          } }, 'Excluir'))));
    });
    area.appendChild(lista);
  }

  function detalheSimulado(discs, s, linhas) {
    var corpo = h('div', null, h('p', null, h('strong', null, U.num1(s.acertos / s.total_questoes * 100) + '%'), ' de acerto · ' + s.acertos + ' de ' + s.total_questoes));
    if (!linhas.length) corpo.appendChild(h('p', { class: 'suave' }, 'Este simulado não tem o detalhe por disciplina.'));
    linhas.forEach(function (l) {
      var d = discs.filter(function (x) { return x.id === l.disciplina_id; })[0]; if (!d) return;
      var pc = l.acertos / l.questoes * 100, geral = d.feitas ? d.acertos / d.feitas * 100 : null;
      corpo.appendChild(h('div', { class: 'barra-disc' },
        h('div', { class: 'bd-topo' }, h('span', null, d.nome + ' (' + l.acertos + '/' + l.questoes + ')'), h('strong', null, U.num1(pc) + '%')),
        UI.barra(pc, pc >= 80 ? 'verde' : (pc >= 65 ? '' : 'laranja')),
        h('div', { class: 'pequeno suave' }, geral === null ? 'sem média geral ainda' : 'média geral nas questões: ' + U.num1(geral) + '% (' + (pc - geral >= 0 ? '+' : '') + U.num1(pc - geral) + ' p.p.)')));
    });
    UI.painel('Detalhe · ' + s.nome, corpo);
  }

  function formSimulado(ctx, c, discs, s, linhas) {
    s = s || {};
    var f = { data: UI.entrada({ type: 'date', value: s.data || U.hojeISO(), max: U.hojeISO() }), nome: UI.entrada({ value: s.nome || '', placeholder: 'Simulado 1 – estilo da banca' }),
      origem: UI.selecao(ORIGENS, s.origem || 'claude'), total: UI.entrada({ type: 'number', min: 1, value: s.total_questoes || '' }),
      acertos: UI.entrada({ type: 'number', min: 0, value: s.acertos === undefined ? '' : s.acertos }), tempo: UI.entrada({ type: 'number', min: 0, value: s.tempo_minutos || '' }),
      obs: UI.entrada({ value: s.observacoes || '', placeholder: 'Ex.: faltou tempo em Contabilidade' }) };
    var cs = { data: UI.campo('Data *', f.data), nome: UI.campo('Nome *', f.nome), origem: UI.campo('Origem', f.origem), total: UI.campo('Total de questões *', f.total),
      acertos: UI.campo('Acertos *', f.acertos), tempo: UI.campo('Tempo (min)', f.tempo), obs: UI.campo('Observações', f.obs) };
    var porDisc = {}; linhas.forEach(function (l) { porDisc[l.disciplina_id] = l; });
    var somaTxt = h('div', { class: 'pequeno suave' });
    var tabela = h('div', { class: 'tab-sim' }, h('div', { class: 'ts-linha cab' }, h('span', null, 'Disciplina (opcional)'), h('span', null, 'Questões'), h('span', null, 'Acertos')));
    var campos = discs.map(function (d) {
      var q = UI.entrada({ type: 'number', min: 0, value: porDisc[d.id] ? porDisc[d.id].questoes : '', 'aria-label': 'Questões de ' + d.nome });
      var a = UI.entrada({ type: 'number', min: 0, value: porDisc[d.id] ? porDisc[d.id].acertos : '', 'aria-label': 'Acertos de ' + d.nome });
      q.addEventListener('input', soma); a.addEventListener('input', soma);
      tabela.appendChild(h('div', { class: 'ts-linha' }, h('span', null, d.nome), q, a));
      return { d: d, q: q, a: a };
    });
    function soma() {
      var sq = 0, sa = 0; campos.forEach(function (x) { sq += parseInt(x.q.value || '0', 10) || 0; sa += parseInt(x.a.value || '0', 10) || 0; });
      somaTxt.textContent = sq ? 'Soma das disciplinas: ' + sq + ' questões, ' + sa + ' acertos.' : '';
    }
    f.total.addEventListener('input', soma); soma();
    var salvar = h('button', { class: 'btn btn-primario' }, s.id ? 'Salvar' : 'Registrar simulado');
    var p = UI.painel(s.id ? 'Editar simulado' : 'Novo simulado', h('div', null, h('div', { class: 'form-grade' }, cs.data, cs.nome, cs.origem, cs.total, cs.acertos, cs.tempo), cs.obs, h('h3', null, 'Por disciplina'), tabela, somaTxt), [salvar]);
    salvar.addEventListener('click', function () {
      Object.keys(cs).forEach(function (k) { cs[k].erro(''); });
      var tot = parseInt(f.total.value, 10), ac = parseInt(f.acertos.value, 10), ok = true;
      if (!f.data.value) { cs.data.erro('Informe a data.'); ok = false; }
      if (!f.nome.value.trim()) { cs.nome.erro('Dê um nome ao simulado.'); ok = false; }
      if (!(tot >= 1)) { cs.total.erro('Informe o total (pelo menos 1).'); ok = false; }
      if (isNaN(ac) || ac < 0) { cs.acertos.erro('Informe os acertos.'); ok = false; } else if (ac > tot) { cs.acertos.erro('Acertos não podem ser maiores que o total.'); ok = false; }
      var dl = [], sq = 0, erroDisc = '';
      campos.forEach(function (x) {
        var q = parseInt(x.q.value || '0', 10) || 0, a = parseInt(x.a.value || '0', 10) || 0;
        if (!q && !a) return;
        if (q < 1 || a > q) erroDisc = 'Em ' + x.d.nome + ', os acertos não podem passar das questões.';
        sq += q; dl.push({ disciplina_id: x.d.id, questoes: q, acertos: a });
      });
      if (erroDisc) { somaTxt.textContent = erroDisc; somaTxt.className = 'pequeno erro'; ok = false; }
      else if (tot >= 1 && sq > tot) { somaTxt.textContent = 'A soma das disciplinas (' + sq + ') passa do total (' + tot + ').'; somaTxt.className = 'pequeno erro'; ok = false; }
      if (!ok) return;
      salvar.disabled = true;
      ctx.sb.rpc('a360_salvar_simulado', { dados: { id: s.id || null, concurso_id: c.id, data: f.data.value, nome: f.nome.value.trim(), origem: f.origem.value, total_questoes: tot, acertos: ac,
        tempo_minutos: f.tempo.value ? parseInt(f.tempo.value, 10) : null, observacoes: f.obs.value.trim() || null, disciplinas: dl } }).then(function (r) {
        salvar.disabled = false;
        if (r.error) { ctx.aviso(/a360_salvar_simulado/.test(String(r.error.message)) && /exist|find/i.test(String(r.error.message)) ? 'Falta instalar a etapa 6: rode supabase/04-ciclo-simulados.sql no SQL Editor.' : UI.erroBanco(r.error)); return; }
        p.fechar(); ctx.aviso('Simulado registrado: ' + U.num1(r.data.percentual) + '% de acerto.'); ctx.rotear();
      });
    });
  }
})();
