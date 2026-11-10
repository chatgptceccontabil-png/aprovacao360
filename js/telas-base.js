// =====================================================================
// Aprovação 360° — telas Hoje (provisória), Concursos e Configurações
// =====================================================================
(function () {
  'use strict';
  var h = A360U.h, UI = A360UI, U = A360U;
  window.A360T = window.A360T || {};

  // Conta assuntos por status para cada concurso (RN13)
  function progressoPorConcurso(sb) {
    return sb.from('a360_disciplinas').select('concurso_id, a360_assuntos(status, excluido_em)').is('excluido_em', null).then(function (r) {
      var mapa = {};
      (r.data || []).forEach(function (d) {
        var m = mapa[d.concurso_id] = mapa[d.concurso_id] || { total: 0, coberto: 0, dominado: 0 };
        (d.a360_assuntos || []).forEach(function (a) {
          if (a.excluido_em) return;
          m.total++; if (a.status !== 'nao_iniciado') m.coberto++; if (a.status === 'dominado') m.dominado++;
        });
      });
      return mapa;
    });
  }

  // RN14
  function diasAteProva(c) {
    if (!c.data_prova) return 'Data não definida';
    var d = U.difDias(c.data_prova, U.hojeISO());
    if (d < 0) return 'Prova realizada';
    return d === 0 ? 'A prova é hoje' : d + ' dias até a prova';
  }

  // ------------------------------------------------------------------
  // CONCURSOS
  // ------------------------------------------------------------------
  A360T.concursos = function (ctx, el, vivo) {
    var sb = ctx.sb;
    el.appendChild(h('div', { class: 'titulo-acoes' }, h('h1', null, 'Concursos'), h('button', { class: 'btn btn-primario', onclick: function () { formConcurso(ctx, null); } }, '+ Concurso')));
    var lista = ctx.estado.concursos;
    if (!lista.length) {
      el.appendChild(UI.vazio('Nenhum concurso cadastrado.', 'O jeito mais rápido é importar o bloco EDITAL gerado pela IA: o concurso, as disciplinas e os assuntos entram de uma vez.',
        [h('a', { class: 'btn btn-primario', href: '#/importar' }, 'Importar EDITAL'), h('button', { class: 'btn btn-secundario', onclick: function () { formConcurso(ctx, null); } }, 'Cadastrar à mão')]));
      return;
    }
    return progressoPorConcurso(sb).then(function (mapa) {
      if (!vivo()) return;
      var grade = h('div', { class: 'grade-cartoes' });
      lista.forEach(function (c) {
        var p = mapa[c.id] || { total: 0, coberto: 0 };
        var pc = p.total ? Math.round(p.coberto / p.total * 100) : 0;
        var ativo = c.id === ctx.estado.ativoId;
        grade.appendChild(h('div', { class: 'cartao cartao-concurso' + (ativo ? ' ativo' : '') },
          h('div', { class: 'linha-topo' },
            h('strong', { class: 'codigo' }, c.codigo),
            h('button', { class: 'btn-estrela' + (c.prioritario ? ' on' : ''), 'aria-label': c.prioritario ? 'Concurso prioritário' : 'Marcar como prioritário', title: c.prioritario ? 'Prioritário' : 'Marcar como prioritário', onclick: function () { marcarPrioritario(ctx, c); } }, c.prioritario ? '★' : '☆')),
          h('div', null, c.cargo), h('div', { class: 'suave pequeno' }, c.orgao + (c.banca ? ' · ' + c.banca : '')),
          h('div', { class: 'pequeno' }, diasAteProva(c) + ' · ' + ({ previsto: 'Previsto', publicado: 'Edital publicado', encerrado: 'Encerrado' })[c.status]),
          h('div', { class: 'pequeno' }, 'Edital coberto: ' + (p.total ? pc + '%' : '—') + ' (' + p.total + ' assuntos)'), UI.barra(pc),
          h('div', { class: 'barra-acoes' },
            ativo ? h('span', { class: 'chip st-dominado' }, 'Ativo') : h('button', { class: 'btn btn-secundario btn-peq', onclick: function () { ctx.definirAtivo(c.id).then(function (ok) { if (ok) { ctx.aviso(c.codigo + ' agora é o concurso ativo.'); ctx.rotear(); } }); } }, 'Tornar ativo'),
            h('button', { class: 'btn btn-secundario btn-peq', onclick: function () { formConcurso(ctx, c); } }, 'Editar'),
            h('button', { class: 'btn btn-perigo btn-peq', onclick: function () { excluirConcurso(ctx, c); } }, 'Excluir'))));
      });
      el.appendChild(grade);
    });
  };

  function marcarPrioritario(ctx, c) {
    if (c.prioritario) return;
    var sb = ctx.sb;
    // RN09: desmarca o anterior antes de marcar o novo
    sb.from('a360_concursos').update({ prioritario: false }).eq('prioritario', true).then(function (r) {
      if (r.error) throw r.error;
      return sb.from('a360_concursos').update({ prioritario: true }).eq('id', c.id);
    }).then(function (r) {
      if (r.error) throw r.error;
      ctx.aviso(c.codigo + ' agora é o prioritário.'); ctx.recarregar();
    }).catch(function (e) { ctx.aviso(UI.erroBanco(e)); });
  }

  function excluirConcurso(ctx, c) {
    if (!ctx.confirmar('Excluir o concurso ' + c.codigo + '? Ele some das telas junto com o edital e o desempenho (exclusão lógica; os dados continuam no backup).')) return;
    ctx.sb.from('a360_concursos').update({ excluido_em: new Date().toISOString(), prioritario: false }).eq('id', c.id).then(function (r) {
      if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
      var p = c.id === ctx.estado.ativoId ? ctx.definirAtivo(null) : Promise.resolve();
      p.then(function () { ctx.aviso('Concurso excluído.'); ctx.recarregar(); });
    });
  }

  function formConcurso(ctx, c) {
    c = c || {};
    var f = {
      codigo: UI.entrada({ value: c.codigo || '', maxlength: 40, placeholder: 'ISS-SP-AFTM-2026', autocomplete: 'off' }),
      orgao: UI.entrada({ value: c.orgao || '', placeholder: 'Prefeitura de …' }),
      cargo: UI.entrada({ value: c.cargo || '', placeholder: 'Auditor Fiscal Tributário Municipal' }),
      banca: UI.entrada({ value: c.banca || '', placeholder: 'FGV, Vunesp, FCC…' }),
      edital_numero: UI.entrada({ value: c.edital_numero || '', placeholder: '01/2026' }),
      data_publicacao: UI.entrada({ type: 'date', value: c.data_publicacao || '' }),
      data_prova: UI.entrada({ type: 'date', value: c.data_prova || '' }),
      status: UI.selecao([['previsto', 'Previsto'], ['publicado', 'Edital publicado'], ['encerrado', 'Encerrado']], c.status || 'previsto'),
      link_edital: UI.entrada({ type: 'url', value: c.link_edital || '', placeholder: 'https://…' }),
      retificacoes: h('textarea', { rows: 3, placeholder: 'Ret. 01 de 02/09/2026…' })
    };
    f.retificacoes.value = c.retificacoes || '';
    var cs = {
      codigo: UI.campo('Código *', f.codigo, 'Sem espaços. Sugestão: ORGAO-CARGO-ANO.'), orgao: UI.campo('Órgão *', f.orgao), cargo: UI.campo('Cargo *', f.cargo),
      banca: UI.campo('Banca', f.banca), edital_numero: UI.campo('Nº do edital', f.edital_numero), data_publicacao: UI.campo('Publicação do edital', f.data_publicacao),
      data_prova: UI.campo('Data da prova', f.data_prova), status: UI.campo('Situação', f.status), link_edital: UI.campo('Link do edital', f.link_edital), retificacoes: UI.campo('Retificações', f.retificacoes)
    };
    var form = h('form', { class: 'form-grade', novalidate: true }, Object.keys(cs).map(function (k) { return cs[k]; }));
    var salvar = h('button', { class: 'btn btn-primario', type: 'button' }, c.id ? 'Salvar' : 'Cadastrar');
    var p = UI.painel(c.id ? 'Editar concurso' : 'Novo concurso', form, [salvar, h('button', { class: 'btn btn-secundario', type: 'button', onclick: function () { p.fechar(); } }, 'Cancelar')]);
    form.addEventListener('submit', function (e) { e.preventDefault(); salvar.click(); });
    salvar.addEventListener('click', function () {
      Object.keys(cs).forEach(function (k) { cs[k].erro(''); });
      var d = {};
      Object.keys(f).forEach(function (k) { var v = f[k].value.trim(); d[k] = v === '' ? null : v; });
      var ok = true;
      if (!d.codigo) { cs.codigo.erro('Informe o código.'); ok = false; } else if (/\s/.test(d.codigo)) { cs.codigo.erro('O código não pode ter espaços.'); ok = false; }
      if (!d.orgao) { cs.orgao.erro('Informe o órgão.'); ok = false; }
      if (!d.cargo) { cs.cargo.erro('Informe o cargo.'); ok = false; }
      if (d.data_prova && d.data_publicacao && d.data_prova < d.data_publicacao) { cs.data_prova.erro('A prova não pode ser antes da publicação.'); ok = false; }
      if (d.link_edital && !/^https?:\/\//i.test(d.link_edital)) { cs.link_edital.erro('Comece com http:// ou https://'); ok = false; }
      if (!ok) return;
      salvar.disabled = true;
      var q = c.id ? ctx.sb.from('a360_concursos').update(d).eq('id', c.id).select().single()
        : ctx.sb.from('a360_concursos').insert(Object.assign(d, { prioritario: !ctx.estado.concursos.some(function (x) { return x.prioritario; }) })).select().single();
      q.then(function (r) {
        salvar.disabled = false;
        if (r.error) { var m = UI.erroBanco(r.error); if (/código/.test(m)) cs.codigo.erro(m); else ctx.aviso(m); return; }
        p.fechar();
        var depois = (!c.id && !ctx.estado.ativoId) ? ctx.definirAtivo(r.data.id) : Promise.resolve();
        depois.then(function () { ctx.aviso(c.id ? 'Concurso atualizado.' : 'Concurso cadastrado.'); ctx.recarregar(); });
      });
    });
  }

  // ------------------------------------------------------------------
  // CONFIGURAÇÕES
  // ------------------------------------------------------------------
  A360T.configuracoes = function (ctx, el) {
    var c = ctx.estado.config || {};
    el.appendChild(h('h1', null, 'Configurações e backup'));
    var f = {
      url_projeto_claude: UI.entrada({ type: 'url', value: c.url_projeto_claude || '', placeholder: 'https://claude.ai/project/…' }),
      url_projeto_chatgpt: UI.entrada({ type: 'url', value: c.url_projeto_chatgpt || '', placeholder: 'https://chatgpt.com/g/…' }),
      ia_padrao: UI.selecao([['claude', 'Claude'], ['chatgpt', 'ChatGPT']], c.ia_padrao || 'claude'),
      minimo_minutos_streak: UI.entrada({ type: 'number', min: 1, max: 240, value: c.minimo_minutos_streak || 15 }),
      perfil_md: h('textarea', { rows: 8, placeholder: 'Cole aqui a seção "1. Perfil do candidato" do seu Registro Mestre.' })
    };
    f.perfil_md.value = c.perfil_md || '';
    var cs = {
      url_projeto_claude: UI.campo('Endereço do Projeto no Claude', f.url_projeto_claude, 'Abra o seu Projeto no Claude e copie o endereço da barra do navegador.'),
      url_projeto_chatgpt: UI.campo('Endereço do Projeto (ou GPT) no ChatGPT', f.url_projeto_chatgpt, 'Abra o seu Projeto ou GPT no ChatGPT e copie o endereço da barra.'),
      ia_padrao: UI.campo('IA padrão', f.ia_padrao, 'Define qual botão "Estudar" fica em destaque.'),
      minimo_minutos_streak: UI.campo('Minutos mínimos para contar o dia na sequência', f.minimo_minutos_streak),
      perfil_md: UI.campo('Perfil do candidato (vai no Registro Mestre)', f.perfil_md)
    };
    var salvar = h('button', { class: 'btn btn-primario' }, 'Salvar configurações');
    salvar.addEventListener('click', function () {
      Object.keys(cs).forEach(function (k) { cs[k].erro(''); });
      var d = {}, ok = true;
      Object.keys(f).forEach(function (k) { var v = String(f[k].value).trim(); d[k] = v === '' ? null : v; });
      ['url_projeto_claude', 'url_projeto_chatgpt'].forEach(function (k) { if (d[k] && !/^https?:\/\//i.test(d[k])) { cs[k].erro('Comece com http:// ou https://'); ok = false; } });
      var m = parseInt(d.minimo_minutos_streak, 10);
      if (isNaN(m) || m < 1 || m > 240) { cs.minimo_minutos_streak.erro('Use um número de 1 a 240.'); ok = false; } else d.minimo_minutos_streak = m;
      d.ia_padrao = d.ia_padrao || 'claude';
      if (!ok) return;
      salvar.disabled = true;
      ctx.sb.from('a360_configuracoes').update(d).eq('usuario_id', ctx.estado.usuario.id).select().single().then(function (r) {
        salvar.disabled = false;
        if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
        ctx.estado.config = r.data; ctx.aviso('Configurações salvas.');
      });
    });
    el.appendChild(h('div', { class: 'cartao' }, h('h2', null, 'Suas IAs'), cs.url_projeto_claude, cs.url_projeto_chatgpt, cs.ia_padrao, cs.minimo_minutos_streak, cs.perfil_md, h('div', { class: 'barra-acoes' }, salvar)));

    function botaoCopiar(rotulo, arquivo) {
      var b = h('button', { class: 'btn btn-secundario' }, rotulo);
      b.addEventListener('click', function () {
        fetch(arquivo, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
          return UI.copiar(t).then(function (ok) { ctx.aviso(ok ? 'Copiado! Cole nas instruções da IA.' : 'Não consegui copiar automaticamente. Use o botão de baixar.'); });
        }).catch(function () { ctx.aviso('Não consegui abrir o arquivo ' + arquivo + '.'); });
      });
      return b;
    }
    el.appendChild(h('div', { class: 'cartao' }, h('h2', null, 'Instruções das IAs'),
      h('p', { class: 'suave' }, 'Claude: cole o prompt completo nas instruções do Projeto. ChatGPT: cole o núcleo nas instruções e suba o manual como arquivo. Nos dois, suba também o Registro Mestre e o edital.'),
      h('div', { class: 'barra-acoes' },
        botaoCopiar('Copiar prompt do Claude', 'docs/ia/prompt-aprovacao-360-v2.md'),
        botaoCopiar('Copiar núcleo do ChatGPT', 'docs/ia/nucleo-chatgpt.md'),
        h('a', { class: 'btn btn-secundario', href: 'docs/ia/manual-aprovacao-360.md', download: 'manual-aprovacao-360.md' }, 'Baixar manual (ChatGPT)'),
        h('a', { class: 'btn btn-secundario', href: 'docs/ia/registro-mestre.md', download: 'registro-mestre.md' }, 'Baixar Registro Mestre em branco'))));
    // Etapa 8: Registro Mestre, backup e restauração
    var bReg = h('button', { class: 'btn btn-primario' }, 'Exportar Registro Mestre (.md)');
    bReg.addEventListener('click', function () {
      bReg.disabled = true;
      A360EXP.registroMestre(ctx).then(function () { bReg.disabled = false; ctx.aviso('Registro Mestre baixado. Suba-o nos arquivos do Projeto no Claude e no ChatGPT (substitua o anterior).'); },
        function (e) { bReg.disabled = false; ctx.aviso(UI.erroBanco(e)); });
    });
    var bBak = h('button', { class: 'btn btn-secundario' }, 'Baixar backup (.json)');
    bBak.addEventListener('click', function () {
      bBak.disabled = true;
      A360EXP.backup(ctx).then(function () { bBak.disabled = false; ctx.aviso('Backup baixado.'); ctx.rotear(); }, function (e) { bBak.disabled = false; ctx.aviso(UI.erroBanco(e)); });
    });
    var arq = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Arquivo de backup', class: 'sr' });
    var bRes = h('button', { class: 'btn btn-secundario', onclick: function () { arq.click(); } }, 'Restaurar backup…');
    arq.addEventListener('change', function () {
      var f = arq.files && arq.files[0]; if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () {
        var obj; try { obj = JSON.parse(leitor.result); } catch (e) { obj = null; }
        var erro = A360EXP.validarBackup(obj);
        arq.value = '';
        if (erro) { ctx.aviso(erro); return; }
        var tab = h('div', null, A360EXP.resumoBackup(obj).map(function (x) { return h('div', { class: 'linha-simples' }, h('span', null, x[0]), h('strong', null, String(x[1]))); }));
        var conf = h('button', { class: 'btn btn-perigo' }, 'Restaurar por cima');
        var p = UI.painel('Restaurar backup', h('div', null,
          h('p', null, 'Backup de ' + U.dataBR(String(obj.exportado_em).slice(0, 10)) + '. Os registros com o mesmo identificador serão substituídos pelos do arquivo; os que não estão no arquivo continuam como estão.'), tab), [conf]);
        conf.addEventListener('click', function () {
          if (!ctx.confirmar('Confirmar a restauração? Recomendo baixar um backup do estado atual antes.')) return;
          conf.disabled = true;
          A360EXP.restaurar(ctx, obj).then(function (r) {
            p.fechar();
            ctx.aviso(r.problemas.length ? 'Restaurado com avisos (' + r.total + ' registros). ' + r.problemas.slice(0, 2).join(' · ') : 'Backup restaurado: ' + r.total + ' registros.');
            ctx.recarregar();
          }, function (e) { conf.disabled = false; ctx.aviso(UI.erroBanco(e)); });
        });
      };
      leitor.readAsText(f);
    });
    var ub = c.ultimo_backup ? U.dataBR(String(c.ultimo_backup).slice(0, 10)) : 'nunca';
    var ur = c.ultimo_registro_exportado ? U.dataBR(String(c.ultimo_registro_exportado).slice(0, 10)) : 'nunca';
    el.appendChild(h('div', { class: 'cartao' }, h('h2', null, 'Registro Mestre, backup e exportações'),
      h('p', { class: 'suave' }, 'O Registro Mestre leva o seu estado atual para a IA: exporte depois de importar CHECKPOINTs e suba nos dois Projetos. O backup guarda tudo (faça toda semana); o banco gratuito não faz backup sozinho.'),
      h('div', { class: 'barra-acoes' }, bReg, bBak, bRes, arq),
      h('p', { class: 'pequeno suave' }, 'Último Registro Mestre: ' + ur + ' · último backup: ' + ub + ' · conta: ' + (ctx.estado.usuario.email || '')),
      h('p', { class: 'pequeno suave' }, 'O caderno de erros em CSV (Excel) fica na tela Erros.')));
    el.appendChild(h('div', { class: 'cartao' }, h('h2', null, 'Conta'), h('p', { class: 'suave' }, ctx.estado.usuario.email || ''),
      h('button', { class: 'btn btn-secundario', onclick: function () { ctx.sair(); } }, 'Sair da conta')));
  };
})();
