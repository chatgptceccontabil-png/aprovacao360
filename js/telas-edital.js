// =====================================================================
// Aprovação 360° — telas Importar (EDITAL) e Edital verticalizado
// =====================================================================
(function () {
  'use strict';
  var h = A360U.h, UI = A360UI, U = A360U, P = A360P;
  window.A360T = window.A360T || {};

  // Carrega disciplinas + assuntos de um concurso
  function carregarEdital(sb, concursoId) {
    return sb.from('a360_disciplinas').select('id,nome,peso,incidencia,ordem').eq('concurso_id', concursoId).is('excluido_em', null).order('ordem').then(function (r) {
      if (r.error) throw r.error;
      var discs = r.data || [];
      if (!discs.length) return [];
      return sb.from('a360_assuntos').select('id,disciplina_id,item_edital,descricao,status,ultima_atividade,ultimo_ponto,dificuldades,ordem')
        .in('disciplina_id', discs.map(function (d) { return d.id; })).is('excluido_em', null).order('ordem').then(function (r2) {
          if (r2.error) throw r2.error;
          var por = {}; discs.forEach(function (d) { d.assuntos = []; por[d.id] = d; });
          (r2.data || []).forEach(function (a) { if (por[a.disciplina_id]) por[a.disciplina_id].assuntos.push(a); });
          // desempenho por assunto (etapa 4); se a visão ainda não existir, segue sem números
          return sb.from('a360_v_assuntos_stats').select('assunto_id,feitas,acertos,dias,proxima_revisao,etapa_revisao').eq('concurso_id', concursoId).then(function (r3) {
            var st = {}; if (!r3.error) (r3.data || []).forEach(function (x) { st[x.assunto_id] = x; });
            discs.forEach(function (d) {
              d.feitas = 0; d.acertos = 0;
              d.assuntos.forEach(function (a) { a.stats = st[a.id] || null; if (a.stats) { d.feitas += a.stats.feitas; d.acertos += a.stats.acertos; } });
            });
            return discs;
          }, function () { return discs; });
        });
    });
  }

  // ------------------------------------------------------------------
  // IMPORTAR
  // ------------------------------------------------------------------
  A360T.importar = function (ctx, el) {
    var aba = /aba=edital/.test(location.hash) ? 'edital' : (ctx.estado.concursos.length ? 'checkpoint' : 'edital');
    el.appendChild(h('h1', null, 'Importar'));
    var abas = h('div', { class: 'abas', role: 'tablist' });
    var corpo = h('div');
    function mudar(nova) {
      aba = nova;
      abas.querySelectorAll('button').forEach(function (b) { var on = b.getAttribute('data-aba') === aba; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      corpo.innerHTML = '';
      if (aba === 'edital') abaEdital(ctx, corpo);
      else window.A360ABAS.checkpoint(ctx, corpo);
    }
    [['checkpoint', 'CHECKPOINT'], ['edital', 'EDITAL']].forEach(function (a) {
      abas.appendChild(h('button', { role: 'tab', 'data-aba': a[0], onclick: function () { mudar(a[0]); } }, a[1]));
    });
    el.appendChild(abas); el.appendChild(corpo);
    mudar(aba);
  };

  function abaEdital(ctx, el) {
    el.appendChild(h('p', { class: 'suave' }, 'No Claude ou no ChatGPT, envie o PDF do edital e digite /edital. A IA gera um bloco que começa com "=== EDITAL ===". Copie o bloco inteiro e cole aqui. Se o concurso já existir, só entram as disciplinas e os assuntos novos (e os pesos atualizados): nada é apagado.'));
    var txt = h('textarea', { rows: 14, class: 'mono', 'aria-label': 'Bloco EDITAL gerado pela IA', placeholder: '=== EDITAL ===\nCONCURSO | ISS-CIDADE-CARGO-2026 | Prefeitura de … | Auditor Fiscal | Banca | 01/2026 | 2027-03-21\nDISCIPLINA | Direito Tributário | 5 | 5\nASSUNTO | Direito Tributário | 1 | Competência tributária\n=== FIM ===' });
    var msg = h('div', { class: 'cartao erro-caixa', hidden: true, role: 'alert' });
    var prev = h('div');
    var analisar = h('button', { class: 'btn btn-primario' }, 'Analisar');
    var limpar = h('button', { class: 'btn btn-secundario', onclick: function () { txt.value = ''; prev.innerHTML = ''; msg.hidden = true; txt.focus(); } }, 'Limpar');
    el.appendChild(h('div', { class: 'campo' }, h('label', { for: 'txt-edital' }, 'Bloco EDITAL'), txt));
    txt.id = 'txt-edital';
    el.appendChild(h('div', { class: 'barra-acoes' }, analisar, limpar));
    el.appendChild(msg); el.appendChild(prev);

    txt.addEventListener('paste', function () { setTimeout(function () { analisar.click(); }, 50); });
    analisar.addEventListener('click', function () {
      msg.hidden = true; prev.innerHTML = '';
      var lido = P.lerEdital(txt.value);
      if (lido.erro) { msg.textContent = lido.erro; msg.hidden = false; return; }
      var existente = ctx.estado.concursos.filter(function (c) { return c.codigo.toLowerCase() === lido.concurso.codigo.toLowerCase(); })[0];
      var carregar = existente ? carregarEdital(ctx.sb, existente.id) : Promise.resolve(null);
      analisar.disabled = true;
      carregar.then(function (discs) {
        analisar.disabled = false;
        var plano = P.planejarEdital(lido, existente ? { concurso: existente, disciplinas: discs } : null);
        mostrarPrevia(ctx, prev, lido, plano, existente);
      }).catch(function (e) { analisar.disabled = false; msg.textContent = UI.erroBanco(e); msg.hidden = false; });
    });
  }

  function mostrarPrevia(ctx, el, lido, plano, existente) {
    var c = lido.concurso, r = plano.resumo;
    var cab = existente
      ? h('div', { class: 'aviso-caixa' }, h('strong', null, 'Atualizar o concurso ' + existente.codigo + '?'), ' Disciplinas e assuntos novos serão acrescentados; nada será apagado.')
      : h('div', { class: 'ok-caixa' }, h('strong', null, 'Novo concurso: ' + c.codigo), ' · ' + c.cargo + ' · ' + c.orgao + (c.banca ? ' · ' + c.banca : '') + (c.data_prova ? ' · prova em ' + U.dataBR(c.data_prova) : ''));
    var lista = h('div', { class: 'previa' });
    lido.linhas.forEach(function (l) {
      var sinal = l.status === 'erro' ? ['✖ inválida', 'st-nao'] : (l.status === 'aviso' ? ['⚠ aviso', 'st-estudo'] : ['✔ ok', 'st-dominado']);
      var acao = '';
      if (l.status !== 'erro') {
        if (l.tipo === 'ASSUNTO') acao = l.acao === 'existe' ? 'já existe' : 'novo';
        if (l.tipo === 'DISCIPLINA') {
          var d = plano.disciplinas.filter(function (x) { return U.norm(x.nome) === U.norm(l.campos[0]); })[0];
          if (d) acao = d.acao === 'nova' ? 'nova' : (d.acao === 'atualiza' ? 'atualiza peso/incidência (antes ' + d.antes.peso + '/' + d.antes.incidencia + ')' : 'sem mudança');
        }
        if (l.tipo === 'CONCURSO') acao = existente ? 'já existe' : 'novo';
      }
      lista.appendChild(h('div', { class: 'previa-linha' },
        h('span', { class: 'chip ' + sinal[1] }, sinal[0]),
        h('div', { class: 'previa-texto' }, h('div', null, h('strong', null, l.tipo), ' · ', l.campos.join(' · ')), l.msg ? h('div', { class: 'pequeno ' + (l.status === 'erro' ? 'erro' : 'alerta') }, l.msg) : null),
        acao ? h('span', { class: 'pequeno suave' }, acao) : null));
    });
    var nada = !existente ? false : (r.discNovas + r.discAtualizadas + r.assNovos === 0);
    var conf = h('button', { class: 'btn btn-sucesso', disabled: nada },
      existente ? 'Confirmar: ' + r.discNovas + ' disciplina(s) nova(s), ' + r.discAtualizadas + ' atualizada(s), ' + r.assNovos + ' assunto(s) novo(s)'
        : 'Confirmar: criar concurso com ' + r.discNovas + ' disciplina(s) e ' + r.assNovos + ' assunto(s)');
    var dica = h('span', { class: 'pequeno suave' }, nada ? 'Nada novo para importar: este edital já está todo cadastrado.' : (r.assErro ? r.assErro + ' linha(s) inválida(s) serão ignoradas.' : 'Tudo é gravado de uma vez; se algo falhar, nada é gravado.'));
    conf.addEventListener('click', function () {
      conf.disabled = true;
      ctx.sb.rpc('a360_importar_edital', { dados: P.payloadEdital(lido, plano) }).then(function (res) {
        if (res.error) { conf.disabled = false; ctx.aviso(UI.erroBanco(res.error)); return; }
        var d = res.data;
        var ativar = (d.concurso_novo || !ctx.estado.ativoId) ? ctx.definirAtivo(d.concurso_id) : Promise.resolve();
        ativar.then(function () {
          ctx.aviso('Edital importado: ' + d.disciplinas_novas + ' disciplina(s) nova(s), ' + d.disciplinas_atualizadas + ' atualizada(s), ' + d.assuntos_novos + ' assunto(s) novo(s).');
          return ctx.recarregar();
        }).then(function () { ctx.ir('edital'); });
      });
    });
    el.appendChild(h('div', { class: 'cartao' }, h('h2', null, 'Pré-visualização'), cab, lista, h('div', { class: 'barra-acoes' }, conf, dica)));
  }

  // ------------------------------------------------------------------
  // EDITAL VERTICALIZADO
  // ------------------------------------------------------------------
  A360T.edital = function (ctx, el, vivo) {
    var c = ctx.ativo();
    el.appendChild(h('div', { class: 'titulo-acoes' }, h('h1', null, 'Edital verticalizado'),
      c ? h('div', { class: 'barra-acoes' }, h('button', { class: 'btn btn-secundario', onclick: function () { formDisciplina(ctx, c, null); } }, '+ Disciplina'), h('a', { class: 'btn btn-primario', href: '#/importar' }, 'Importar EDITAL')) : null));
    if (!c) {
      el.appendChild(UI.vazio('Nenhum edital ainda.', 'No Claude ou no ChatGPT, use /edital e cole aqui o bloco EDITAL.', [h('a', { class: 'btn btn-primario', href: '#/importar' }, 'Importar EDITAL')]));
      return;
    }
    var area = h('div', null, h('p', { class: 'suave' }, 'Carregando…'));
    el.appendChild(area);
    return carregarEdital(ctx.sb, c.id).then(function (discs) {
      if (!vivo()) return;
      area.innerHTML = '';
      if (!discs.length) {
        area.appendChild(UI.vazio('Este concurso ainda não tem disciplinas.', 'Importe o bloco EDITAL ou inclua as disciplinas à mão.', [h('a', { class: 'btn btn-primario', href: '#/importar' }, 'Importar EDITAL'), h('button', { class: 'btn btn-secundario', onclick: function () { formDisciplina(ctx, c, null); } }, '+ Disciplina')]));
        return;
      }
      var total = 0, cob = 0, dom = 0;
      discs.forEach(function (d) { d.assuntos.forEach(function (a) { total++; if (a.status !== 'nao_iniciado') cob++; if (a.status === 'dominado') dom++; }); });
      var pc = total ? Math.round(cob / total * 100) : 0, pd = total ? Math.round(dom / total * 100) : 0;
      area.appendChild(h('div', { class: 'cartao resumo-edital' },
        h('div', null, h('div', { class: 'ind-rotulo' }, 'Edital coberto (RN13)'), h('div', { class: 'ind-valor' }, pc + '%'), UI.barra(pc)),
        h('div', null, h('div', { class: 'ind-rotulo' }, 'Dominado'), h('div', { class: 'ind-valor sucesso' }, pd + '%'), UI.barra(pd, 'verde')),
        h('div', { class: 'pequeno suave' }, total + ' assuntos em ' + discs.length + ' disciplinas. "Dominado" é automático: 80% ou mais de acerto em pelo menos 20 questões, feitas em 2 dias diferentes.')));

      // filtros
      var busca = UI.entrada({ type: 'search', placeholder: 'Buscar assunto…', 'aria-label': 'Buscar assunto' });
      var filtro = UI.selecao([['', 'Todos os status'], ['nao_iniciado', 'Nunca visto'], ['em_estudo', 'Em estudo'], ['revisao', 'Revisão'], ['dominado', 'Dominado']], '', { 'aria-label': 'Filtrar por status' });
      area.appendChild(h('div', { class: 'barra-acoes filtros' }, busca, filtro));
      var listaEl = h('div', { class: 'lista-disciplinas' });
      area.appendChild(listaEl);

      function desenhar() {
        listaEl.innerHTML = '';
        var q = U.norm(busca.value), st = filtro.value, algum = false;
        discs.forEach(function (d) {
          var ass = d.assuntos.filter(function (a) { return (!q || U.norm(a.descricao + ' ' + (a.item_edital || '')).indexOf(q) >= 0) && (!st || a.status === st); });
          if ((q || st) && !ass.length) return;
          algum = true;
          listaEl.appendChild(cartaoDisciplina(ctx, c, d, ass));
        });
        if (!algum) listaEl.appendChild(h('div', { class: 'cartao vazio' }, 'Nenhum assunto encontrado com esse filtro.'));
      }
      busca.addEventListener('input', desenhar); filtro.addEventListener('change', desenhar);
      desenhar();
    });
  };

  function cartaoDisciplina(ctx, c, d, assuntos) {
    var cob = d.assuntos.filter(function (a) { return a.status !== 'nao_iniciado'; }).length;
    var pc = d.assuntos.length ? Math.round(cob / d.assuntos.length * 100) : 0;
    var notas = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
    var peso = UI.selecao(notas, d.peso, { 'aria-label': 'Peso de ' + d.nome, class: 'sel-peq' });
    var inc = UI.selecao(notas, d.incidencia, { 'aria-label': 'Incidência de ' + d.nome, class: 'sel-peq' });
    // RN05 (sem dados de acerto ainda: usa 0,5)
    var prio = h('span', { class: 'pequeno suave' });
    function atualizaPrio() {
      var temDados = (d.feitas || 0) >= 10, ac = temDados ? d.acertos / d.feitas : 0.5;
      prio.textContent = 'prioridade ' + U.num1(d.peso * d.incidencia * (1 - ac)) + (temDados ? ' · acerto ' + U.pct(d.acertos, d.feitas) + ' em ' + d.feitas + ' questões' : ' (acerto sem dados suficientes: 50%)');
    }
    atualizaPrio();
    function salvarNota() {
      var np = parseInt(peso.value, 10), ni = parseInt(inc.value, 10);
      ctx.sb.from('a360_disciplinas').update({ peso: np, incidencia: ni }).eq('id', d.id).then(function (r) {
        if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
        d.peso = np; d.incidencia = ni; atualizaPrio(); ctx.aviso('Prioridade recalculada.');
      });
    }
    peso.addEventListener('change', salvarNota); inc.addEventListener('change', salvarNota);

    var linhas = h('div', { class: 'tabela-assuntos' });
    assuntos.forEach(function (a) {
      linhas.appendChild(h('div', { class: 'linha-assunto' },
        h('span', { class: 'item' }, a.item_edital || '—'),
        h('span', { class: 'desc' }, a.descricao, a.ultimo_ponto ? h('div', { class: 'pequeno suave' }, 'Último ponto: ' + a.ultimo_ponto) : null),
        UI.chipStatus(a.status),
        h('span', { class: 'pequeno suave col-q' }, a.stats && a.stats.feitas ? a.stats.feitas + ' q · ' + U.pct(a.stats.acertos, a.stats.feitas) : 'sem questões'),
        h('span', { class: 'pequeno suave col-ativ' }, a.stats && a.stats.proxima_revisao ? 'revisão ' + U.dataBR(a.stats.proxima_revisao).slice(0, 5) : (a.ultima_atividade ? 'última atividade ' + U.dataBR(a.ultima_atividade) : 'sem atividade')),
        h('span', { class: 'acoes-linha' },
          h('button', { class: 'btn-link', onclick: function () { formAssunto(ctx, d, a); } }, 'Editar'),
          h('button', { class: 'btn-link perigo', onclick: function () { excluirAssunto(ctx, a); } }, 'Excluir'))));
    });
    if (!d.assuntos.length) linhas.appendChild(h('div', { class: 'pequeno suave' }, 'Nenhum assunto nesta disciplina.'));

    return h('section', { class: 'cartao' },
      h('div', { class: 'disc-topo' },
        h('h2', null, d.nome),
        h('div', { class: 'disc-notas' }, h('label', null, 'peso ', peso), h('label', null, 'incidência ', inc), prio)),
      h('div', { class: 'disc-prog' }, h('span', { class: 'pequeno suave' }, cob + ' de ' + d.assuntos.length + ' assuntos iniciados'), UI.barra(pc)),
      linhas,
      h('div', { class: 'barra-acoes' },
        h('button', { class: 'btn btn-secundario btn-peq', onclick: function () { formAssunto(ctx, d, null); } }, '+ Assunto'),
        h('button', { class: 'btn btn-secundario btn-peq', onclick: function () { formDisciplina(ctx, c, d); } }, 'Renomear'),
        h('button', { class: 'btn btn-perigo btn-peq', onclick: function () { excluirDisciplina(ctx, d); } }, 'Excluir disciplina')));
  }

  function formDisciplina(ctx, c, d) {
    var nome = UI.entrada({ value: d ? d.nome : '' });
    var cn = UI.campo('Nome da disciplina *', nome);
    var extra = [];
    var peso, inc;
    if (!d) {
      peso = UI.selecao([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 3); inc = UI.selecao([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 3);
      extra = [UI.campo('Peso no edital (1 a 5)', peso), UI.campo('Incidência na banca (1 a 5)', inc)];
    }
    var salvar = h('button', { class: 'btn btn-primario' }, d ? 'Salvar' : 'Incluir');
    var p = UI.painel(d ? 'Renomear disciplina' : 'Nova disciplina', h('div', null, cn, extra), [salvar]);
    salvar.addEventListener('click', function () {
      var n = nome.value.trim(); cn.erro('');
      if (!n) { cn.erro('Informe o nome.'); return; }
      salvar.disabled = true;
      carregarEdital(ctx.sb, c.id).then(function (discs) {
        if (discs.some(function (x) { return U.norm(x.nome) === U.norm(n) && (!d || x.id !== d.id); })) { salvar.disabled = false; cn.erro('Já existe uma disciplina com esse nome neste concurso.'); return; }
        var q = d ? ctx.sb.from('a360_disciplinas').update({ nome: n }).eq('id', d.id)
          : ctx.sb.from('a360_disciplinas').insert({ concurso_id: c.id, nome: n, peso: parseInt(peso.value, 10), incidencia: parseInt(inc.value, 10), ordem: discs.reduce(function (m, x) { return Math.max(m, x.ordem); }, 0) + 1 });
        return q.then(function (r) {
          salvar.disabled = false;
          if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
          p.fechar(); ctx.aviso(d ? 'Disciplina renomeada.' : 'Disciplina incluída.'); ctx.rotear();
        });
      }).catch(function (e) { salvar.disabled = false; ctx.aviso(UI.erroBanco(e)); });
    });
  }

  function formAssunto(ctx, d, a) {
    var item = UI.entrada({ value: a ? (a.item_edital || '') : '', maxlength: 20, placeholder: '3.2' });
    var desc = UI.entrada({ value: a ? a.descricao : '', placeholder: 'Lançamento tributário' });
    var ci = UI.campo('Nº do item no edital', item), cd = UI.campo('Assunto *', desc);
    var salvar = h('button', { class: 'btn btn-primario' }, a ? 'Salvar' : 'Incluir');
    var p = UI.painel((a ? 'Editar assunto · ' : 'Novo assunto · ') + d.nome, h('div', null, ci, cd), [salvar]);
    salvar.addEventListener('click', function () {
      var n = desc.value.trim(); cd.erro('');
      if (!n) { cd.erro('Informe o assunto.'); return; }
      // RN22: nome único dentro da disciplina
      if (d.assuntos.some(function (x) { return U.norm(x.descricao) === U.norm(n) && (!a || x.id !== a.id); })) { cd.erro('Já existe um assunto com esse nome nesta disciplina.'); return; }
      salvar.disabled = true;
      var dados = { item_edital: item.value.trim() || null, descricao: n };
      var q = a ? ctx.sb.from('a360_assuntos').update(dados).eq('id', a.id)
        : ctx.sb.from('a360_assuntos').insert(Object.assign(dados, { disciplina_id: d.id, ordem: d.assuntos.reduce(function (m, x) { return Math.max(m, x.ordem); }, 0) + 1 }));
      q.then(function (r) {
        salvar.disabled = false;
        if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
        p.fechar(); ctx.aviso(a ? 'Assunto atualizado.' : 'Assunto incluído.'); ctx.rotear();
      });
    });
  }

  // RN31: exclusão lógica
  function excluirAssunto(ctx, a) {
    if (!ctx.confirmar('Excluir o assunto "' + a.descricao + '"?')) return;
    ctx.sb.from('a360_assuntos').update({ excluido_em: new Date().toISOString() }).eq('id', a.id).then(function (r) {
      if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
      ctx.aviso('Assunto excluído.'); ctx.rotear();
    });
  }
  function excluirDisciplina(ctx, d) {
    if (!ctx.confirmar('Excluir a disciplina "' + d.nome + '"? Isso também oculta ' + d.assuntos.length + ' assunto(s).')) return;
    var agora = new Date().toISOString();
    ctx.sb.from('a360_assuntos').update({ excluido_em: agora }).eq('disciplina_id', d.id).is('excluido_em', null).then(function (r) {
      if (r.error) throw r.error;
      return ctx.sb.from('a360_disciplinas').update({ excluido_em: agora }).eq('id', d.id);
    }).then(function (r) {
      if (r.error) throw r.error;
      ctx.aviso('Disciplina excluída.'); ctx.rotear();
    }).catch(function (e) { ctx.aviso(UI.erroBanco(e)); });
  }
})();
