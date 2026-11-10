// =====================================================================
// Aprovação 360° — Importar CHECKPOINT e tela de Revisões (etapa 4)
// =====================================================================
(function () {
  'use strict';
  var h = A360U.h, UI = A360UI, U = A360U, P = A360P;
  window.A360T = window.A360T || {};
  window.A360ABAS = window.A360ABAS || {};

  function carregarDiscs(sb, concursoId) {
    return sb.from('a360_disciplinas').select('id,nome').eq('concurso_id', concursoId).is('excluido_em', null).order('ordem').then(function (r) {
      if (r.error) throw r.error;
      var discs = r.data || [];
      if (!discs.length) return [];
      return sb.from('a360_assuntos').select('id,disciplina_id,descricao').in('disciplina_id', discs.map(function (d) { return d.id; })).is('excluido_em', null).then(function (r2) {
        if (r2.error) throw r2.error;
        var por = {}; discs.forEach(function (d) { d.assuntos = []; por[d.id] = d; });
        (r2.data || []).forEach(function (a) { if (por[a.disciplina_id]) por[a.disciplina_id].assuntos.push(a); });
        return discs;
      });
    });
  }

  // RN21: SHA-256 do bloco normalizado
  function sha256(txt) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      });
    }
    var x = 0; for (var i = 0; i < txt.length; i++) x = (x * 31 + txt.charCodeAt(i)) | 0;
    return Promise.resolve('h' + x);
  }

  // ------------------------------------------------------------------
  // Aba CHECKPOINT da tela Importar
  // ------------------------------------------------------------------
  A360ABAS.checkpoint = function (ctx, el) {
    el.appendChild(h('p', { class: 'suave' }, 'No fim da sessão, a IA (Claude ou ChatGPT) gera um bloco que começa com "=== CHECKPOINT ===". Cole aqui o bloco inteiro: a plataforma mostra o que vai gravar e atualiza o edital, as revisões e o caderno de erros.'));
    var txt = h('textarea', { id: 'txt-checkpoint', rows: 14, class: 'mono', placeholder: '=== CHECKPOINT ===\ndata: AAAA-MM-DD\nconcurso: CODIGO\nconversa: Aula\nia: Claude\nSESSAO | Disciplina | Assunto | aula | REALIZADO | 50\nQUESTOES | Disciplina | Assunto | 10 | 7\n=== FIM ===' });
    var msg = h('div', { class: 'cartao erro-caixa', hidden: true, role: 'alert' });
    var prev = h('div');
    var analisar = h('button', { class: 'btn btn-primario' }, 'Analisar');
    el.appendChild(h('div', { class: 'campo' }, h('label', { for: 'txt-checkpoint' }, 'Bloco CHECKPOINT'), txt));
    el.appendChild(h('div', { class: 'barra-acoes' }, analisar, h('button', { class: 'btn btn-secundario', onclick: function () { txt.value = ''; prev.innerHTML = ''; msg.hidden = true; txt.focus(); } }, 'Limpar')));
    el.appendChild(msg); el.appendChild(prev);
    function erro(t) { msg.textContent = t; msg.hidden = false; }

    txt.addEventListener('paste', function () { setTimeout(function () { analisar.click(); }, 50); });
    analisar.addEventListener('click', function () {
      msg.hidden = true; prev.innerHTML = '';
      var lido = P.lerCheckpoint(txt.value, U.hojeISO());
      if (lido.erro) { erro(lido.erro); return; }
      // concurso: pelo código do bloco; se não vier, o ativo
      var c = null;
      if (lido.cab.concurso) c = ctx.estado.concursos.filter(function (x) { return x.codigo.toLowerCase() === lido.cab.concurso.toLowerCase(); })[0];
      else { c = ctx.ativo(); if (c) lido.cab.avisos.push('Sem "concurso:" no bloco; usei o concurso ativo (' + c.codigo + ').'); }
      if (!c) {
        if (!ctx.estado.concursos.length) { erro('Nenhum concurso cadastrado. Importe o EDITAL primeiro.'); return; }
        var sel = UI.selecao(ctx.estado.concursos.map(function (x) { return [x.id, x.codigo]; }), ctx.estado.ativoId);
        prev.appendChild(h('div', { class: 'cartao aviso-caixa' },
          h('p', null, h('strong', null, 'Concurso "' + (lido.cab.concurso || '') + '" não cadastrado.'), ' Importe o EDITAL primeiro ou escolha o concurso:'),
          h('div', { class: 'barra-acoes' }, sel, h('button', { class: 'btn btn-primario', onclick: function () {
            var escolhido = ctx.estado.concursos.filter(function (x) { return x.id === sel.value; })[0];
            prev.innerHTML = ''; seguir(lido, escolhido);
          } }, 'Usar este concurso'))));
        return;
      }
      seguir(lido, c);
    });

    function seguir(lido, c) {
      analisar.disabled = true;
      var hashP = sha256(P.textoParaHash(lido.original));
      Promise.all([carregarDiscs(ctx.sb, c.id), hashP, A360CRON.sessoesDoDia(ctx.sb, c.id, lido.cab.data)]).then(function (res) {
        var discs = res[0], hash = res[1], crons = res[2];
        return ctx.sb.from('a360_checkpoints').select('criado_em').eq('hash', hash).is('excluido_em', null).limit(1).then(function (r) {
          analisar.disabled = false;
          if (r.data && r.data.length) { erro('Este checkpoint já foi importado em ' + U.dataBR(String(r.data[0].criado_em).slice(0, 10)) + '. Nada foi gravado de novo.'); return; }
          P.resolverCheckpoint(lido, discs);
          // RN18: tempo do cronômetro já registrado para o mesmo assunto no mesmo dia
          lido.linhas.forEach(function (l) {
            if (l.tipo !== 'SESSAO' || l.status === 'erro' || !l.disc || !l.valor || !l.valor.minutos) return;
            var aid = l.assuntoRef ? l.assuntoRef.id : null;
            var mesmos = crons.filter(function (x) { return x.disciplina_id === l.disc.id && (x.assunto_id || null) === aid; });
            if (mesmos.length) l.cron = { minutos: mesmos.reduce(function (a, x) { return a + x.minutos; }, 0), ids: mesmos.map(function (x) { return x.id; }) };
          });
          previa(ctx, prev, lido, c, hash, function () { txt.value = ''; });
        });
      }).catch(function (e) { analisar.disabled = false; erro(UI.erroBanco(e)); });
    }
  };

  function previa(ctx, el, lido, c, hash, aoConcluir) {
    var decisoes = {}, decMin = {};
    var cab = lido.cab;
    var iaTxt = cab.ia ? ({ claude: 'Claude', chatgpt: 'ChatGPT', outra: cab.iaTexto || 'outra' })[cab.ia] : ('não informada (usarei ' + (ctx.estado.config.ia_padrao === 'chatgpt' ? 'ChatGPT' : 'Claude') + ')');
    var lista = h('div', { class: 'previa' });
    var conf = h('button', { class: 'btn btn-sucesso' });
    var dica = h('span', { class: 'pequeno suave' });

    function rotulo(l) {
      var d = l.disc ? l.disc.nome : l.disciplina;
      var a = l.assuntoRef ? l.assuntoRef.descricao : (l.assunto || 'disciplina inteira');
      if (!l.valor) return l.campos.join(' · ');
      switch (l.tipo) {
        case 'SESSAO': return d + ' › ' + a + ' · ' + l.valor.tipo + ' · ' + l.valor.status + ' · ' + l.valor.minutos + ' min';
        case 'QUESTOES': return d + ' › ' + a + ' · ' + l.valor.feitas + ' questões, ' + l.valor.acertos + ' acertos (' + U.pct(l.valor.acertos, l.valor.feitas) + ')';
        case 'ERRO': return d + ' › ' + a + ' · ' + P.MOTIVO_ROTULO[l.valor.motivo] + ' · ' + l.valor.descricao;
        case 'REVISAO': return d + ' › ' + a + ' · ' + l.valor.resultado + '% de acerto';
        case 'DIFICULDADE': case 'ULTIMO_PONTO': return d + ' › ' + a + ' · ' + l.valor.texto;
        default: return l.valor ? l.valor.texto : l.campos.join(' · ');
      }
    }

    function desenhar() {
      lista.innerHTML = '';
      var pend = 0;
      lido.linhas.forEach(function (l) {
        var dec = decisoes[l.n];
        var s = l.status === 'erro' ? ['✖ inválida', 'st-nao'] : (l.precisaDecidir && !dec ? ['⚠ decidir', 'st-estudo'] : (l.precisaDecidir ? ['✔ decidido', 'st-dominado'] : (l.status === 'aviso' ? ['✔ com aviso', 'st-estudo'] : ['✔ ok', 'st-dominado'])));
        if (l.precisaDecidir && !dec) pend++;
        var acoes = null;
        if (l.precisaDecidir && l.status !== 'erro') {
          function b(valor, texto) {
            return h('button', { class: 'btn btn-peq ' + (dec === valor ? 'btn-primario' : 'btn-secundario'), onclick: function () { decisoes[l.n] = valor; desenhar(); } }, texto);
          }
          acoes = h('div', { class: 'barra-acoes' },
            l.sugestao ? b('assoc', 'Associar a "' + l.sugestao.descricao + '"') : null,
            b('novo', 'Criar novo assunto'), b('ignorar', 'Ignorar linha'));
        }
        var acoesMin = null;
        if (l.cron && l.status !== 'erro') {
          var dm = decMin[l.n] || 'ignorar';
          function bm(valor, texto) { return h('button', { class: 'btn btn-peq ' + (dm === valor ? 'btn-primario' : 'btn-secundario'), onclick: function () { decMin[l.n] = valor; desenhar(); } }, texto); }
          acoesMin = h('div', null, h('div', { class: 'pequeno alerta' }, 'Já há ' + l.cron.minutos + ' min do cronômetro para este assunto neste dia. O que fazer com os ' + l.valor.minutos + ' min do checkpoint?'),
            h('div', { class: 'barra-acoes' }, bm('ignorar', 'Ignorar os minutos do checkpoint'), bm('somar', 'Somar'), bm('substituir', 'Substituir os do cronômetro')));
        }
        var aviso = l.status === 'erro' ? l.msg : (l.precisaDecidir ? 'Assunto "' + l.assunto + '" não encontrado em ' + l.disc.nome + '.' + (l.sugestao ? ' O mais parecido é "' + l.sugestao.descricao + '".' : '') : l.msg);
        lista.appendChild(h('div', { class: 'previa-linha' },
          h('span', { class: 'chip ' + s[1] }, s[0]),
          h('div', { class: 'previa-texto' }, h('div', null, h('strong', null, l.tipo), ' · ', rotulo(l)),
            aviso ? h('div', { class: 'pequeno ' + (l.status === 'erro' ? 'erro' : 'alerta') }, aviso) : null, acoes, acoesMin)));
      });
      var validas = lido.linhas.filter(function (l) { return l.status !== 'erro' && decisoes[l.n] !== 'ignorar'; }).length;
      conf.disabled = pend > 0 || validas === 0;
      conf.textContent = validas < lido.linhas.length ? 'Confirmar importação (' + validas + ' de ' + lido.linhas.length + ' linhas)' : 'Confirmar importação';
      dica.textContent = pend > 0 ? 'Decida as linhas marcadas com ⚠.' : (validas === 0 ? 'Nenhuma linha válida para importar.' : 'Tudo é gravado de uma vez; se algo falhar, nada é gravado.');
    }

    conf.addEventListener('click', function () {
      conf.disabled = true;
      var substituir = [], minOrig = {};
      lido.linhas.forEach(function (l) {
        if (!l.cron) return;
        var dm = decMin[l.n] || 'ignorar';
        minOrig[l.n] = l.valor.minutos;
        if (dm === 'ignorar') l.valor.minutos = 0;
        if (dm === 'substituir') substituir = substituir.concat(l.cron.ids);
      });
      var dados = P.payloadCheckpoint(lido, decisoes, { concurso_id: c.id, hash: hash, ia_padrao: ctx.estado.config.ia_padrao || 'claude' });
      lido.linhas.forEach(function (l) { if (minOrig[l.n] !== undefined) l.valor.minutos = minOrig[l.n]; });
      ctx.sb.rpc('a360_importar_checkpoint', { dados: dados }).then(function (r) {
        if (r.error) {
          conf.disabled = false;
          var m = String(r.error.message || '');
          var dup = m.match(/CHECKPOINT_DUPLICADO (\S+)/);
          ctx.aviso(dup ? 'Este checkpoint já foi importado em ' + dup[1] + '.' : (/a360_importar_checkpoint/.test(m) && /does not exist|Could not find/i.test(m) ? 'Falta instalar a etapa 4 no banco: rode supabase/03-checkpoint-revisoes.sql no SQL Editor.' : UI.erroBanco(r.error)));
          return;
        }
        var d = r.data;
        if (substituir.length) ctx.sb.from('a360_sessoes').update({ excluido_em: new Date().toISOString() }).in('id', substituir).then(function () {});
        el.innerHTML = '';
        el.appendChild(h('div', { class: 'cartao ok-caixa' },
          h('h2', null, 'Checkpoint de ' + U.dataBR(d.data) + ' importado'),
          h('p', null, d.sessoes + ' sessão(ões) · ' + d.questoes_feitas + ' questões · ' + d.erros + ' erro(s) · ' + d.revisoes + ' revisão(ões)' + (d.assuntos_novos ? ' · ' + d.assuntos_novos + ' assunto(s) novo(s)' : '')),
          (d.mensagens && d.mensagens.length) ? h('ul', null, d.mensagens.map(function (m) { return h('li', null, m); })) : null,
          h('div', { class: 'barra-acoes' }, h('a', { class: 'btn btn-primario', href: '#/revisoes' }, 'Ver revisões'), h('a', { class: 'btn btn-secundario', href: '#/edital' }, 'Ver edital'))));
        if (aoConcluir) aoConcluir();
        ctx.aviso('Checkpoint importado.');
      });
    });

    el.appendChild(h('div', { class: 'cartao' },
      h('h2', null, 'Pré-visualização'),
      h('div', { class: 'ok-caixa' }, h('strong', null, c.codigo), ' · data ' + U.dataBR(cab.data) + ' · ' + (cab.conversa || 'conversa não informada') + ' · IA: ' + iaTxt),
      cab.avisos.length ? h('div', { class: 'aviso-caixa' }, cab.avisos.join(' ')) : null,
      lista, h('div', { class: 'barra-acoes' }, conf, dica)));
    desenhar();
  }

  // ------------------------------------------------------------------
  // REVISÕES
  // ------------------------------------------------------------------
  A360T.revisoes = function (ctx, el, vivo) {
    var c = ctx.ativo();
    el.appendChild(h('h1', null, 'Revisões'));
    if (!c) { el.appendChild(UI.vazio('Nenhum concurso ativo.', 'Importe o EDITAL para começar.', [h('a', { class: 'btn btn-primario', href: '#/importar' }, 'Importar EDITAL')])); return; }
    el.appendChild(h('p', { class: 'suave' }, 'Intervalos de 1 → 7 → 30 → 60 dias. Acerto de 85% ou mais avança uma etapa, de 70% a 84% repete a etapa e abaixo de 70% volta uma. O resultado normalmente chega pelo CHECKPOINT, mas você também pode registrar aqui.'));
    var area = h('div', { class: 'area' }, h('p', { class: 'suave' }, 'Carregando…'));
    el.appendChild(area);
    return ctx.sb.from('a360_v_revisoes').select('*').eq('concurso_id', c.id).order('data_prevista').then(function (r) {
      if (!vivo()) return;
      area.innerHTML = '';
      if (r.error) {
        var m = String(r.error.message || '');
        area.appendChild(h('div', { class: 'cartao erro-caixa' }, /a360_v_revisoes/.test(m) ? 'Falta instalar a etapa 4 no banco: rode o arquivo supabase/03-checkpoint-revisoes.sql no SQL Editor do Supabase.' : UI.erroBanco(r.error)));
        return;
      }
      var hoje = U.hojeISO(), lista = r.data || [];
      if (lista.some(function (x) { return x.data_prevista <= hoje; })) {
        area.appendChild(h('div', { class: 'barra-acoes' }, h('button', { class: 'btn btn-primario', onclick: function () {
          A360PR.gerar(ctx, 'revisao').then(function (t) { A360PR.verPrompt(ctx, t, null, 'Prompt: revisões de hoje'); }).catch(function (e) { ctx.aviso(UI.erroBanco(e)); });
        } }, 'Revisar as de hoje na IA (Claude ou ChatGPT)')));
      }
      if (!lista.length) { area.appendChild(UI.vazio('Nenhuma revisão pendente. 🎉', 'As revisões aparecem sozinhas depois que você importa um CHECKPOINT com uma aula.')); return; }
      var grupos = [
        { t: 'Atrasadas', cls: 'erro', f: function (x) { return x.data_prevista < hoje; } },
        { t: 'Hoje', cls: 'alerta', f: function (x) { return x.data_prevista === hoje; } },
        { t: 'Próximos 7 dias', cls: 'aco', f: function (x) { var d = U.difDias(x.data_prevista, hoje); return d > 0 && d <= 7; } },
        { t: 'Mais adiante', cls: 'suave', f: function (x) { return U.difDias(x.data_prevista, hoje) > 7; }, recolhido: true }
      ];
      grupos.forEach(function (g) {
        var itens = lista.filter(g.f);
        var sec = h('section', { class: 'cartao' }, h('h2', { class: g.cls }, g.t + ' (' + itens.length + ')'));
        if (!itens.length) sec.appendChild(h('p', { class: 'suave pequeno' }, 'Nada aqui.'));
        if (g.recolhido && itens.length) {
          var det = h('details', null, h('summary', null, 'Mostrar'));
          itens.forEach(function (x) { det.appendChild(linhaRevisao(ctx, x, hoje)); });
          sec.appendChild(det);
        } else itens.forEach(function (x) { sec.appendChild(linhaRevisao(ctx, x, hoje)); });
        area.appendChild(sec);
      });
    });
  };

  function linhaRevisao(ctx, x, hoje) {
    var atraso = U.difDias(hoje, x.data_prevista);
    var pct = UI.entrada({ type: 'number', min: 0, max: 100, placeholder: '%', 'aria-label': 'Percentual de acerto na revisão de ' + x.assunto, class: 'inp-pct' });
    var reg = h('button', { class: 'btn btn-primario btn-peq' }, 'Registrar');
    var data = UI.entrada({ type: 'date', min: hoje, value: x.data_prevista < hoje ? hoje : x.data_prevista, 'aria-label': 'Nova data', class: 'inp-data' });
    var repro = h('button', { class: 'btn btn-secundario btn-peq' }, 'Reprogramar');
    reg.addEventListener('click', function () {
      var v = parseInt(pct.value, 10);
      if (isNaN(v) || v < 0 || v > 100 || String(v) !== pct.value.trim()) { ctx.aviso('Informe um número de 0 a 100.'); pct.focus(); return; }
      reg.disabled = true;
      ctx.sb.rpc('a360_registrar_revisao', { p_assunto: x.assunto_id, p_resultado: v, p_data: hoje }).then(function (r) {
        reg.disabled = false;
        if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
        ctx.aviso(x.assunto + ': ' + v + '% → próxima revisão em ' + U.dataBR(r.data.data_prevista) + ' (etapa ' + r.data.etapa + ' dias).');
        ctx.rotear();
      });
    });
    repro.addEventListener('click', function () {
      if (!data.value || data.value < hoje) { ctx.aviso('A data não pode ser no passado.'); return; }
      ctx.sb.from('a360_revisoes').update({ data_prevista: data.value }).eq('id', x.id).then(function (r) {
        if (r.error) { ctx.aviso(UI.erroBanco(r.error)); return; }
        ctx.aviso('Revisão reprogramada para ' + U.dataBR(data.value) + '.'); ctx.rotear();
      });
    });
    return h('div', { class: 'linha-revisao' },
      h('div', { class: 'rev-info' }, h('div', { class: 'forte' }, x.assunto), h('div', { class: 'pequeno suave' }, x.disciplina + ' · etapa de ' + x.etapa + (x.etapa === 1 ? ' dia' : ' dias') + ' · prevista ' + U.dataBR(x.data_prevista) + (atraso > 0 ? ' · atraso de ' + atraso + ' dia(s)' : ''))),
      h('div', { class: 'rev-acoes' }, pct, reg, data, repro));
  }
})();
