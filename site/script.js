// FiveM PvP Trainer — public landing page logic.
// No build step, no framework — plain JS kept intentionally small.
(function () {
  'use strict';

  var LANG_KEY = 'pvp_language';
  var SUPPORTED = ['pt', 'en'];

  var STRINGS = {
    pt: {
      meta: {
        title: 'FiveM PvP Trainer — Treine seu PvP no FiveM como um profissional',
        description: 'Treine mira, reflexo e movimento pro PvP do FiveM com um aim trainer 3D, rotinas adaptativas e sensibilidade real do GTA V. Grátis.',
      },
      og: {
        title: 'FiveM PvP Trainer — Treine seu PvP no FiveM como um profissional',
        description: 'Aim trainer 3D com sensibilidade real do GTA V, rotinas adaptativas e dashboard de evolução. Grátis para Windows.',
      },
      nav: { features: 'Recursos', how: 'Como funciona', faq: 'FAQ' },
      hero: {
        eyebrow: 'Ferramenta gratuita de treino',
        title: 'Treine seu PvP no FiveM como um profissional',
        subtitle: 'Aim trainer 3D com a sua sensibilidade real do GTA V, rotinas diárias adaptativas e cotas de mata-mata que evoluem com você.',
        download: 'Baixar para Windows',
        free: '100% grátis',
        note: 'Windows 10/11 · instalador .exe · não precisa de conta Steam',
      },
      shots: {
        routineLabel: 'Print: rotina diária',
        routineCaption: 'Rotina gerada pro seu perfil, com bloco de mata-mata',
        trainerLabel: 'Print: aim trainer 3D',
        trainerCaption: 'Treino de mira dentro do app, sensibilidade real do GTA V',
        dashboardLabel: 'Print: dashboard de evolução',
        dashboardCaption: 'Streak, conquistas e histórico de sessões',
      },
      features: {
        title: 'Tudo que você precisa pra evoluir',
        aim: { title: 'Aim trainer 3D', desc: 'Treino de tracking dentro do próprio app, usando a sua sensibilidade real do GTA V — mesma resposta de mouse, contagem por contagem.' },
        routine: { title: 'Rotina personalizada', desc: 'Um questionário rápido define sua rotina diária — aquecimento, treino principal e aplicação em jogo, ajustados ao seu nível e tempo disponível.' },
        quotas: { title: 'Cotas de mata-mata adaptativas', desc: 'A dificuldade das suas partidas sobe ou desce sozinha, dia após dia, de acordo com seu desempenho real.' },
        dashboard: { title: 'Dashboard de evolução', desc: 'Streak, sessões completas, conquistas e histórico — acompanhe sua evolução semana a semana.' },
        converter: { title: 'Minha Sensibilidade', desc: "Configure sua sensibilidade do GTA V uma vez — o app calcula o cm/360 e usa exatamente essa mesma resposta de mouse no treino 3D interno." },
        free: { title: '100% grátis', desc: 'Sem assinatura, sem anúncio, sem pegadinha. Baixe e use.' },
      },
      how: {
        title: 'Como funciona',
        step1: { title: 'Baixe e instale', desc: 'Instalador simples pra Windows, pronto em menos de um minuto.' },
        step2: { title: 'Responda o questionário', desc: 'Conte seu nível, tempo disponível e maiores dificuldades — a rotina se adapta a você.' },
        step3: { title: 'Treine e evolua', desc: 'Siga a rotina diária, acompanhe seu progresso e veja a dificuldade subir junto com você.' },
      },
      faq: {
        title: 'Perguntas frequentes',
        q1: 'É grátis mesmo?',
        a1: 'Sim, 100% grátis — sem assinatura, sem versão paga, sem anúncio.',
        q2: 'Funciona com qualquer servidor de FiveM?',
        a2: 'O treino de mira, reflexo e movimento funciona pra qualquer servidor. O bloco de mata-mata adaptativo (cotas de partida) foi calibrado pensando no servidor GOAT, mas você pode jogar em qualquer lugar — só a sugestão de cota pode não fazer tanto sentido fora dele.',
        q3: 'Preciso de conta?',
        a3: 'Sim, uma conta simples (usuário e senha, cadastro rápido) — é o que permite salvar sua rotina, seu progresso e seu histórico entre sessões.',
        q4: 'Como a sensibilidade funciona?',
        a4: "Você informa a sensibilidade que já usa no GTA V e o DPI do seu mouse — o app converte matematicamente pra a mesma resposta de mouse (graus por contagem) e usa esse valor direto no treino 3D interno, sem precisar de nenhuma ferramenta externa.",
        q5: 'É seguro? Corre risco de ban / anticheat?',
        a5: 'É uma ferramenta 100% externa: roda numa janela separada, fora do FiveM. O app não injeta nada no jogo, não lê nem modifica a memória do GTA V/FiveM e não interage com o processo do jogo de forma alguma — é só um treino de mira, sensibilidade e organização de rotina.',
      },
      ctaFinal: { title: 'Pronto pra subir de nível?' },
      footer: {
        releases: 'Releases',
        partners: 'Comunidades parceiras de treino: servidores GOAT e PLF.',
      },
    },
    en: {
      meta: {
        title: 'FiveM PvP Trainer — Train your FiveM PvP aim like a pro',
        description: 'Train your aim, reflexes, and movement for FiveM PvP with a 3D aim trainer, adaptive routines, and your real GTA V sensitivity. Free.',
      },
      og: {
        title: 'FiveM PvP Trainer — Train your FiveM PvP aim like a pro',
        description: '3D aim trainer with your real GTA V sensitivity, adaptive routines, and a progress dashboard. Free for Windows.',
      },
      nav: { features: 'Features', how: 'How it works', faq: 'FAQ' },
      hero: {
        eyebrow: 'Free training tool',
        title: 'Train your FiveM PvP aim like a pro',
        subtitle: 'A 3D aim trainer using your real GTA V sensitivity, daily adaptive routines, and deathmatch quotas that grow with you.',
        download: 'Download for Windows',
        free: '100% free',
        note: 'Windows 10/11 · .exe installer · no Steam account needed',
      },
      shots: {
        routineLabel: 'Screenshot: daily routine',
        routineCaption: 'A routine generated for your profile, with a deathmatch block',
        trainerLabel: 'Screenshot: 3D aim trainer',
        trainerCaption: 'Aim training inside the app, with your real GTA V sensitivity',
        dashboardLabel: 'Screenshot: progress dashboard',
        dashboardCaption: 'Streak, achievements, and session history',
      },
      features: {
        title: 'Everything you need to improve',
        aim: { title: '3D aim trainer', desc: 'Tracking practice built into the app, using your real GTA V sensitivity — the exact same mouse response, count for count.' },
        routine: { title: 'Personalized routine', desc: 'A quick questionnaire builds your daily routine — warmup, main training, and in-game application, adjusted to your level and available time.' },
        quotas: { title: 'Adaptive deathmatch quotas', desc: "Your match difficulty rises or eases on its own, day by day, based on how you're actually performing." },
        dashboard: { title: 'Progress dashboard', desc: 'Streak, completed sessions, achievements, and history — track your progress week by week.' },
        converter: { title: 'My Sensitivity', desc: "Set up your GTA V sensitivity once — the app calculates cm/360 and uses that exact same mouse response in the built-in 3D trainer." },
        free: { title: '100% free', desc: 'No subscription, no ads, no catch. Download and go.' },
      },
      how: {
        title: 'How it works',
        step1: { title: 'Download and install', desc: 'A simple Windows installer, ready in under a minute.' },
        step2: { title: 'Answer the questionnaire', desc: 'Tell it your level, available time, and biggest struggles — the routine adapts to you.' },
        step3: { title: 'Train and improve', desc: 'Follow the daily routine, track your progress, and watch the difficulty climb along with you.' },
      },
      faq: {
        title: 'Frequently asked questions',
        q1: 'Is it really free?',
        a1: 'Yes, 100% free — no subscription, no paid tier, no ads.',
        q2: 'Does it work with any FiveM server?',
        a2: "Aim, reflex, and movement training works for any server. The adaptive deathmatch block (match quotas) was calibrated with the GOAT server in mind, but you can play anywhere — the quota suggestion just may make less sense elsewhere.",
        q3: 'Do I need an account?',
        a3: 'Yes, a simple account (username and password, quick signup) — it’s what lets the app save your routine, progress, and history across sessions.',
        q4: 'How does the sensitivity work?',
        a4: "You enter the sensitivity you already use in GTA V and your mouse DPI — the app mathematically converts it to the same mouse response (degrees per count) and uses that value directly in the built-in 3D trainer, no external tool required.",
        q5: 'Is it safe? Any ban / anti-cheat risk?',
        a5: "It's a fully external tool: it runs in a separate window, outside of FiveM. The app doesn't inject anything into the game, doesn't read or modify GTA V/FiveM's memory, and doesn't interact with the game process in any way — it's just aim practice, sensitivity conversion, and routine tracking.",
      },
      ctaFinal: { title: 'Ready to level up?' },
      footer: {
        releases: 'Releases',
        partners: 'Partner training communities: the GOAT and PLF servers.',
      },
    },
  };

  function t(key, lang) {
    var parts = key.split('.');
    var node = STRINGS[lang];
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return null;
      node = node[parts[i]];
    }
    return typeof node === 'string' ? node : null;
  }

  function detectLang() {
    var stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { /* storage unavailable */ }
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var nav = (navigator.language || '').toLowerCase();
    return nav.indexOf('pt') === 0 ? 'pt' : 'en';
  }

  function applyLang(lang) {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';

    var textNodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < textNodes.length; i++) {
      var el = textNodes[i];
      var val = t(el.getAttribute('data-i18n'), lang);
      if (val != null) el.textContent = val;
    }

    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var elA = attrNodes[j];
      var valA = t(elA.getAttribute('data-i18n-attr'), lang);
      if (valA != null) elA.setAttribute('content', valA);
    }

    var toggleLabel = document.getElementById('lang-toggle-label');
    if (toggleLabel) toggleLabel.textContent = lang === 'pt' ? 'EN' : 'PT';
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* storage unavailable */ }
    applyLang(lang);
  }

  // ── Download button: always points at the latest GitHub release ──────────
  var GITHUB_API = 'https://api.github.com/repos/KSKluc4/fivem-pvp-trainer/releases/latest';

  function setupDownload() {
    var buttons = [document.getElementById('download-btn'), document.getElementById('download-btn-2')].filter(Boolean);
    var heroVersion = document.getElementById('hero-version');
    var footerVersion = document.getElementById('footer-version');

    fetch(GITHUB_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('GitHub API returned ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var assets = data.assets || [];
        var exe = null;
        for (var i = 0; i < assets.length; i++) {
          if (/\.exe$/i.test(assets[i].name)) { exe = assets[i]; break; }
        }
        var version = (data.tag_name || data.name || '').replace(/^v/i, '');

        if (exe) {
          buttons.forEach(function (b) { b.href = exe.browser_download_url; });
        }
        if (version) {
          if (heroVersion) heroVersion.textContent = 'v' + version;
          if (footerVersion) footerVersion.textContent = version;
        }
      })
      .catch(function (err) {
        // Anchors already default to the releases page in the HTML — nothing to fix.
        console.warn('[download] Falling back to the releases page:', err && err.message);
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyLang(detectLang());
    setupDownload();

    var toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var current = document.documentElement.lang === 'pt-BR' ? 'pt' : 'en';
        setLang(current === 'pt' ? 'en' : 'pt');
      });
    }
  });
})();
