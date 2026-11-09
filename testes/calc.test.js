// Testes dos cálculos do painel. Rodar: node testes/calc.test.js
const assert = require('assert');
const C = require('../js/calc.js');
// RN05 (exemplos do projeto)
assert.strictEqual(C.prioridade(5, 5, 100, 60), 10);
assert.strictEqual(C.prioridade(3, 4, 0, 0), 6);
assert.strictEqual(C.prioridade(5, 5, 9, 9), 12.5, '<10 questões usa 50%');
// RN06: 20 h, prioridades 10/6/4 → 10/6/4
let rows = C.distribuirCiclo([
  { id: 'a', nome: 'A', peso: 5, incidencia: 5, feitas: 100, acertos: 60 },
  { id: 'b', nome: 'B', peso: 3, incidencia: 4 },
  { id: 'c', nome: 'C', peso: 2, incidencia: 4 }], 20);
assert.deepStrictEqual(rows.map(r => r.horas), [10, 6, 4]);
// mínimo 0,5 h e soma = total
rows = C.distribuirCiclo([{ id: 'a', peso: 5, incidencia: 5 }, { id: 'b', peso: 1, incidencia: 1, feitas: 50, acertos: 49 }], 10);
assert.strictEqual(rows[1].horas, 0.5); assert.strictEqual(rows[0].horas + rows[1].horas, 10);
// semana começa na segunda
assert.strictEqual(C.inicioSemana('2026-11-09'), '2026-11-09'); // segunda
assert.strictEqual(C.inicioSemana('2026-11-15'), '2026-11-09'); // domingo
assert.strictEqual(C.inicioSemana('2026-11-12'), '2026-11-09');
// RN07
rows = C.distribuirCiclo([{ id: 'a', peso: 5, incidencia: 5, feitas: 100, acertos: 60 }, { id: 'b', peso: 3, incidencia: 4 }, { id: 'c', peso: 2, incidencia: 4 }], 20);
let p = C.proximaDaVez(rows, { a: 9 * 60, b: 60 }, { b: [
  { id: 'b1', ordem: 1, status: 'nao_iniciado' }, { id: 'b2', ordem: 2, status: 'em_estudo' }, { id: 'b3', ordem: 3, status: 'em_estudo', ultimo_ponto: 'x' }] });
assert.strictEqual(p.disciplina.id, 'b', 'maior déficit: B (6h−1h)');
assert.strictEqual(p.assunto.id, 'b3', 'prefere em estudo com último ponto');
// RN08
const ativos = { '2026-11-07': true, '2026-11-08': true, '2026-11-09': true };
assert.strictEqual(C.sequencia(ativos, '2026-11-10'), 3, 'hoje sem atividade não zera');
assert.strictEqual(C.sequencia(Object.assign({ '2026-11-10': true }, ativos), '2026-11-10'), 4);
assert.strictEqual(C.sequencia({ '2026-11-08': true }, '2026-11-10'), 0);
const dias = C.diasQueContam([{ data: '2026-11-09', status: 'REALIZADO', minutos: 10 }, { data: '2026-11-09', status: 'REALIZADO', minutos: 10 }, { data: '2026-11-08', status: 'REALIZADO', minutos: 5 }, { data: '2026-11-07', status: 'PENDENTE', minutos: 60 }], [{ data: '2026-11-06' }], 15);
assert.deepStrictEqual(Object.keys(dias).sort(), ['2026-11-06', '2026-11-09']);
// RN15
const rec = C.errosRecorrentes([
  { assunto_id: 'x', motivo: 'pegadinha', data: '2026-11-01' }, { assunto_id: 'x', motivo: 'pegadinha', data: '2026-11-05' },
  { assunto_id: 'y', motivo: 'conceito', data: '2026-11-01' }, { assunto_id: 'y', motivo: 'calculo', data: '2026-11-02' },
  { assunto_id: 'z', motivo: 'a', data: '2026-01-01' }, { assunto_id: 'z', motivo: 'b', data: '2026-01-01' }, { assunto_id: 'z', motivo: 'c', data: '2026-01-01' },
  { assunto_id: 'w', motivo: 'pegadinha', data: '2026-11-01', revisado: true }, { assunto_id: 'w', motivo: 'pegadinha', data: '2026-11-02' }], '2026-11-09');
assert.deepStrictEqual(rec.map(r => r.assunto_id).sort(), ['x', 'z']);
// RN12
const txt = C.montarPrompt({ tipo: 'geral', hoje: '2026-11-09', concurso: { codigo: 'ISS-SP', cargo: 'AFTM', orgao: 'Pref SP', banca: 'FGV', data_prova: '2027-02-21' },
  sequencia: 6, semanaHoras: 12, metaHoras: 20, semanaQuestoes: 80, metaQuestoes: 250,
  revisoes: [{ disciplina: 'DT', assunto: 'Obrigação', etapa: 7, data_prevista: '2026-11-08' }],
  recorrentes: [{ disciplina: 'DT', assunto: 'Limitações', motivo: 'pegadinha', descricao: 'noventena' }],
  estudo: { disciplina: 'ISS', assunto: 'Local', feitas: 30, acertos: 15, ultimo_ponto: 'art. 3º' } });
assert(txt.startsWith('PROMPT DO DIA — Aprovação 360° | 09/11/2026 | Conversa: Sala de Aula'));
assert(/Prova em 104 dias/.test(txt));
assert(/1\) REVISÕES VENCIDAS/.test(txt) && /atraso 1 dia/.test(txt));
assert(/2\) ERROS RECORRENTES/.test(txt) && /Pegadinha – noventena/.test(txt));
assert(/\/aula ISS > Local/.test(txt) && /50% de acerto/.test(txt));
assert(/gere o CHECKPOINT/.test(txt));
const ta = C.montarPrompt({ tipo: 'assunto', hoje: '2026-11-09', concurso: { codigo: 'X', cargo: 'c', orgao: 'o' }, revisoes: [{ disciplina: 'D', assunto: 'A', etapa: 1, data_prevista: '2026-11-09' }], estudo: { disciplina: 'D', assunto: 'B' } });
assert(!/REVISÕES/.test(ta) && /ESTUDO DE HOJE \(escolhido por mim\)/.test(ta));
console.log('calc: todos os testes passaram');
