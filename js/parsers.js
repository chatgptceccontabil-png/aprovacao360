// =====================================================================
// Aprovação 360° — leitores dos blocos gerados pela IA (funções puras)
// RN23: bloco EDITAL
// =====================================================================
(function (raiz) {
  'use strict';
  var U = raiz.A360U || (typeof require !== 'undefined' ? require('./util.js') : null);

  function limparLinha(raw) {
    return String(raw).replace(/\*\*/g, '').replace(/^\s*[-•*]\s+/, '').replace(/`/g, '').trim();
  }
  function bloco(txt, nome) {
    var s = String(txt || '');
    var ini = s.search(new RegExp('=+\\s*' + nome + '\\s*=+', 'i'));
    if (ini < 0) return null;
    var resto = s.slice(ini);
    var cab = resto.match(new RegExp('=+\\s*' + nome + '\\s*=+', 'i'))[0];
    var corpoEFim = resto.slice(cab.length);
    var fim = corpoEFim.search(/=+\s*FIM\s*=+/i);
    if (fim < 0) return null;
    return { corpo: corpoEFim.slice(0, fim), original: resto.slice(0, cab.length + fim) };
  }

  // ------------------------------------------------------------------
  // RN23 — lê o bloco === EDITAL === … === FIM ===
  // Retorna { erro } ou { concurso, disciplinas[], assuntos[], linhas[] }
  // linhas[]: { n, tipo, campos, status: 'ok'|'aviso'|'erro', msg }
  // ------------------------------------------------------------------
  function lerEdital(txt) {
    var b = bloco(txt, 'EDITAL');
    if (!b) return { erro: 'Não encontrei um bloco "=== EDITAL ===" … "=== FIM ===". Copie o bloco inteiro gerado pela IA com o comando /edital.' };
    var linhas = [], concursos = [], disciplinas = [], assuntos = [], vistos = {};
    var N = { CONCURSO: 6, DISCIPLINA: 3, ASSUNTO: 3 };
    b.corpo.split(/\r?\n/).forEach(function (raw) {
      var l = limparLinha(raw);
      if (!l) return;
      var f = l.split('|').map(function (x) { return x.trim(); });
      var tipo = U.norm(f[0]).toUpperCase().replace(/ /g, '_');
      var campos = f.slice(1);
      var linha = { n: linhas.length + 1, tipo: tipo || '?', campos: campos, status: 'ok', msg: '' };
      linhas.push(linha);
      if (!N[tipo]) { linha.status = 'erro'; linha.msg = 'Tipo de linha desconhecido (use CONCURSO, DISCIPLINA ou ASSUNTO).'; return; }
      // aceita campo final vazio omitido (ex.: data da prova)
      if (tipo === 'CONCURSO' && campos.length === 5) campos.push('');
      if (campos.length !== N[tipo]) { linha.status = 'erro'; linha.msg = 'Esperava ' + N[tipo] + ' campos e recebi ' + campos.length + '.'; return; }

      if (tipo === 'CONCURSO') {
        var codigo = campos[0].replace(/\s+/g, '-');
        if (!codigo || codigo.length > 40) { linha.status = 'erro'; linha.msg = 'Código do concurso vazio ou com mais de 40 caracteres.'; return; }
        if (!campos[1] || !campos[2]) { linha.status = 'erro'; linha.msg = 'Órgão e cargo são obrigatórios.'; return; }
        var dp = null;
        if (campos[5]) { dp = U.paraISO(campos[5]); if (!dp) { linha.status = 'aviso'; linha.msg = 'Data da prova "' + campos[5] + '" inválida; ficará em branco.'; } }
        if (codigo !== campos[0]) { linha.status = 'aviso'; linha.msg = (linha.msg ? linha.msg + ' ' : '') + 'Espaços no código trocados por hífen: ' + codigo + '.'; }
        concursos.push({ codigo: codigo, orgao: campos[1], cargo: campos[2], banca: campos[3] || null, edital_numero: campos[4] || null, data_prova: dp });
        return;
      }
      if (tipo === 'DISCIPLINA') {
        if (!campos[0]) { linha.status = 'erro'; linha.msg = 'Nome da disciplina vazio.'; return; }
        var chave = U.norm(campos[0]);
        if (vistos[chave]) { linha.status = 'aviso'; linha.msg = 'Disciplina repetida no bloco; usei só a primeira.'; return; }
        var avisos = [];
        function nota(v, rot) { var x = parseInt(v, 10); if (isNaN(x) || x < 1 || x > 5 || String(x) !== String(v).trim()) { avisos.push(rot + ' "' + v + '" fora de 1 a 5; ajustei para 3'); return 3; } return x; }
        var d = { chave: chave, nome: campos[0], peso: nota(campos[1], 'Peso'), incidencia: nota(campos[2], 'Incidência'), ordem: disciplinas.length + 1 };
        if (avisos.length) { linha.status = 'aviso'; linha.msg = avisos.join('; ') + '.'; }
        vistos[chave] = d; disciplinas.push(d);
        return;
      }
      if (tipo === 'ASSUNTO') {
        if (!campos[2]) { linha.status = 'erro'; linha.msg = 'Descrição do assunto vazia.'; return; }
        if ((campos[1] || '').length > 20) { linha.status = 'aviso'; linha.msg = 'Número do item com mais de 20 caracteres; foi cortado.'; }
        assuntos.push({ discChave: U.norm(campos[0]), discNome: campos[0], item: (campos[1] || '').slice(0, 20) || null, descricao: campos[2], linha: linha });
      }
    });
    if (concursos.length !== 1) return { erro: concursos.length === 0 ? 'O bloco precisa de exatamente 1 linha CONCURSO válida.' : 'O bloco tem ' + concursos.length + ' linhas CONCURSO; deve ter só 1.', linhas: linhas };
    return { concurso: concursos[0], disciplinas: disciplinas, assuntos: assuntos, linhas: linhas, original: b.original };
  }

  // ------------------------------------------------------------------
  // Compara o EDITAL lido com o que já existe no banco e monta o plano.
  // existente: null (concurso novo) ou { concurso:{id}, disciplinas:[{id,nome,peso,incidencia,assuntos:[{descricao}]}] }
  // Nunca apaga nada (RN23).
  // ------------------------------------------------------------------
  function planejarEdital(lido, existente) {
    var discExist = {}, plano = { concursoId: existente && existente.concurso ? existente.concurso.id : null, disciplinas: [], resumo: { discNovas: 0, discAtualizadas: 0, assNovos: 0, assExistentes: 0, assErro: 0 } };
    ((existente && existente.disciplinas) || []).forEach(function (d) {
      var mapa = {}; (d.assuntos || []).forEach(function (a) { mapa[U.norm(a.descricao)] = true; });
      discExist[U.norm(d.nome)] = { d: d, assuntos: mapa };
    });
    var porChave = {};
    lido.disciplinas.forEach(function (d) {
      var ex = discExist[d.chave];
      var p = { id: ex ? ex.d.id : null, nome: ex ? ex.d.nome : d.nome, peso: d.peso, incidencia: d.incidencia, assuntos: [],
        acao: !ex ? 'nova' : ((ex.d.peso !== d.peso || ex.d.incidencia !== d.incidencia) ? 'atualiza' : 'igual'),
        antes: ex ? { peso: ex.d.peso, incidencia: ex.d.incidencia } : null, _vistos: ex ? Object.assign({}, ex.assuntos) : {} };
      if (p.acao === 'nova') plano.resumo.discNovas++;
      if (p.acao === 'atualiza') plano.resumo.discAtualizadas++;
      porChave[d.chave] = p; plano.disciplinas.push(p);
    });
    lido.assuntos.forEach(function (a) {
      var p = porChave[a.discChave];
      if (!p) {
        var ex = discExist[a.discChave];
        if (ex) {
          p = { id: ex.d.id, nome: ex.d.nome, peso: ex.d.peso, incidencia: ex.d.incidencia, assuntos: [], acao: 'igual', antes: null, _vistos: Object.assign({}, ex.assuntos) };
          porChave[a.discChave] = p; plano.disciplinas.push(p);
        } else {
          a.linha.status = 'erro'; a.linha.msg = 'A disciplina "' + a.discNome + '" não foi declarada no bloco nem existe neste concurso.';
          plano.resumo.assErro++; return;
        }
      }
      var k = U.norm(a.descricao);
      if (p._vistos[k]) { a.linha.acao = 'existe'; plano.resumo.assExistentes++; return; }
      p._vistos[k] = true; a.linha.acao = 'novo';
      p.assuntos.push({ item: a.item, descricao: a.descricao });
      plano.resumo.assNovos++;
    });
    plano.disciplinas.forEach(function (p) { delete p._vistos; });
    return plano;
  }

  // Dados enviados à função a360_importar_edital (RN29)
  function payloadEdital(lido, plano) {
    return {
      concurso_id: plano.concursoId,
      concurso: lido.concurso,
      disciplinas: plano.disciplinas.filter(function (d) { return d.acao !== 'igual' || d.assuntos.length; })
        .map(function (d) { return { id: d.id, nome: d.nome, peso: d.peso, incidencia: d.incidencia, assuntos: d.assuntos }; })
    };
  }

  // ------------------------------------------------------------------
  // RN20 — lê o bloco === CHECKPOINT === … === FIM ===
  // Retorna { erro } ou { cab:{data,concurso,conversa,ia,avisos[]}, linhas[], original }
  // ------------------------------------------------------------------
  var TIPOS_SESSAO = { aula: 'aula', rapida: 'rapida', questoes: 'questoes', questao: 'questoes', revisao: 'revisao', simulado: 'simulado', lei_seca: 'lei_seca', leitura: 'leitura' };
  var STATUS_SESSAO = { REALIZADO: 1, PENDENTE: 1, CANCELADO: 1, REPROGRAMADO: 1, PLANEJADO: 1 };
  var MOTIVOS = { conceito: 'conceito', letra_da_lei: 'letra_da_lei', letra_de_lei: 'letra_da_lei', lei: 'letra_da_lei', pegadinha: 'pegadinha', interpretacao: 'interpretacao', calculo: 'calculo', atencao: 'atencao', falta_de_atencao: 'atencao', desatencao: 'atencao', chute: 'chute' };
  var MOTIVO_ROTULO = { conceito: 'Conceito', letra_da_lei: 'Letra da lei', pegadinha: 'Pegadinha', interpretacao: 'Interpretação', calculo: 'Cálculo', atencao: 'Falta de atenção', chute: 'Chute' };
  // tipo: [mínimo de campos, máximo (null = junta o resto no último)]
  var FORMATO = { SESSAO: [5, 5], QUESTOES: [4, 4], ERRO: [4, null], REVISAO: [3, 3], DIFICULDADE: [3, null], ULTIMO_PONTO: [3, null], PROXIMA: [1, null], PROPOSTA: [1, null], CORRECAO: [1, null] };
  var COM_ASSUNTO = { SESSAO: 1, QUESTOES: 1, ERRO: 1, REVISAO: 1, DIFICULDADE: 1, ULTIMO_PONTO: 1 };
  var EXIGE_ASSUNTO = { QUESTOES: 1, ERRO: 1, REVISAO: 1, DIFICULDADE: 1, ULTIMO_PONTO: 1 };

  // RN32
  function normalizarIA(v) {
    var n = U.norm(v);
    if (!n) return null;
    if (/claude|anthropic/.test(n)) return 'claude';
    if (/chat ?gpt|gpt|openai/.test(n)) return 'chatgpt';
    return 'outra';
  }

  function inteiro(v) { var s = String(v || '').trim().replace(/%$/, '').trim(); return /^\d+$/.test(s) ? parseInt(s, 10) : NaN; }

  function lerCheckpoint(txt, hoje) {
    var b = bloco(txt, 'CHECKPOINT');
    if (!b) return { erro: 'Não encontrei um bloco "=== CHECKPOINT ===" … "=== FIM ===". Copie o bloco inteiro gerado pela IA.' };
    var cab = { data: null, concurso: '', conversa: '', ia: null, iaTexto: '', avisos: [] };
    var linhas = [];
    b.corpo.split(/\r?\n/).forEach(function (raw) {
      var l = limparLinha(raw);
      if (!l) return;
      var mc = l.match(/^(data|concurso|conversa|ia)\s*:\s*(.*)$/i);
      if (mc && l.indexOf('|') < 0) {
        var k = mc[1].toLowerCase(), v = mc[2].trim();
        if (k === 'data') { cab.data = U.paraISO(v); if (!cab.data) cab.avisos.push('Data "' + v + '" inválida; usei hoje.'); }
        else if (k === 'ia') { cab.iaTexto = v; cab.ia = normalizarIA(v); }
        else cab[k] = v;
        return;
      }
      var f = l.split('|').map(function (x) { return x.trim(); });
      var tipo = U.norm(f[0]).toUpperCase().replace(/ /g, '_');
      var campos = f.slice(1);
      var linha = { n: linhas.length + 1, tipo: tipo || '?', campos: campos, status: 'ok', msg: '', raw: l };
      linhas.push(linha);
      var fmt = FORMATO[tipo];
      if (!fmt) { linha.status = 'erro'; linha.msg = 'Tipo de linha desconhecido.'; return; }
      if (campos.length < fmt[0] || (fmt[1] && campos.length > fmt[1])) {
        linha.status = 'erro'; linha.msg = 'Esperava ' + fmt[0] + ' campo(s) e recebi ' + campos.length + '.'; return;
      }
      if (!fmt[1] && campos.length > fmt[0]) { campos = campos.slice(0, fmt[0] - 1).concat([campos.slice(fmt[0] - 1).join(' | ')]); linha.campos = campos; }
      if (COM_ASSUNTO[tipo]) {
        linha.disciplina = campos[0]; linha.assunto = campos[1];
        if (!linha.disciplina) { linha.status = 'erro'; linha.msg = 'Disciplina vazia.'; return; }
        var semAssunto = !linha.assunto || U.norm(linha.assunto) === 'geral';
        if (semAssunto) { if (EXIGE_ASSUNTO[tipo]) { linha.status = 'erro'; linha.msg = 'Esta linha precisa de um assunto.'; return; } linha.assunto = null; }
      }
      if (tipo === 'SESSAO') {
        var t = TIPOS_SESSAO[U.norm(campos[2]).replace(/ /g, '_')];
        var st = U.norm(campos[3]).toUpperCase();
        var mi = inteiro(campos[4]);
        if (!t) { linha.status = 'erro'; linha.msg = 'Tipo de sessão "' + campos[2] + '" inválido.'; return; }
        if (!STATUS_SESSAO[st]) { linha.status = 'erro'; linha.msg = 'Status "' + campos[3] + '" inválido (use REALIZADO, PENDENTE, CANCELADO ou REPROGRAMADO).'; return; }
        if (isNaN(mi) || mi > 720) { linha.status = 'erro'; linha.msg = 'Minutos devem ser um número de 0 a 720.'; return; }
        linha.valor = { tipo: t, status: st, minutos: mi };
      }
      if (tipo === 'QUESTOES') {
        var fe = inteiro(campos[2]), ac = inteiro(campos[3]);
        if (isNaN(fe) || isNaN(ac) || fe < 1) { linha.status = 'erro'; linha.msg = 'Feitas e acertos devem ser números (feitas ≥ 1).'; return; }
        if (ac > fe) { linha.status = 'erro'; linha.msg = 'Acertos maior que feitas.'; return; }
        linha.valor = { feitas: fe, acertos: ac };
      }
      if (tipo === 'ERRO') {
        var mo = MOTIVOS[U.norm(campos[2]).replace(/ /g, '_')];
        if (!mo) { linha.status = 'erro'; linha.msg = 'Motivo "' + campos[2] + '" inválido.'; return; }
        var desc = campos[3];
        if (!desc) { linha.status = 'erro'; linha.msg = 'Descrição do erro vazia.'; return; }
        if (desc.length > 500) { desc = desc.slice(0, 500); linha.status = 'aviso'; linha.msg = 'Descrição cortada em 500 caracteres.'; }
        linha.valor = { motivo: mo, descricao: desc };
      }
      if (tipo === 'REVISAO') {
        var r = inteiro(campos[2]);
        if (isNaN(r) || r > 100) { linha.status = 'erro'; linha.msg = 'Percentual deve ser de 0 a 100.'; return; }
        linha.valor = { resultado: r };
      }
      if (tipo === 'DIFICULDADE' || tipo === 'ULTIMO_PONTO') {
        if (!campos[2]) { linha.status = 'erro'; linha.msg = 'Texto vazio.'; return; }
        linha.valor = { texto: campos[2] };
      }
      if (tipo === 'PROXIMA' || tipo === 'PROPOSTA' || tipo === 'CORRECAO') {
        if (!campos[0]) { linha.status = 'erro'; linha.msg = 'Texto vazio.'; return; }
        linha.valor = { texto: campos[0] };
      }
    });
    if (!cab.data) { if (!cab.avisos.length) cab.avisos.push('Sem "data:"; usei hoje.'); cab.data = hoje || U.hojeISO(); }
    if (!linhas.length) return { erro: 'O bloco não tem nenhuma linha de dados.' };
    return { cab: cab, linhas: linhas, original: b.original };
  }

  // ------------------------------------------------------------------
  // RN22 — casa disciplina e assunto com o edital do concurso
  // discs: [{id,nome,assuntos:[{id,descricao}]}]
  // Marca em cada linha: disc, assuntoId | precisaDecidir (+sugestao)
  // ------------------------------------------------------------------
  function resolverCheckpoint(lido, discs) {
    lido.linhas.forEach(function (l) {
      delete l.disc; delete l.assuntoRef; delete l.sugestao; delete l.precisaDecidir;
      if (l.status === 'erro' || !COM_ASSUNTO[l.tipo]) return;
      var nd = U.norm(l.disciplina), disc = null, best = 0, cand = null;
      discs.forEach(function (d) { if (U.norm(d.nome) === nd) disc = d; else { var s = U.dice(d.nome, l.disciplina); if (s > best) { best = s; cand = d; } } });
      if (!disc && cand && best >= 0.75) { disc = cand; l.msg = (l.msg ? l.msg + ' ' : '') + 'Disciplina reconhecida como "' + cand.nome + '".'; if (l.status === 'ok') l.status = 'aviso'; }
      if (!disc) { l.status = 'erro'; l.msg = 'A disciplina "' + l.disciplina + '" não existe neste concurso.'; return; }
      l.disc = { id: disc.id, nome: disc.nome };
      if (l.assunto === null) return;
      var na = U.norm(l.assunto), ex = null, sb = 0, sug = null;
      disc.assuntos.forEach(function (a) { if (U.norm(a.descricao) === na) ex = a; else { var s = U.dice(a.descricao, l.assunto); if (s > sb) { sb = s; sug = a; } } });
      if (ex) { l.assuntoRef = { id: ex.id, descricao: ex.descricao }; return; }
      l.precisaDecidir = true;
      l.sugestao = (sug && sb >= 0.6) ? { id: sug.id, descricao: sug.descricao } : null;
    });
    return lido;
  }

  // Monta os dados da função a360_importar_checkpoint (RN29)
  // decisoes[n] = 'assoc' | 'novo' | 'ignorar'
  function payloadCheckpoint(lido, decisoes, extra) {
    var novos = {}, p = { sessoes: [], questoes: [], erros: [], revisoes: [], dificuldades: [], ultimos: [], novos_assuntos: [], proxima: null, propostas: [], correcoes: [] };
    var cont = { sessoes: 0, questoes: 0, questoes_feitas: 0, erros: 0, revisoes: 0, ignoradas: 0, invalidas: 0 };
    lido.linhas.forEach(function (l) {
      if (l.status === 'erro') { cont.invalidas++; return; }
      var ref = null;
      if (COM_ASSUNTO[l.tipo] && l.assunto !== null) {
        if (l.assuntoRef) ref = { assunto_id: l.assuntoRef.id };
        else {
          var dec = decisoes[l.n];
          if (!dec || dec === 'ignorar') { cont.ignoradas++; return; }
          if (dec === 'assoc' && l.sugestao) ref = { assunto_id: l.sugestao.id };
          else {
            var chave = l.disc.id + '|' + U.norm(l.assunto);
            if (!novos[chave]) { novos[chave] = true; p.novos_assuntos.push({ chave: chave, disciplina_id: l.disc.id, descricao: l.assunto }); }
            ref = { assunto_chave: chave };
          }
        }
      }
      var base = COM_ASSUNTO[l.tipo] ? Object.assign({ disciplina_id: l.disc.id }, ref || {}) : {};
      switch (l.tipo) {
        case 'SESSAO': p.sessoes.push(Object.assign(base, l.valor)); cont.sessoes++; break;
        case 'QUESTOES': p.questoes.push(Object.assign(base, l.valor)); cont.questoes++; cont.questoes_feitas += l.valor.feitas; break;
        case 'ERRO': p.erros.push(Object.assign(base, l.valor)); cont.erros++; break;
        case 'REVISAO': p.revisoes.push(Object.assign(base, l.valor)); cont.revisoes++; break;
        case 'DIFICULDADE': p.dificuldades.push(Object.assign(base, l.valor)); break;
        case 'ULTIMO_PONTO': p.ultimos.push(Object.assign(base, l.valor)); break;
        case 'PROXIMA': p.proxima = l.valor.texto; break;
        case 'PROPOSTA': p.propostas.push(l.valor.texto); break;
        case 'CORRECAO': p.correcoes.push(l.valor.texto); break;
      }
    });
    extra = extra || {};
    return {
      concurso_id: extra.concurso_id, data: lido.cab.data, conversa: lido.cab.conversa || null,
      ia: lido.cab.ia || extra.ia_padrao || null, texto_original: lido.original, hash: extra.hash,
      resumo: cont, sessoes: p.sessoes, questoes: p.questoes, erros: p.erros, revisoes: p.revisoes,
      dificuldades: p.dificuldades, ultimos: p.ultimos, novos_assuntos: p.novos_assuntos,
      proxima: p.proxima, propostas: p.propostas.join('\n') || null, correcoes: p.correcoes.join('\n') || null
    };
  }

  // RN21: texto normalizado usado no hash
  function textoParaHash(original) { return String(original || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim().replace(/\s+/g, ' '); }).filter(Boolean).join('\n'); }

  raiz.A360P = { lerEdital: lerEdital, planejarEdital: planejarEdital, payloadEdital: payloadEdital, bloco: bloco, limparLinha: limparLinha,
    lerCheckpoint: lerCheckpoint, resolverCheckpoint: resolverCheckpoint, payloadCheckpoint: payloadCheckpoint, textoParaHash: textoParaHash,
    normalizarIA: normalizarIA, MOTIVO_ROTULO: MOTIVO_ROTULO };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.A360P;
})(typeof window !== 'undefined' ? window : globalThis);
