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

    $('btn-google').addEventListener('click', entrarComGoogle);
    $('btn-sair').addEventListener('click', sair);
    $('sel-concurso').addEventListener('change', trocarConcurso);
    window.addEventListener('hashchange', rotear);

    sb.auth.onAuthStateChange(function (evento, sessao) {
      if (sessao && sessao.user) { aoEntrar(sessao.user); }
      else { estado.usuario = null; mostrar('tela-login'); }
    });
    sb.auth.getSession().then(function (r) {
      registrarResultado(r.error);
      if (!r.data || !r.data.session) mostrar('tela-login');
    });
  }

  function entrarComGoogle() {
    $('login-erro').hidden = true;
    var volta = window.location.origin + window.location.pathname;
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta } }).then(function (r) {
      if (r.error) { $('login-erro').hidden = false; registrarResultado(r.error); }
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
