// Testes do Registro Mestre (RN24) e do backup (RN25). Rodar: node testes/registro.test.js
const assert = require('assert');
global.A360U = require('../js/util.js'); global.A360C = require('../js/calc.js');
const E = require('../js/exportar.js');
const md = E.montarRegistro({ agora: new Date(2026, 10, 9, 21, 5), hoje: '2026-11-09', perfil_md: '## 1. Perfil do candidato\n| Campo | Valor |\n|---|---|\n| Horas por dia | 3 |',
  concursos: [{ id: 'c1', codigo: 'ISS-SP', orgao: 'Pref SP', cargo: 'AFTM', banca: 'FGV', status: 'publicado', prioritario: true, data_prova: '2027-02-21' }],
  ativo: { id: 'c1', codigo: 'ISS-SP' }, plano: { versao: 2, data_aprovacao: '2026-11-09', horas_semana: 25, meta_questoes_semana: 250, observacoes: 'férias' },
  planos: [{ versao: 1, data_aprovacao: '2026-11-01', horas_semana: 20, meta_questoes_semana: 200 }, { versao: 2, data_aprovacao: '2026-11-09', horas_semana: 25, meta_questoes_semana: 250, observacoes: 'férias', vigente: true }],
  discs: [{ id: 'd1', nome: 'Direito Tributário', peso: 5, incidencia: 5, feitas: 100, acertos: 60, horas_ciclo: 12.5,
    assuntos: [{ id: 'a1', item_edital: '1', descricao: 'Lançamento | CTN', status: 'em_estudo', ultima_atividade: '2026-11-09', ultimo_ponto: 'art. 145', stats: { feitas: 10, acertos: 7 } }] }],
  revisoes: [{ assunto_id: 'a1', disciplina: 'Direito Tributário', assunto: 'Lançamento', data_estudo_original: '2026-11-09', etapa: 1, data_prevista: '2026-11-08' }], ultimoResultado: { a1: 90 },
  erros: [{ data: '2026-11-09', disciplina_id: 'd1', assunto_id: 'a1', motivo: 'letra_da_lei', descricao: 'art. 149\nCTN', revisado: false }, { data: '2026-01-01', disciplina_id: 'd1', assunto_id: 'a1', motivo: 'chute', descricao: 'velho', revisado: true }],
  sessoes: [{ data: '2026-11-09', origem: 'checkpoint', ia: 'chatgpt', tipo: 'aula', disciplina_id: 'd1', assunto_id: 'a1', status: 'REALIZADO', minutos: 50 }],
  proxima: '/aula DT > Suspensão', propostas: ['aumentar Português'] });
for (let i = 1; i <= 10; i++) assert(new RegExp('^## ' + i + '\\. ', 'm').test(md), 'seção ' + i);
assert(/\*\*Exportado em:\*\* 09\/11\/2026 21:05/.test(md));
assert(/\| Horas por dia \| 3 \|/.test(md) && !/## 1\. Perfil do candidato\n## 1/.test(md), 'perfil sem título duplicado');
assert(/Lançamento \\\| CTN/.test(md), 'barra escapada na tabela');
assert(/\| 10 \| 7 \| 70% \|/.test(md), 'progresso do assunto');
assert(/08\/11\/2026 \(atrasada\) \| 90% \|/.test(md), 'revisão atrasada e último resultado');
assert(/art\. 149 CTN/.test(md) && !/velho/.test(md), 'erros: abertos e recentes, sem quebra de linha');
assert(/CHECKPOINT \(ChatGPT\)/.test(md));
assert(/- \[ \] \/aula DT > Suspensão/.test(md) && /- aumentar Português/.test(md));
assert(/\| v2 \| Planejamento: 25,0 h\/semana, 250 questões\/semana — férias \(vigente\) \| Sim \|/.test(md));
assert(/\| 12,5 h \|/.test(md), 'horas do ciclo aprovadas');
assert.strictEqual(E.validarBackup({ app: 'x' }), 'Arquivo inválido: não é um backup do Aprovação 360°.');
assert(E.validarBackup({ app: 'aprovacao360', versao_schema: 2, tabelas: {} }));
assert.strictEqual(E.validarBackup({ app: 'aprovacao360', versao_schema: 1, tabelas: {} }), null);
console.log('registro: todos os testes passaram');
