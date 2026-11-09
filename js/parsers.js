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

  raiz.A360P = { lerEdital: lerEdital, planejarEdital: planejarEdital, payloadEdital: payloadEdital, bloco: bloco, limparLinha: limparLinha };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.A360P;
})(typeof window !== 'undefined' ? window : globalThis);
