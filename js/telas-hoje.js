// =====================================================================
// Aprovação 360° — painel Hoje e Prompt do Dia (etapa 5)
// =====================================================================
(function () {
  'use strict';
  var h = A360U.h, UI = A360UI, U = A360U, C = A360C;
  window.A360T = window.A360T || {};

  var IAS = {
    claude: { nome: 'Claude', padrao: 'https://claude.ai/new', campo: 'url_projeto_claude' },
    chatgpt: { nome: 'ChatGPT', padrao: 'https://chatgpt.com/', campo: 'url_projeto_chatgpt' }
  };

  // Copia de forma síncrona (funciona mesmo abrindo outra aba logo depois)
  function copiarSincrono(texto) {
    try {
      var ta = document.createElement('textarea');
      ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }

  // Copia o prompt e abre a IA escolhida em nova aba
  function abrirIA(ctx, ia, texto) {
    var info = IAS[ia] || IAS.claude;
    var url = (ctx.estado.config && ctx.estado.config[info.campo]) || info.padrao;
    var ok = copiarSincrono(texto);
    if (!ok && navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(texto).then(function () {}, function () {}); ok = true; }
    window.open(url, '_blank', 'noopener');
    if (ok) ctx.aviso('Prompt copiado! Cole no ' + info.nome + ' (Ctrl+V).');
    else verPrompt(ctx, texto, 'Não consegui copiar automaticamente. Use o botão Copiar.');
  }

  // Painel com o prompt editável e os botões das duas IAs
  function verPrompt(ctx, texto, aviso, titulo) {
    var area = h('textarea', { class: 'mono prompt-area', rows: 18, 'aria-label': 'Prompt para a IA' });
    area.value = texto;
    var copiar = h('button', { class: 'btn btn-secundario' }, 'Copiar');
    copiar.addEventListener('click', function () {
      var ok = copiarSincrono(area.value);
      if (!ok) { area.select(); }
      ctx.aviso(ok ? 'Prompt copiado.' : 'Selecionei o texto: copie com Ctrl+C.');
    });
    var padrao = (ctx.estado.config && ctx.estado.config.ia_padrao) || 'claude';
    var botoes = ['claude', 'chatgpt'].map(function (ia) {
      return h('button', { class: 'btn ' + (ia === padrao ? 'btn-primario' : 'btn-secundario'), onclick: function () { abrirIA(ctx, ia, area.value); } }, 'Copiar e abrir o ' + IAS[ia].nome);
    });
    UI.painel(titulo || 'Prompt do Dia', h('div', null,
      aviso ? h('div', { class: 'aviso-caixa' }, aviso) : null,
      h('p', { class: 'pequeno suave' }, 'O mesmo texto serve para o Claude e para o ChatGPT. Você pode editar antes de copiar.'), area), [botoes, copiar]);
  }

  // Carrega tudo o que o painel e os prompts precisam
  function carregarDados(ctx, c) {
    var sb = ctx.sb, hoje = U.hojeISO(), desde = U.addDias(hoje, -120);
    return A360D.carregarEdital(sb, c.id).then(function (discs) {
      var ids = discs.map(function (d) { return d.id; });
      var vazio = Promise.resolve({ data: [] });
      return Promise.all([
        sb.from('a360_v_revisoes').select('*').eq('concurso_id', c.id).order('data_prevista'),
        ids.length ? sb.from('a360_erros').select('id,assunto_id,disciplina_id,data,motivo,descricao,revisado').in('disciplina_id', ids).eq('revisado', false).is('excluido_em', null) : vazio,
        sb.from('a360_sessoes').select('data,minutos,status,disciplina_id,concurso_id').gte('data', desde).is('excluido_em', null),
        sb.from('a360_questoes').select('data,feitas,acertos,disciplina_id').gte('data', desde).is('excluido_em', null),
        sb.from('a360_planejamentos').select('*').eq('concurso_id', c.id).eq('vigente', true).is('excluido_em', null).maybeSingle(),
        sb.from('a360_checkpoints').select('id,data_referencia,proxima,propostas,correcoes,propostas_vistas,criado_em').eq('concurso_id', c.id).is('excluido_em', null).order('criado_em', { ascending: false }).limit(10)
      ]).then(function (r) {
        var erroVisao = r[0].error && /a360_v_revisoes|a360_v_assuntos_stats/.test(String(r[0].error.message));
        return montar(ctx, c, discs, {
          revisoes: r[0].data || [], erros: r[1].data || [], sessoes: r[2].data || [], questoes: r[3].data || [],
          plano: r[4].data || null, checkpoints: r[5].data || [], faltaEtapa4: erroVisao
        }, hoje);
      });
    });
  }

  function montar(ctx, c, discs, x, hoje) {
    var seg = C.inicioSemana(hoje);
    var idsDisc = {}; discs.forEach(function (d) { idsDisc[d.id] = d; });
    var porId = {}; discs.forEach(function (d) { d.assuntos.forEach(function (a) { porId[a.id] = { a: a, d: d }; }); });
    // semana (concurso ativo)
    var minSem = {}, minTot = 0;
    x.sessoes.forEach(function (s) { if (s.status === 'REALIZADO' && s.data >= seg && s.concurso_id === c.id) { minSem[s.disciplina_id] = (minSem[s.disciplina_id] || 0) + s.minutos; minTot += s.minutos; } });
    var qSem = 0, q30 = 0, a30 = 0;
    x.questoes.forEach(function (q) {
      if (!idsDisc[q.disciplina_id]) return;
      if (q.data >= seg) qSem += q.feitas;
      if (U.difDias(hoje, q.data) < 30) { q30 += q.feitas; a30 += q.acertos; }
    });
    // sequência (todos os concursos)
    var minimo = (ctx.estado.config && ctx.estado.config.minimo_minutos_streak) || 15;
    var seq = C.sequencia(C.diasQueContam(x.sessoes, x.questoes, minimo), hoje);
    ctx.estado.sequencia = seq;
    var el = document.getElementById('seq'); if (el) { el.textContent = 'Sequência: ' + seq + ' dia' + (seq === 1 ? '' : 's'); el.hidden = false; }
    // ciclo e próxima da vez
    var horas = x.plano ? Number(x.plano.horas_semana) : 20;
    var rows = C.distribuirCiclo(discs.map(function (d) {
      return { id: d.id, nome: d.nome, peso: d.peso, incidencia: d.incidencia, feitas: d.feitas, acertos: d.acertos, pendente: d.assuntos.some(function (a) { return a.status !== 'dominado'; }) };
    }), horas);
    // RN10: com planejamento aprovado, valem as horas aprovadas
    if (x.plano) rows.forEach(function (r) { var d = idsDisc[r.id]; if (d && d.horas_ciclo !== null && d.horas_ciclo !== undefined) r.horas = Number(d.horas_ciclo); });
    var asPorDisc = {}; discs.forEach(function (d) { asPorDisc[d.id] = d.assuntos; });
    var prox = discs.length ? C.proximaDaVez(rows, minSem, asPorDisc) : null;
    // revisões vencidas ou de hoje
    var revHoje = x.revisoes.filter(function (r) { return r.data_prevista <= hoje; });
    // erros recorrentes com nomes
    var rec = C.errosRecorrentes(x.erros, hoje);
    var recItens = [];
    rec.forEach(function (r) {
      var info = porId[r.assunto_id]; if (!info) return;
      r.erros.slice(0, 2).forEach(function (e) { recItens.push({ disciplina: info.d.nome, assunto: info.a.descricao, motivo: e.motivo, descricao: e.descricao }); });
    });
    var base = {
      hoje: hoje, concurso: c, sequencia: seq, semanaHoras: minTot / 60, metaHoras: horas,
      semanaQuestoes: qSem, metaQuestoes: x.plano ? x.plano.meta_questoes_semana : 0,
      revisoes: revHoje, recorrentes: recItens
    };
    function estudoDe(a, d) {
      if (!a) return null;
      return { disciplina: d.nome, assunto: a.descricao, status: a.status, ultimo_ponto: a.ultimo_ponto, dificuldades: a.dificuldades, feitas: a.stats ? a.stats.feitas : 0, acertos: a.stats ? a.stats.acertos : 0 };
    }
    return {
      discs: discs, rows: rows, prox: prox, revHoje: revHoje, rec: rec, x: x, horas: horas, minTot: minTot, qSem: qSem, q30: q30, a30: a30, seq: seq,
      prompt: function (tipo, assuntoId) {
        var d = Object.assign({ tipo: tipo }, base);
        if (tipo === 'geral' && prox && prox.assunto) d.estudo = estudoDe(prox.assunto, idsDisc[prox.disciplina.id]);
        if (tipo === 'assunto') { var i = porId[assuntoId]; d.estudo = i ? estudoDe(i.a, i.d) : null; }
        if (tipo === 'erros') d.recorrentes = x.erros.slice(0, 15).map(function (e) { var i = porId[e.assunto_id]; return i ? { disciplina: i.d.nome, assunto: i.a.descricao, motivo: e.motivo, descricao: e.descricao } : null; }).filter(Boolean);
        return C.montarPrompt(d);
      }
    };
  }

  // ------------------------------------------------------------------
  // HOJE
  // ------------------------------------------------------------------
  A360T.hoje = function (ctx, el, vivo) {
    var hoje = U.hojeISO();
    el.appendChild(h('h1', null, 'Hoje · ' + U.dataBR(hoje)));
    var c = ctx.ativo();
    if (!c) {
      el.appendChild(UI.vazio('Comece pelo seu concurso.',
        'No Claude ou no ChatGPT, envie o edital e use o comando /edital. Depois cole aqui o bloco EDITAL gerado. Se preferir, cadastre o concurso à mão.',
        [h('a', { class: 'btn btn-primario', href: '#/importar?aba=edital' }, 'Importar EDITAL'), h('a', { class: 'btn btn-secundario', href: '#/concursos' }, 'Novo concurso')]));
      return;
    }
    var area = h('div', null, h('p', { class: 'suave' }, 'Carregando…'));
    el.appendChild(area);
    return carregarDados(ctx, c).then(function (P) {
      if (!vivo()) return;
      area.innerHTML = '';
      if (!P.discs.length) {
        area.appendChild(UI.vazio('O concurso ' + c.codigo + ' ainda não tem edital.', 'Peça /edital à IA e cole o bloco em Importar.', [h('a', { class: 'btn btn-primario', href: '#/importar?aba=edital' }, 'Importar EDITAL')]));
        return;
      }
      if (P.x.faltaEtapa4) area.appendChild(h('div', { class: 'cartao erro-caixa' }, 'Falta instalar a etapa 4 no banco: rode supabase/03-checkpoint-revisoes.sql no SQL Editor do Supabase.'));

      // 1. Cartão principal
      var padrao = (ctx.estado.config && ctx.estado.config.ia_padrao) || 'claude';
      var outra = padrao === 'claude' ? 'chatgpt' : 'claude';
      var proxTxt = P.prox && P.prox.assunto ? P.prox.disciplina.nome + ' › ' + P.prox.assunto.descricao : (P.prox ? P.prox.disciplina.nome : '—');
      var abertos = P.x.erros.length;
      area.appendChild(h('section', { class: 'cartao-estudar' },
        h('div', { class: 'ce-texto' },
          h('div', { class: 'ce-rotulo' }, 'Sua próxima sessão'),
          h('div', { class: 'ce-titulo' }, proxTxt),
          h('div', null, P.revHoje.length + ' revisão(ões) vencida(s) ou para hoje · ' + abertos + ' erro(s) não revisado(s) · semana: ' + U.num1(P.minTot / 60) + ' h de ' + U.num1(P.horas) + ' h')),
        h('div', { class: 'ce-botoes' },
          h('button', { class: 'btn btn-branco', onclick: function () { abrirIA(ctx, padrao, P.prompt('geral')); } }, 'Estudar no ' + IAS[padrao].nome),
          h('button', { class: 'btn btn-contorno', onclick: function () { abrirIA(ctx, outra, P.prompt('geral')); } }, 'Estudar no ' + IAS[outra].nome),
          h('button', { class: 'btn-link branco', onclick: function () { verPrompt(ctx, P.prompt('geral')); } }, 'Ver prompt'))));

      // 2. Indicadores
      var tot = 0, cob = 0, dom = 0;
      P.discs.forEach(function (d) { d.assuntos.forEach(function (a) { tot++; if (a.status !== 'nao_iniciado') cob++; if (a.status === 'dominado') dom++; }); });
      var dias = c.data_prova ? U.difDias(c.data_prova, U.hojeISO()) : null;
      area.appendChild(h('div', { class: 'grade-indicadores' },
        ind('Dias até a prova', dias === null ? '—' : (dias < 0 ? '✔' : String(dias)), dias === null ? 'Data não definida' : (dias < 0 ? 'Prova realizada' : 'prova em ' + U.dataBR(c.data_prova))),
        ind('Edital coberto', tot ? Math.round(cob / tot * 100) + '%' : '—', dom + ' de ' + tot + ' assuntos dominados'),
        ind('Acerto (30 dias)', P.q30 ? U.pct(P.a30, P.q30) : '—', P.q30 + ' questões'),
        ind('Horas na semana', U.num1(P.minTot / 60) + ' h', 'meta: ' + U.num1(P.horas) + ' h' + (P.x.plano ? '' : ' (padrão; defina em Ciclo)') + ' · ' + P.qSem + ' questões')));

      // 3. Revisões de hoje + 4. Acerto por disciplina
      var colRev = h('section', { class: 'cartao col' }, h('div', { class: 'titulo-acoes' }, h('h2', null, 'Revisões de hoje'),
        P.revHoje.length ? h('button', { class: 'btn btn-secundario btn-peq', onclick: function () { verPrompt(ctx, P.prompt('revisao'), null, 'Prompt: revisões de hoje'); } }, 'Revisar na IA') : null));
      if (!P.revHoje.length) colRev.appendChild(h('p', { class: 'sucesso' }, 'Nenhuma revisão pendente hoje.'));
      P.revHoje.slice(0, 8).forEach(function (r) {
        var atraso = U.difDias(hoje, r.data_prevista);
        colRev.appendChild(h('a', { class: 'linha-rev-hoje', href: '#/revisoes' },
          h('div', null, h('div', { class: 'forte' }, r.assunto), h('div', { class: 'pequeno suave' }, r.disciplina + ' · etapa ' + r.etapa)),
          h('span', { class: 'chip ' + (atraso > 0 ? 'st-nao' : 'st-estudo') }, atraso > 0 ? 'atraso ' + atraso + 'd' : 'hoje')));
      });
      if (P.revHoje.length > 8) colRev.appendChild(h('a', { href: '#/revisoes', class: 'pequeno' }, '+ ' + (P.revHoje.length - 8) + ' revisões'));

      var colAc = h('section', { class: 'cartao col' }, h('h2', null, 'Acerto por disciplina'));
      var barras = P.discs.slice().sort(function (a, b) { return (a.feitas ? a.acertos / a.feitas : 2) - (b.feitas ? b.acertos / b.feitas : 2); });
      barras.forEach(function (d) {
        var p = d.feitas ? d.acertos / d.feitas : 0;
        colAc.appendChild(h('div', { class: 'barra-disc' },
          h('div', { class: 'bd-topo' }, h('span', null, d.nome), h('strong', null, d.feitas ? U.pct(d.acertos, d.feitas) : 'sem dados')),
          UI.barra(p * 100, p >= 0.8 ? 'verde' : (p >= 0.65 ? '' : 'laranja'))));
      });
      area.appendChild(h('div', { class: 'duas-colunas' }, colRev, colAc));

      // 5. Alertas vindos da IA (PROPOSTA / CORRECAO)
      var pendentes = P.x.checkpoints.filter(function (k) { return (k.propostas || k.correcoes) && !k.propostas_vistas; });
      pendentes.forEach(function (k) {
        area.appendChild(h('section', { class: 'cartao alerta-ia' },
          h('h2', null, 'Da IA, em ' + U.dataBR(k.data_referencia)),
          k.propostas ? h('div', null, h('strong', null, 'Proposta aguardando sua aprovação: '), h('span', { class: 'pre-linha' }, k.propostas)) : null,
          k.correcoes ? h('div', null, h('strong', null, 'Correção de informação anterior: '), h('span', { class: 'pre-linha' }, k.correcoes)) : null,
          h('div', { class: 'barra-acoes' }, h('button', { class: 'btn btn-secundario btn-peq', onclick: function (ev) {
            ev.target.disabled = true;
            ctx.sb.from('a360_checkpoints').update({ propostas_vistas: true }).eq('id', k.id).then(function (r) { if (r.error) { ctx.aviso(UI.erroBanco(r.error)); ev.target.disabled = false; return; } ctx.aviso('Ok.'); ctx.rotear(); });
          } }, 'Marcar como vista'))));
      });

      // 6. Próxima atividade combinada
      var ult = P.x.checkpoints.filter(function (k) { return k.proxima; })[0];
      if (ult) area.appendChild(h('section', { class: 'cartao info' }, h('strong', null, 'Próxima atividade combinada com a IA: '), ult.proxima));
    });
  };
  function ind(rot, valor, sub) {
    return h('div', { class: 'indicador' }, h('div', { class: 'ind-rotulo' }, rot), h('div', { class: 'ind-valor' }, valor), h('div', { class: 'ind-sub' }, sub));
  }

  window.A360PR = {
    abrirIA: abrirIA, verPrompt: verPrompt,
    // usado pelo Edital ("Estudar") e por Revisões ("Revisar na IA")
    gerar: function (ctx, tipo, assuntoId) {
      var c = ctx.ativo(); if (!c) return Promise.reject(new Error('Nenhum concurso ativo.'));
      return carregarDados(ctx, c).then(function (P) { return P.prompt(tipo, assuntoId); });
    }
  };
})();
