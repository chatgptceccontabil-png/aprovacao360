// Testes do leitor de CHECKPOINT (RN20–RN22, RN32). Rodar: node testes/checkpoint.test.js
const assert = require('assert');
const P = require('../js/parsers.js');
const CP = `Fim da sessão. Segue o checkpoint:
=== CHECKPOINT ===
data: 2026-11-09
concurso: ISS-SP-AFTM-2026
conversa: Aula
ia: ChatGPT
SESSAO | Direito Tributário | Lançamento tributário | aula | REALIZADO | 50
SESSAO | Direito Tributário | Geral | leitura | REALIZADO | 20
**QUESTOES | Direito Tributário | Lancamento tributario | 10 | 7**
QUESTOES | Direito Tributário | Lançamento tributário | 10 | 12
- ERRO | Direito Tributário | Lançamento tributário | letra da lei | Revisão de ofício: art. 149 | CTN
ERRO | Direito Tributário | Lançamento por homologação | pegadinha | Quem antecipa é o sujeito passivo
ERRO | Direito Tributário | Lançamento tributário | sorte | x
REVISAO | Direito Tributário | Competência tributária | 90%
ULTIMO_PONTO | Direito Tributário | Lançamento tributário | Parei no art. 145
PROXIMA | /aula Direito Tributário > Suspensão | com lei seca
QUESTOES | Contabilidade | Balanço | 5 | 3
SESSAO | Direito Tributario | Lançamento tributário | aula | FEITO | 10
=== FIM ===`;
const discs = [{ id: 'd1', nome: 'Direito Tributário', assuntos: [{ id: 'a1', descricao: 'Lançamento tributário' }, { id: 'a2', descricao: 'Competência tributária' }, { id: 'a3', descricao: 'Lançamento por ofício' }] }];
const r = P.lerCheckpoint(CP, '2026-11-10');
assert(!r.erro, r.erro);
assert.strictEqual(r.cab.data, '2026-11-09');
assert.strictEqual(r.cab.ia, 'chatgpt');
assert.strictEqual(r.linhas.length, 12);
const L = n => r.linhas[n - 1];
assert.strictEqual(L(2).assunto, null, 'Geral = disciplina inteira');
assert.strictEqual(L(4).status, 'erro'); assert(/Acertos maior/.test(L(4).msg));
assert.strictEqual(L(5).valor.motivo, 'letra_da_lei');
assert.strictEqual(L(5).valor.descricao, 'Revisão de ofício: art. 149 | CTN', 'barra na descrição preservada');
assert.strictEqual(L(7).status, 'erro'); assert(/Motivo/.test(L(7).msg));
assert.strictEqual(L(8).valor.resultado, 90);
assert.strictEqual(L(10).valor.texto, '/aula Direito Tributário > Suspensão | com lei seca');
assert.strictEqual(L(12).status, 'erro'); assert(/Status/.test(L(12).msg));
P.resolverCheckpoint(r, discs);
assert.strictEqual(L(3).assuntoRef.id, 'a1', 'sem acento casa');
assert.strictEqual(L(6).precisaDecidir, true);
assert.strictEqual(L(6).sugestao, null, 'homologação ≠ ofício: não sugere associação errada');
assert.strictEqual(L(11).status, 'erro'); assert(/não existe/.test(L(11).msg));
// decisões
let p = P.payloadCheckpoint(r, {}, { concurso_id: 'c1', hash: 'h' });
assert.strictEqual(p.resumo.ignoradas, 1, 'sem decisão = ignorada');
assert.strictEqual(p.ia, 'chatgpt');
p = P.payloadCheckpoint(r, { 6: 'novo' }, { concurso_id: 'c1', hash: 'h' });
assert.strictEqual(p.novos_assuntos.length, 1);
assert.strictEqual(p.erros[1].assunto_chave, 'd1|lancamento por homologacao');
assert.strictEqual(p.sessoes.length, 2); assert.strictEqual(p.sessoes[1].assunto_id, undefined);
assert.strictEqual(p.questoes.length, 1); assert.strictEqual(p.revisoes[0].assunto_id, 'a2');
assert.strictEqual(p.resumo.invalidas, 4);
const r3 = P.resolverCheckpoint(P.lerCheckpoint('=== CHECKPOINT ===\nQUESTOES | Direito Tributário | Competência tributária (CF) | 4 | 3\n=== FIM ===', '2026-11-10'), discs);
assert.strictEqual(r3.linhas[0].sugestao.id, 'a2', 'sugere o parecido');
p = P.payloadCheckpoint(r3, { 1: 'assoc' }, {});
assert.strictEqual(p.questoes[0].assunto_id, 'a2');
// sem data / ia ausente
const r2 = P.lerCheckpoint('=== CHECKPOINT ===\nconcurso: X\nPROXIMA | revisar\n=== FIM ===', '2026-11-10');
assert.strictEqual(r2.cab.data, '2026-11-10'); assert.strictEqual(r2.cab.ia, null);
assert.strictEqual(P.payloadCheckpoint(r2, {}, { ia_padrao: 'claude' }).ia, 'claude');
assert(P.lerCheckpoint('nada').erro);
assert.strictEqual(P.normalizarIA('GPT-5'), 'chatgpt'); assert.strictEqual(P.normalizarIA('Claude'), 'claude');
// hash estável com espaços diferentes
assert.strictEqual(P.textoParaHash('a  b\n\n c '), P.textoParaHash('a b\nc'));
console.log('checkpoint: todos os testes passaram');
