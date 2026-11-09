// =====================================================================
// Aprovação 360° — aplicação (etapa 1: login, navegação e base)
// =====================================================================
(function () {
  'use strict';

  var cfg = window.A360_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var sb = null;
  var estado = { usuario: null, config: null, concursos: [] };
  var falhasConexao = 0;

  // ---------- utilitários ----------
  // RN26: "hoje" sempre na data local de São Paulo, gravado em ISO
  function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function dataBR(iso) { if (!iso) return '—'; var p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  var avisoTimer = null;
  function aviso(texto) {
    var el = $('aviso'); el.textContent = texto; el.hidden = false;
    clearTimeout(avisoTimer); avisoTimer = setTimeout(function () { el.hidden = true; }, 4000);
  }

  // RN28: banner após 2 falhas seguidas de conexão
  function registrarResultado(erro) {
    if (erro && /fetch|network|Failed|timeout/i.test(String(erro.message || erro))) {
      falhasConexao++;
      if (falhasConexao >= 2) $('banner-conexao').hidden = false;
    } else {
      falhasConexao = 0; $('banner-conexao').hidden = true;
    }
  }

  function mostrar(tela) {
    ['tela-carregando', 'tela-config', 'tela-login', 'app'].forEach(function (id) { $(id).hidden = id !== tela; });
  }

  // ---------- inicialização ----------
  function configurado() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      cfg.SUPABASE_URL.indexOf('COLE_AQUI') < 0 && cfg.SUPABASE_ANON_KEY.indexOf('COLE_AQUI') < 0;
  }

  function iniciar() {
    if (!configurado()) { mostrar('tela-config'); return; }
    if (!window.supabase) {
      // RN28: biblioteca do Supabase não carregou (internet, bloqueador de anúncios ou rede da empresa)
      document.querySelector('#tela-config .cartao-login').innerHTML =
        '<h1>Aprovação 360°</h1><p><strong>Não consegui carregar a conexão com o banco.</strong></p>' +
        '<p class="suave">Verifique a internet. Se usa bloqueador de anúncios ou rede da empresa, libere o site <code>cdn.jsdelivr.net</code> e recarregue a página.</p>';
      mostrar('tela-config'); return;
    }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    $('form-login').addEventListener('submit', enviarLogin);
    $('btn-alternar').addEventListener('click', alternarModo);
    $('btn-esqueci').addEventListener('click', esqueciSenha);
    if (/type=recovery/.test(window.location.hash)) modoNovaSenha = true;
    $('btn-sair').addEventListener('click', sair);
    $('sel-concurso').addEventListener('change', trocarConcurso);
    window.addEventListener('hashchange', rotear);

    sb.auth.onAuthStateChange(function (evento, sessao) {
      if (evento === 'PASSWORD_RECOVERY') {
        modoNovaSenha = true; mostrar('tela-login');
        $('btn-entrar').textContent = 'Salvar nova senha'; $('login-email').closest('form').querySelector('label').hidden = true;
        $('login-email').hidden = true; $('btn-alternar').hidden = true; $('btn-esqueci').hidden = true;
        msgLogin('Digite a nova senha e clique em Salvar.', true);
        return;
      }
      if (sessao && sessao.user && !modoNovaSenha) { aoEntrar(sessao.user); }
      else { estado.usuario = null; mostrar('tela-login'); }
    });
    sb.auth.getSession().then(function (r) {
      registrarResultado(r.error);
      if (!r.data || !r.data.session) mostrar('tela-login');
    });
  }

  // ---------- entrar com e-mail e senha ----------
  var modoCriar = false, modoNovaSenha = false;

  function msgLogin(texto, ok) {
    var el = $('login-msg'); el.textContent = texto; el.hidden = !texto;
    el.className = ok ? 'ok' : 'erro';
  }

  function alternarModo() {
    modoCriar = !modoCriar;
    $('btn-entrar').textContent = modoCriar ? 'Criar minha conta' : 'Entrar';
    $('btn-alternar').textContent = modoCriar ? 'Já tenho conta. Entrar' : 'Primeiro acesso? Criar minha conta';
    $('login-senha').setAttribute('autocomplete', modoCriar ? 'new-password' : 'current-password');
    msgLogin(modoCriar ? 'Use uma senha com pelo menos 8 caracteres.' : '', true);
  }

  function traduzErro(e) {
    var m = String((e && e.message) || e || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos (veja também o spam).';
    if (/already registered|already exists/i.test(m)) return 'Este e-mail já tem conta. Clique em "Já tenho conta. Entrar".';
    if (/Signups not allowed|signup.*disabled/i.test(m)) return 'Novos cadastros estão desativados neste site.';
    if (/Password should be|at least/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (/fetch|network|Failed/i.test(m)) return 'Sem conexão com o banco. Verifique a internet.';
    return 'Não foi possível concluir: ' + m;
  }

  function enviarLogin(ev) {
    ev.preventDefault();
    var email = $('login-email').value.trim(), senha = $('login-senha').value;
    if (modoNovaSenha) {
      if (senha.length < 8) { msgLogin('A senha precisa ter pelo menos 8 caracteres.'); return; }
      sb.auth.updateUser({ password: senha }).then(function (r) {
        if (r.error) { msgLogin(traduzErro(r.error)); return; }
        modoNovaSenha = false; history.replaceState(null, '', window.location.pathname);
        msgLogin('Senha alterada.', true);
        if (r.data && r.data.user) aoEntrar(r.data.user);
      });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msgLogin('Informe um e-mail válido.'); return; }
    if (senha.length < 8) { msgLogin('A senha precisa ter pelo menos 8 caracteres.'); return; }
    $('btn-entrar').disabled = true;
    var acao = modoCriar
      ? sb.auth.signUp({ email: email, password: senha, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
      : sb.auth.signInWithPassword({ email: email, password: senha });
    acao.then(function (r) {
      $('btn-entrar').disabled = false;
      registrarResultado(r.error);
      if (r.error) { msgLogin(traduzErro(r.error)); return; }
      if (modoCriar && !r.data.session) { msgLogin('Conta criada! Abra o e-mail de confirmação que enviamos e clique no link (veja também o spam).', true); }
    });
  }

  function esqueciSenha() {
    var email = $('login-email').value.trim();
    if (!email) { msgLogin('Digite seu e-mail no campo acima e clique de novo em "Esqueci a senha".'); return; }
    sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }).then(function (r) {
      if (r.error) { msgLogin(traduzErro(r.error)); return; }
      msgLogin('Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.', true);
    });
  }

  function sair() {
    sb.auth.signOut().then(function () { window.location.hash = ''; mostrar('tela-login'); });
  }

  // ---------- após o login ----------
  function aoEntrar(user) {
    if (estado.usuario && estado.usuario.id === user.id) return;
    estado.usuario = user;
    var meta = user.user_metadata || {};
    $('usuario-nome').textContent = meta.full_name || meta.name || user.email || '';
    if (meta.avatar_url) { $('usuario-foto').src = meta.avatar_url; $('usuario-foto').hidden = false; }
    mostrar('app');
    carregarBase().then(rotear);
  }

  // Garante a linha de configurações e carrega os concursos
  function carregarBase() {
    return sb.from('a360_configuracoes').select('*').maybeSingle().then(function (r) {
      registrarResultado(r.error);
      if (r.error) { aviso('Erro ao carregar configurações: ' + r.error.message); return null; }
      if (r.data) return r.data;
      return sb.from('a360_configuracoes').insert({}).select().single().then(function (r2) {
        if (r2.error) { aviso('Erro ao criar configurações: ' + r2.error.message); return null; }
        return r2.data;
      });
    }).then(function (config) {
      estado.config = config;
      return sb.from('a360_concursos').select('id,codigo,cargo,orgao,data_prova,prioritario').is('excluido_em', null).order('codigo');
    }).then(function (r) {
      registrarResultado(r.error);
      estado.concursos = (r && r.data) || [];
      montarSeletor();
    });
  }

  function montarSeletor() {
    var sel = $('sel-concurso');
    sel.innerHTML = '';
    if (!estado.concursos.length) {
      var o = document.createElement('option'); o.textContent = 'Nenhum concurso ainda'; o.value = ''; sel.appendChild(o); sel.disabled = true; return;
    }
    sel.disabled = false;
    estado.concursos.forEach(function (c) {
      var o = document.createElement('option'); o.value = c.id; o.textContent = c.codigo + ' · ' + c.cargo; sel.appendChild(o);
    });
    var ativo = estado.config && estado.config.concurso_ativo_id;
    if (!ativo || !estado.concursos.some(function (c) { return c.id === ativo; })) {
      var prio = estado.concursos.filter(function (c) { return c.prioritario; })[0];
      ativo = (prio || estado.concursos[0]).id;
    }
    sel.value = ativo;
  }

  function trocarConcurso() {
    var id = $('sel-concurso').value || null;
    sb.from('a360_configuracoes').update({ concurso_ativo_id: id }).eq('usuario_id', estado.usuario.id).then(function (r) {
      registrarResultado(r.error);
      if (r.error) { aviso('Não consegui trocar o concurso: ' + r.error.message); return; }
      if (estado.config) estado.config.concurso_ativo_id = id;
      rotear();
    });
  }

  // ---------- navegação ----------
  var TITULOS = {
    hoje: 'Hoje', importar: 'Importar', edital: 'Edital verticalizado', revisoes: 'Revisões', erros: 'Caderno de erros',
    ciclo: 'Ciclo de estudos', simulados: 'Simulados', biblioteca: 'Biblioteca', concursos: 'Concursos', configuracoes: 'Configurações e backup'
  };

  function rotear() {
    if (!estado.usuario) return;
    var tela = (window.location.hash.replace(/^#\/?/, '') || 'hoje').split('/')[0];
    if (!TITULOS[tela]) tela = 'hoje';
    document.querySelectorAll('.menu a').forEach(function (a) {
      var on = a.getAttribute('data-tela') === tela;
      a.classList.toggle('ativo', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var main = $('conteudo');
    main.innerHTML = '';
    var h1 = document.createElement('h1'); h1.textContent = TITULOS[tela];
    main.appendChild(h1);
    var cartao = document.createElement('div'); cartao.className = 'cartao vazio';
    if (tela === 'hoje' && !estado.concursos.length) {
      cartao.innerHTML = '<p><strong>Tudo pronto para começar.</strong></p><p>Login e banco de dados funcionando. Hoje é ' + dataBR(hojeISO()) + '.</p><p>As próximas etapas vão trazer a importação do EDITAL e do CHECKPOINT.</p>';
    } else {
      cartao.innerHTML = '<p>Esta tela chega nas próximas etapas da construção.</p>';
    }
    main.appendChild(cartao);
    main.focus();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
