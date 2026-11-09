// Testes do leitor de EDITAL (RN23). Rodar: node testes/edital.test.js
const assert = require('assert');
const P = require('../js/parsers.js');
const EX = `Aqui está o bloco:
=== EDITAL ===
CONCURSO | ISS-SP-AFTM-2026 | Prefeitura de São Paulo | Auditor Fiscal Tributário Municipal | FGV | 01/2026 | 21/02/2027
DISCIPLINA | Direito Tributário | 5 | 5
DISCIPLINA | Legislação Tributária Municipal | 5 | 4
DISCIPLINA | Língua Portuguesa | 7 | 3
ASSUNTO | Direito Tributário | 1 | Competência tributária
ASSUNTO | Direito Tributário | 2 | Limitações ao poder de tributar
ASSUNTO | Direito Tributario | 3 | Lançamento tributário
ASSUNTO | Legislação Tributária Municipal | 1.1 | ISS: fato gerador
ASSUNTO | Contabilidade | 1 | Balanço
ASSUNTO | Língua Portuguesa | 1 | Interpretação
LINHA ESTRANHA | x
=== FIM ===`;
const r = P.lerEdital(EX);
assert(!r.erro, r.erro);
assert.strictEqual(r.concurso.codigo, 'ISS-SP-AFTM-2026');
assert.strictEqual(r.concurso.data_prova, '2027-02-21');
assert.strictEqual(r.disciplinas.length, 3);
assert.strictEqual(r.disciplinas[2].peso, 3, 'peso 7 ajustado para 3');
assert.strictEqual(r.assuntos.length, 6);
// concurso novo
let pl = P.planejarEdital(r, null);
assert.strictEqual(pl.resumo.discNovas, 3);
assert.strictEqual(pl.resumo.assNovos, 5);
assert.strictEqual(pl.resumo.assErro, 1, 'Contabilidade não declarada');
assert.strictEqual(pl.disciplinas[0].assuntos.length, 3, 'Direito Tributario sem acento casa');
// reimportação com 1 assunto novo e peso mudado
const ex = { concurso: { id: 'c1' }, disciplinas: [
  { id: 'd1', nome: 'Direito Tributário', peso: 5, incidencia: 4, assuntos: [{ descricao: 'Competência tributária' }, { descricao: 'Limitações ao poder de tributar' }] },
  { id: 'd9', nome: 'Contabilidade', peso: 4, incidencia: 4, assuntos: [] } ] };
const r2 = P.lerEdital(EX);
pl = P.planejarEdital(r2, ex);
assert.strictEqual(pl.concursoId, 'c1');
assert.strictEqual(pl.resumo.discAtualizadas, 1);
assert.strictEqual(pl.resumo.discNovas, 2);
assert.strictEqual(pl.resumo.assExistentes, 2);
assert.strictEqual(pl.resumo.assErro, 0, 'Contabilidade já existe no banco');
const pay = P.payloadEdital(r2, pl);
assert.strictEqual(pay.disciplinas.find(d => d.id === 'd1').assuntos.length, 1);
assert.strictEqual(pay.disciplinas.find(d => d.id === 'd9').assuntos[0].descricao, 'Balanço');
// erros
assert(P.lerEdital('sem bloco').erro);
assert(P.lerEdital('=== EDITAL ===\nDISCIPLINA | X | 3 | 3\n=== FIM ===').erro, 'sem CONCURSO');
console.log('edital: todos os testes passaram');
