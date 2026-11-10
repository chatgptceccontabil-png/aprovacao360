// =====================================================================
// Aprovação 360° — Registro Mestre (RN24), backup e restauração (RN25, RN27)
// =====================================================================
(function (raiz) {
  'use strict';
  var U = raiz.A360U || (typeof require !== 'undefined' ? require('./util.js') : null);
  var C = raiz.A360C || (typeof require !== 'undefined' ? require('./calc.js') : null);
  var MOT = { conceito: 'Conceito', letra_da_lei: 'Letra da lei', pegadinha: 'Pegadinha', interpretacao: 'Interpretação', calculo: 'Cálculo', atencao: 'Falta de atenção', chute: 'Chute' };
  var ST = { nao_iniciado: 'não iniciado', em_estudo: 'em estudo', revisao: 'revisão', dominado: 'DOMINADO' };
  var STC = { previsto: 'previsto', publicado: 'publicado', encerrado: 'encerrado' };
  var IA = { claude: 'Claude', chatgpt: 'ChatGPT', outra: 'outra' };

  function cel(v) { if (v === null || v === undefined || v === '') return '—'; return String(v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|'); }
  function tabela(cab, linhas, vazio) {
    var out = ['| ' + cab.join(' | ') + ' |', '|' + cab.map(function () { return '---'; }).join('|') + '|'];
    if (!linhas.length) out.push('| ' + [vazio || '[nada registrado]'].concat(cab.slice(1).map(function () { return ''; })).join(' | ') + ' |');
    linhas.forEach(function (l) { out.push('| ' + l.map(cel).join(' | ') + ' |'); });
    return out.join('\n');
  }

  // ------------------------------------------------------------------
  // RN24 — monta o Registro Mestre (mesma estrutura do registro-mestre.md)
  // d = { agora (Date), hoje, perfil_md, concursos[], ativo, plano, planos[], discs[] (com assuntos + stats),
  //       revisoes[] (pendentes da visão), ultimoResultado{assunto_id: %}, erros[], sessoes[], proxima, propostas[] }
  // ------------------------------------------------------------------
  function montarRegistro(d) {
    var L = [], c = d.ativo || {};
    var nomeD = {}, nomeA = {};
    (d.discs || []).forEach(function (x) { nomeD[x.id] = x.nome; (x.assuntos || []).forEach(function (a) { nomeA[a.id] = a.descricao; }); });
    var quando = U.dataBR(d.hoje) + ' ' + String(d.agora.getHours()).padStart(2, '0') + ':' + String(d.agora.getMinutes()).padStart(2, '0');
    L.push('# REGISTRO MESTRE — Projeto Aprovação 360°', '');
    L.push('> Exportado pela plataforma Aprovação 360°. Suba este arquivo nos arquivos do Projeto (Claude e ChatGPT), substituindo o anterior.');
    L.push('> Dados de desempenho = [REGISTRO]: só o que foi importado por CHECKPOINT, cronômetro ou lançamento manual confirmado. Campo sem informação = `[não informado]`.', '');
    L.push('**Exportado em:** ' + quando + ' | **Concurso ativo:** ' + (c.codigo || '[nenhum]'), '', '---', '');

    // 1. Perfil
    L.push('## 1. Perfil do candidato [PESSOAL]', '');
    var perfil = String(d.perfil_md || '').trim().split('\n').filter(function (l) { return !/^#{1,6}\s*1\.?\s*Perfil/i.test(l.trim()); }).join('\n').trim();
    L.push(perfil || tabela(['Campo', 'Valor'], [['Perfil', '[não informado] — cole o seu perfil em Configurações']]), '', '---', '');

    // 2. Concursos
    L.push('## 2. Concursos [OFICIAL]', '');
    L.push(tabela(['Código', 'Órgão', 'Cargo', 'Banca', 'Edital', 'Publicação', 'Retificações', 'Prova', 'Status', 'Prioridade'],
      (d.concursos || []).map(function (x) {
        return [x.codigo + (x.id === c.id ? ' (ativo)' : ''), x.orgao, x.cargo, x.banca, x.edital_numero, x.data_publicacao ? U.dataBR(x.data_publicacao) : null,
          x.retificacoes, x.data_prova ? U.dataBR(x.data_prova) : null, STC[x.status] || x.status, x.prioritario ? '★ prioritário' : '—'];
      })), '', '---', '');

    // 3. Planejamento vigente + ciclo
    L.push('## 3. Planejamento vigente', '');
    var p = d.plano;
    L.push(tabela(['Campo', 'Valor'], p ? [['Versão', 'v' + p.versao], ['Data de aprovação', U.dataBR(p.data_aprovacao)], ['Disponibilidade considerada', U.num1(Number(p.horas_semana)) + ' h/semana'],
      ['Meta semanal de horas', U.num1(Number(p.horas_semana)) + ' h'], ['Meta semanal de questões', String(p.meta_questoes_semana)], ['Observações', p.observacoes]]
      : [['Versão', '[sem planejamento aprovado]']]), '');
    L.push('### Ciclo de estudos', '');
    var ciclo = (d.discs || []).map(function (x) {
      var pr = C.prioridade(x.peso, x.incidencia, x.feitas || 0, x.acertos || 0);
      return { x: x, pr: pr };
    }).sort(function (a, b) { return b.pr - a.pr; });
    L.push(tabela(['Ordem', 'Disciplina', 'Peso (1-5)', 'Incidência (1-5)', '% acerto', 'Prioridade', 'Horas no ciclo'],
      ciclo.map(function (r, i) {
        var x = r.x;
        return [String(i + 1), x.nome, String(x.peso), String(x.incidencia), x.feitas ? U.pct(x.acertos, x.feitas) + ' (' + x.feitas + ' q)' : 'sem dados',
          U.num1(r.pr), p && x.horas_ciclo !== null && x.horas_ciclo !== undefined ? U.num1(Number(x.horas_ciclo)) + ' h' : '—'];
      })), '', '---', '');

    // 4. Edital verticalizado
    L.push('## 4. Edital verticalizado e progresso', '');
    L.push('Status: `não iniciado · em estudo · revisão · DOMINADO` (DOMINADO = ≥ 80% em ≥ 20 questões, em 2 dias diferentes)', '');
    var linhas4 = [];
    (d.discs || []).forEach(function (x) {
      (x.assuntos || []).forEach(function (a) {
        var s = a.stats || { feitas: 0, acertos: 0 };
        linhas4.push([c.codigo, x.nome, a.item_edital, a.descricao, ST[a.status] || a.status, String(s.feitas || 0), String(s.acertos || 0), s.feitas ? U.pct(s.acertos, s.feitas) : '—',
          a.ultima_atividade ? U.dataBR(a.ultima_atividade) : '—']);
      });
    });
    L.push(tabela(['Concurso', 'Disciplina', 'Item', 'Assunto', 'Status', 'Questões', 'Acertos', '%', 'Última atividade'], linhas4), '');
    var comPonto = [];
    (d.discs || []).forEach(function (x) { (x.assuntos || []).forEach(function (a) { if (a.ultimo_ponto || a.dificuldades) comPonto.push([x.nome + ' › ' + a.descricao, a.ultimo_ponto, a.dificuldades]); }); });
    if (comPonto.length) { L.push('### Último ponto de aprendizagem e dificuldades', ''); L.push(tabela(['Assunto', 'Último ponto', 'Dificuldades'], comPonto), ''); }
    L.push('---', '');

    // 5. Revisões
    L.push('## 5. Fila de revisões', '');
    L.push(tabela(['Disciplina', 'Assunto', 'Estudo original', 'Etapa (1/7/30/60)', 'Próxima revisão', 'Último resultado'],
      (d.revisoes || []).map(function (r) {
        var ur = d.ultimoResultado ? d.ultimoResultado[r.assunto_id] : null;
        return [r.disciplina, r.assunto, U.dataBR(r.data_estudo_original), String(r.etapa), U.dataBR(r.data_prevista) + (r.data_prevista < d.hoje ? ' (atrasada)' : ''), ur === null || ur === undefined ? '—' : ur + '%'];
      })), '', '---', '');

    // 6. Caderno de erros
    L.push('## 6. Caderno de erros [REGISTRO]', '');
    L.push('Não revisados e todos os dos últimos 30 dias. Motivos: `conceito · letra da lei · pegadinha · interpretação · cálculo · falta de atenção · chute`', '');
    var erros = (d.erros || []).filter(function (e) { return !e.revisado || U.difDias(d.hoje, e.data) < 30; });
    L.push(tabela(['Data', 'Disciplina', 'Assunto', 'Motivo', 'O que errei / o certo', 'Revisado?'],
      erros.map(function (e) { return [U.dataBR(e.data), nomeD[e.disciplina_id], nomeA[e.assunto_id], MOT[e.motivo] || e.motivo, e.descricao, e.revisado ? 'Sim' : 'Não']; })), '', '---', '');

    // 7. Histórico de sessões
    L.push('## 7. Histórico de sessões [REGISTRO]', '');
    L.push(tabela(['Data', 'Origem', 'Atividade', 'Disciplina › Assunto', 'Status', 'Tempo'],
      (d.sessoes || []).slice(0, 30).map(function (s) {
        var orig = s.origem === 'checkpoint' ? 'CHECKPOINT' + (s.ia ? ' (' + (IA[s.ia] || s.ia) + ')' : '') : (s.origem === 'cronometro' ? 'cronômetro' : 'manual');
        return [U.dataBR(s.data), orig, s.tipo, (nomeD[s.disciplina_id] || '') + (s.assunto_id ? ' › ' + (nomeA[s.assunto_id] || '') : ''), s.status, s.minutos ? s.minutos + ' min' : '—'];
      })), '', '---', '');

    // 8 a 10
    L.push('## 8. Próximas atividades', '');
    L.push(d.proxima ? '- [ ] ' + d.proxima : '- [ ] [não informado]', '', '---', '');
    L.push('## 9. Propostas pendentes de aprovação', '');
    L.push((d.propostas && d.propostas.length) ? d.propostas.map(function (x) { return '- ' + String(x).replace(/\n/g, ' / '); }).join('\n') : '- [nenhuma]', '', '---', '');
    L.push('## 10. Histórico de alterações', '');
    L.push(tabela(['Data', 'Versão', 'O que mudou', 'Aprovado por mim?'],
      (d.planos || []).slice().sort(function (a, b) { return a.versao - b.versao; }).map(function (p2) {
        return [U.dataBR(p2.data_aprovacao), 'v' + p2.versao, 'Planejamento: ' + U.num1(Number(p2.horas_semana)) + ' h/semana, ' + p2.meta_questoes_semana + ' questões/semana' + (p2.observacoes ? ' — ' + p2.observacoes : '') + (p2.vigente ? ' (vigente)' : ''), 'Sim'];
      }), '[sem alterações aprovadas]'));
    L.push('');
    return L.join('\n');
  }

  // ------------------------------------------------------------------
  // RN25 — backup .json
  // ------------------------------------------------------------------
  var TABELAS = ['a360_concursos', 'a360_disciplinas', 'a360_assuntos', 'a360_planejamentos', 'a360_checkpoints', 'a360_sessoes', 'a360_questoes',
    'a360_erros', 'a360_revisoes', 'a360_simulados', 'a360_simulado_disciplinas', 'a360_links', 'a360_configuracoes'];

  function validarBackup(obj) {
    if (!obj || obj.app !== 'aprovacao360' || !obj.tabelas || typeof obj.tabelas !== 'object') return 'Arquivo inválido: não é um backup do Aprovação 360°.';
    if (obj.versao_schema !== 1) return 'Este backup é de uma versão diferente da plataforma (versão ' + obj.versao_schema + ').';
    return null;
  }

  // ------------------------------------------------------------------
  // Ações com o banco (só no navegador)
  // ------------------------------------------------------------------
  function baixar(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function lerTudo(sb, tabela) {
    var todas = [], passo = 1000;
    function pagina(i) {
      return sb.from(tabela).select('*').range(i, i + passo - 1).then(function (r) {
        if (r.error) throw r.error;
        var d = r.data || []; todas = todas.concat(d);
        return d.length === passo ? pagina(i + passo) : todas;
      });
    }
    return pagina(0);
  }

  function registroMestre(ctx) {
    var sb = ctx.sb, c = ctx.ativo(), hoje = U.hojeISO();
    if (!c) return Promise.reject(new Error('Nenhum concurso ativo.'));
    return A360D.carregarEdital(sb, c.id).then(function (discs) {
      var ids = discs.map(function (x) { return x.id; }), vazio = Promise.resolve({ data: [] });
      return Promise.all([
        sb.from('a360_planejamentos').select('*').eq('concurso_id', c.id).is('excluido_em', null).order('versao', { ascending: false }),
        sb.from('a360_v_revisoes').select('*').eq('concurso_id', c.id).order('data_prevista'),
        sb.from('a360_revisoes').select('assunto_id,resultado,data_realizada').eq('status', 'concluida').is('excluido_em', null).order('data_realizada', { ascending: false }).limit(3000),
        ids.length ? sb.from('a360_erros').select('*').in('disciplina_id', ids).is('excluido_em', null).order('data', { ascending: false }) : vazio,
        sb.from('a360_sessoes').select('*').eq('concurso_id', c.id).is('excluido_em', null).order('data', { ascending: false }).limit(30),
        sb.from('a360_checkpoints').select('proxima,propostas,propostas_vistas,criado_em').eq('concurso_id', c.id).is('excluido_em', null).order('criado_em', { ascending: false }).limit(50)
      ]).then(function (r) {
        var planos = r[0].data || [], ur = {};
        (r[2].data || []).forEach(function (x) { if (ur[x.assunto_id] === undefined) ur[x.assunto_id] = x.resultado; });
        var cps = r[5].data || [];
        var md = montarRegistro({ agora: new Date(), hoje: hoje, perfil_md: ctx.estado.config.perfil_md, concursos: ctx.estado.concursos, ativo: c,
          plano: planos.filter(function (p) { return p.vigente; })[0] || null, planos: planos, discs: discs, revisoes: r[1].data || [], ultimoResultado: ur,
          erros: r[3].data || [], sessoes: r[4].data || [],
          proxima: (cps.filter(function (k) { return k.proxima; })[0] || {}).proxima || null,
          propostas: cps.filter(function (k) { return k.propostas && !k.propostas_vistas; }).map(function (k) { return k.propostas; }) });
        baixar('registro-mestre.md', md, 'text/markdown;charset=utf-8');
        sb.from('a360_configuracoes').update({ ultimo_registro_exportado: new Date().toISOString() }).eq('usuario_id', ctx.estado.usuario.id).then(function () {});
        return md;
      });
    });
  }

  function backup(ctx) {
    var sb = ctx.sb, umAno = new Date(Date.now() - 365 * 86400000).toISOString(), saida = { app: 'aprovacao360', versao_schema: 1, exportado_em: new Date().toISOString(), tabelas: {} };
    return TABELAS.reduce(function (p, t) {
      return p.then(function () { return lerTudo(sb, t).then(function (linhas) { saida.tabelas[t] = linhas.filter(function (l) { return !l.excluido_em || l.excluido_em > umAno; }); }); });
    }, Promise.resolve()).then(function () {
      baixar('backup-aprovacao360-' + U.hojeISO() + '.json', JSON.stringify(saida, null, 1), 'application/json');
      var agora = new Date().toISOString();
      return sb.from('a360_configuracoes').update({ ultimo_backup: agora }).eq('usuario_id', ctx.estado.usuario.id).then(function () { ctx.estado.config.ultimo_backup = agora; return saida; });
    });
  }

  function resumoBackup(obj) {
    return TABELAS.map(function (t) { return [t.replace('a360_', ''), (obj.tabelas[t] || []).length]; });
  }

  function restaurar(ctx, obj) {
    var sb = ctx.sb, uid = ctx.estado.usuario.id, problemas = [], total = 0;
    return TABELAS.reduce(function (p, t) {
      return p.then(function () {
        var linhas = (obj.tabelas[t] || []).map(function (l) { return Object.assign({}, l, { usuario_id: uid }); });
        if (!linhas.length) return;
        if (t === 'a360_configuracoes') {
          var cfg = Object.assign({}, linhas[0]); delete cfg.id; delete cfg.usuario_id; delete cfg.criado_em; delete cfg.atualizado_em;
          return sb.from(t).update(cfg).eq('usuario_id', uid).then(function (r) { if (r.error) problemas.push(t + ': ' + r.error.message); else total++; });
        }
        var lotes = []; for (var i = 0; i < linhas.length; i += 500) lotes.push(linhas.slice(i, i + 500));
        return lotes.reduce(function (q, lote) {
          return q.then(function () { return sb.from(t).upsert(lote, { onConflict: 'id' }).then(function (r) { if (r.error) problemas.push(t.replace('a360_', '') + ': ' + r.error.message); else total += lote.length; }); });
        }, Promise.resolve());
      });
    }, Promise.resolve()).then(function () { return { total: total, problemas: problemas }; });
  }

  raiz.A360EXP = { montarRegistro: montarRegistro, validarBackup: validarBackup, resumoBackup: resumoBackup, TABELAS: TABELAS,
    registroMestre: registroMestre, backup: backup, restaurar: restaurar };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.A360EXP;
})(typeof window !== 'undefined' ? window : globalThis);
