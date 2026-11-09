// =====================================================================
// Aprovação 360° — cálculos do painel (funções puras, testáveis)
// RN05, RN06, RN07, RN08, RN12, RN13, RN14, RN15
// =====================================================================
(function (raiz) {
  'use strict';
  var U = raiz.A360U || (typeof require !== 'undefined' ? require('./util.js') : null);
  var MOTIVO = { conceito: 'Conceito', letra_da_lei: 'Letra da lei', pegadinha: 'Pegadinha', interpretacao: 'Interpretação', calculo: 'Cálculo', atencao: 'Falta de atenção', chute: 'Chute' };

  // RN05: prioridade = peso × incidência × (1 − acerto); acerto = 0,5 com menos de 10 questões
  function acertoDisc(feitas, acertos) { return feitas >= 10 ? acertos / feitas : 0.5; }
  function prioridade(peso, inc, feitas, acertos) { return peso * inc * (1 - acertoDisc(feitas || 0, acertos || 0)); }

  // RN06: distribui as horas da semana pela prioridade (0,5 h; mínimo 0,5 h p/ disciplina com assunto não dominado)
  function distribuirCiclo(discs, horasSemana) {
    var rows = discs.map(function (d) {
      return { id: d.id, nome: d.nome, peso: d.peso, incidencia: d.incidencia, feitas: d.feitas || 0, acertos: d.acertos || 0,
        pendente: d.pendente !== false, pr: prioridade(d.peso, d.incidencia, d.feitas, d.acertos) };
    });
    var S = rows.reduce(function (s, r) { return s + r.pr; }, 0), tot = 0, top = null;
    rows.forEach(function (r) {
      var h = S > 0 ? Math.round(horasSemana * r.pr / S * 2) / 2 : 0;
      if (r.pendente && h < 0.5) h = 0.5;
      r.horas = h; tot += h;
      if (!top || r.pr > top.pr) top = r;
    });
    if (top) top.horas = Math.max(0, Math.round((top.horas + (horasSemana - tot)) * 2) / 2);
    return rows;
  }

  // Segunda-feira da semana de "hoje"
  function inicioSemana(hoje) {
    var d = new Date(hoje + 'T12:00:00Z'), dow = d.getUTCDay(); // 0 = domingo
    return U.addDias(hoje, dow === 0 ? -6 : 1 - dow);
  }

  // RN07: próxima da vez = maior déficit (meta − realizado na semana); empate → maior prioridade.
  // Assunto sugerido: em_estudo com último ponto > em_estudo > nao_iniciado (ordem do edital).
  function proximaDaVez(rows, minutosSemana, assuntosPorDisc) {
    var prox = null;
    rows.forEach(function (r) {
      r.feitoMin = minutosSemana[r.id] || 0;
      r.deficit = r.horas * 60 - r.feitoMin;
      if (!prox || r.deficit > prox.deficit || (r.deficit === prox.deficit && r.pr > prox.pr)) prox = r;
    });
    if (!prox) return null;
    var as = (assuntosPorDisc[prox.id] || []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    var a = as.filter(function (x) { return x.status === 'em_estudo' && x.ultimo_ponto; })[0]
      || as.filter(function (x) { return x.status === 'em_estudo'; })[0]
      || as.filter(function (x) { return x.status === 'nao_iniciado'; })[0]
      || as.filter(function (x) { return x.status === 'revisao'; })[0] || as[0] || null;
    return { disciplina: prox, assunto: a };
  }

  // RN08: sequência de dias. diasAtivos = { 'AAAA-MM-DD': true }
  function sequencia(diasAtivos, hoje) {
    var n = 0, d = U.addDias(hoje, -1);
    while (diasAtivos[d]) { n++; d = U.addDias(d, -1); }
    return n + (diasAtivos[hoje] ? 1 : 0);
  }
  // Dia conta se tiver sessões REALIZADAS somando ≥ mínimo ou ao menos um lote de questões
  function diasQueContam(sessoes, questoes, minimo) {
    var min = {}, ok = {};
    sessoes.forEach(function (s) { if (s.status === 'REALIZADO') min[s.data] = (min[s.data] || 0) + (s.minutos || 0); });
    Object.keys(min).forEach(function (d) { if (min[d] >= minimo) ok[d] = true; });
    questoes.forEach(function (q) { ok[q.data] = true; });
    return ok;
  }

  // RN15: assunto com ≥3 erros não revisados ou ≥2 do mesmo motivo nos últimos 30 dias
  function errosRecorrentes(erros, hoje) {
    var por = {};
    erros.forEach(function (e) { if (e.revisado) return; (por[e.assunto_id] = por[e.assunto_id] || []).push(e); });
    var out = [];
    Object.keys(por).forEach(function (aid) {
      var lista = por[aid], cnt = {}, mot = null;
      lista.forEach(function (e) { if (U.difDias(hoje, e.data) <= 30) { cnt[e.motivo] = (cnt[e.motivo] || 0) + 1; if (cnt[e.motivo] >= 2) mot = e.motivo; } });
      if (lista.length >= 3 || mot) out.push({ assunto_id: aid, erros: lista, motivo: mot, total: lista.length });
    });
    return out.sort(function (a, b) { return b.total - a.total; });
  }

  // RN12: monta o Prompt do Dia
  // dados: { tipo: 'geral'|'assunto'|'revisao'|'erros', hoje, concurso, sequencia, semanaHoras, metaHoras, semanaQuestoes, metaQuestoes,
  //          revisoes:[{disciplina, assunto, etapa, data_prevista}], recorrentes:[{disciplina, assunto, motivo, descricao}],
  //          estudo:{disciplina, assunto, status, ultimo_ponto, dificuldades, feitas, acertos}, links:[{titulo,url}] }
  function montarPrompt(d) {
    var L = [], c = d.concurso || {};
    var conversa = (d.tipo === 'revisao' || d.tipo === 'erros') ? 'Questões' : 'Sala de Aula';
    L.push('PROMPT DO DIA — Aprovação 360° | ' + U.dataBR(d.hoje) + ' | Conversa: ' + conversa);
    var dias = c.data_prova ? U.difDias(c.data_prova, d.hoje) : null;
    L.push('Concurso: ' + c.codigo + ' (' + c.cargo + ' – ' + c.orgao + (c.banca ? ', banca ' + c.banca : '') + ')' + (dias !== null && dias >= 0 ? ' | Prova em ' + dias + ' dias' : ''));
    var sem = 'Sequência: ' + (d.sequencia || 0) + ((d.sequencia || 0) === 1 ? ' dia' : ' dias') + ' | Semana: ' + U.num1(d.semanaHoras || 0) + ' h' + (d.metaHoras ? ' de ' + U.num1(d.metaHoras) + ' h' : '');
    if (d.semanaQuestoes !== undefined) sem += ' | ' + d.semanaQuestoes + (d.metaQuestoes ? ' de ' + d.metaQuestoes : '') + ' questões';
    L.push(sem);
    L.push('');
    var revs = (d.revisoes || []).slice(0, 10);
    if ((d.tipo === 'geral' || d.tipo === 'revisao') && revs.length) {
      L.push('1) REVISÕES VENCIDAS (faça primeiro, 3 questões por assunto, sem gabarito antes da minha resposta):');
      revs.forEach(function (r) {
        var atraso = U.difDias(d.hoje, r.data_prevista);
        L.push('- ' + r.disciplina + ' > ' + r.assunto + ' (etapa ' + r.etapa + ', ' + (atraso > 0 ? 'atraso ' + atraso + ' dia(s)' : 'hoje') + ')');
      });
      L.push('');
    }
    var rec = (d.recorrentes || []).slice(0, 15);
    if (d.tipo === 'geral' && rec.length) {
      L.push('2) ERROS RECORRENTES (inclua 1 questão de cada no meio da sessão):');
      rec.forEach(function (e) { L.push('- ' + e.disciplina + ' > ' + e.assunto + ': ' + (MOTIVO[e.motivo] || e.motivo) + ' – ' + e.descricao); });
      L.push('');
    }
    if (d.tipo === 'erros') {
      L.push('2) ERROS PARA TREINAR (crie 1 questão inédita para cada erro listado):');
      rec.forEach(function (e) { L.push('- ' + e.disciplina + ' > ' + e.assunto + ': ' + (MOTIVO[e.motivo] || e.motivo) + ' – ' + e.descricao); });
      L.push('/erros');
      L.push('');
    }
    if ((d.tipo === 'geral' || d.tipo === 'assunto') && d.estudo) {
      var e = d.estudo;
      L.push(d.tipo === 'geral' ? '3) ESTUDO DE HOJE (próxima do ciclo):' : 'ESTUDO DE HOJE (escolhido por mim):');
      L.push('/aula ' + e.disciplina + ' > ' + e.assunto);
      var sit = [];
      if (e.feitas) sit.push(e.feitas + ' questões, ' + U.pct(e.acertos, e.feitas) + ' de acerto');
      if (e.ultimo_ponto) sit.push('Último ponto: ' + e.ultimo_ponto);
      if (e.dificuldades) sit.push('Dificuldades: ' + String(e.dificuldades).split('\n').slice(-3).join('; '));
      if (sit.length) L.push(sit.join(' | '));
      (d.links || []).slice(0, 5).forEach(function (l) { L.push('Material: ' + l.titulo + ' – ' + l.url); });
      L.push('');
    }
    L.push('Ao final, gere o CHECKPOINT no formato oficial' + (d.tipo === 'assunto' ? '.' : ', com os resultados das revisões em linhas REVISAO.'));
    return L.join('\n');
  }

  raiz.A360C = { prioridade: prioridade, acertoDisc: acertoDisc, distribuirCiclo: distribuirCiclo, inicioSemana: inicioSemana, proximaDaVez: proximaDaVez,
    sequencia: sequencia, diasQueContam: diasQueContam, errosRecorrentes: errosRecorrentes, montarPrompt: montarPrompt };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.A360C;
})(typeof window !== 'undefined' ? window : globalThis);
