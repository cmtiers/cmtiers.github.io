// ---- settings -------------------------------------------------------------
var DATA_URL = "data.json";   
var ROOT = "";                
var REFRESH_SECONDS = 300;    

var TIERS = [
  { label: "S+", keys: ["s+"],            bg: "#a3141b", fg: "#ffffff" },
  { label: "S",  keys: ["s"],             bg: "#ef5350", fg: "#14171c" },
  { label: "A+", keys: ["a+"],            bg: "#f5a623", fg: "#14171c" },
  { label: "A",  keys: ["a"],             bg: "#f2d94e", fg: "#14171c" },
  { label: "B+", keys: ["b+"],            bg: "#1fa7a0", fg: "#07211f" },
  { label: "B",  keys: ["b"],             bg: "#5fd8e6", fg: "#07211f" },
  { label: "C+", keys: ["c+"],            bg: "#2f9e5b", fg: "#07210f" },
  { label: "C",  keys: ["c tier", "c"],   bg: "#8fdc6e", fg: "#102507" }
];
var OTHER = { bg: "#6b7280", fg: "#ffffff" };

var players = [];
var loaded = false;
var failure = "";
var out = document.getElementById("out");
var q = document.getElementById("q");

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function toPlayers(d) {
  var list = [];
  if (Array.isArray(d)) {
    list = d;
  } else if (d && typeof d === "object") {
    if (Array.isArray(d.players)) {
      list = d.players;
    } else {
      list = Object.keys(d).map(function (k) { return Object.assign({ name: k }, d[k]); });
    }
  }

  return list.map(function (p) {
    return {
      name: String(p && p.name || "").trim(),
      tier: String(p && p.tier || "").trim(),
      elo: Number(p && p.elo) || 0,
      wins: Number(p && p.wins) || 0,
      losses: Number(p && p.losses) || 0,
      streak: Number(p && p.streak) || 0,
      region: String(p && p.region || "EU"),
      device: String(p && p.device || "PC"),
      role: String(p && p.role || ""),
      head: String(p && p.head || "https://mc-heads.net/avatar/" + (p && p.name ? p.name : "MHF_Steve") + "/28")
    };
  }).filter(function (p) { return p.name !== ""; });
}

function tierIndex(tier) {
  var n = tier.toLowerCase();
  for (var i = 0; i < TIERS.length; i++) {
    if (TIERS[i].keys.indexOf(n) !== -1) return i;
  }
  return -1;
}

function render() {
  if (!out) return;
  out.textContent = "";
  
  var rankedCountEl = document.getElementById("rankedCountDisplay");
  var topEloEl = document.getElementById("topEloDisplay");
  var offlineBanner = document.getElementById("mainOfflineBanner");
  var topOfflineBadge = document.getElementById("topOfflineBadge");

  if (rankedCountEl) rankedCountEl.textContent = players.length;

  var maxElo = players.length > 0 ? Math.max.apply(null, players.map(function(p){ return p.elo; })) : 0;
  if (topEloEl) topEloEl.textContent = maxElo;

  if (loaded && players.length > 0) {
    if (offlineBanner) offlineBanner.style.display = "none";
    if (topOfflineBadge) {
      topOfflineBadge.textContent = "🟢 ONLINE";
      topOfflineBadge.style.background = "rgba(52, 211, 153, 0.15)";
      topOfflineBadge.style.borderColor = "rgba(52, 211, 153, 0.4)";
      topOfflineBadge.style.color = "#34d399";
    }
  }

  if (failure || players.length === 0) {
    out.appendChild(el("div", "note", "Server is offline or data.json is empty. Standings will appear once players are synced from the server."));
    return;
  }

  var term = q && q.value ? q.value.trim().toLowerCase() : "";
  var bands = {};
  players.forEach(function (p) {
    if (term && p.name.toLowerCase().indexOf(term) === -1 && p.tier.toLowerCase().indexOf(term) === -1) return;
    var i = tierIndex(p.tier);
    var key = i >= 0 ? "t" + i : "o:" + p.tier.toLowerCase();
    if (!bands[key]) {
      bands[key] = i >= 0
        ? { order: i, label: TIERS[i].label, bg: TIERS[i].bg, fg: TIERS[i].fg, list: [] }
        : { order: 100, label: p.tier || "Unlisted", bg: OTHER.bg, fg: OTHER.fg, list: [] };
    }
    bands[key].list.push(p);
  });

  var rows = Object.keys(bands).map(function (k) { return bands[k]; })
    .sort(function (a, b) { return a.order - b.order || a.label.localeCompare(b.label); });

  rows.forEach(function (b) {
    b.list.sort(function (x, y) { return y.elo - x.elo || x.name.localeCompare(y.name); });
    var band = el("section", "band");
    var badge = el("div", "badge");
    badge.style.background = b.bg;
    badge.style.color = b.fg;
    badge.appendChild(el("b", "", b.label));
    badge.appendChild(el("span", "", b.list.length + (b.list.length === 1 ? " player" : " players")));
    var box = el("div", "players");
    
    b.list.forEach(function (p) {
      var chip = el("span", "chip");
      chip.addEventListener("click", function(e) {
        openPlayerModal(p.name);
        triggerCardBlast(e);
      });

      var headImg = el("img");
      headImg.src = p.head;
      headImg.alt = p.name;
      chip.appendChild(headImg);
      
      var strong = el("strong", "", p.name);
      chip.appendChild(strong);

      if (p.role === "ADMIN") {
        chip.appendChild(el("span", "badge-admin", "ADMIN"));
      } else if (p.role === "MOD") {
        chip.appendChild(el("span", "badge-mod", "MOD"));
      }

      chip.appendChild(el("small", "", p.elo + " ELO"));
      box.appendChild(chip);
    });

    band.appendChild(badge);
    band.appendChild(box);
    out.appendChild(band);
  });

  initComparisonSelects();
}

function load() {
  fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (d) {
      players = toPlayers(d);
      loaded = true;
      failure = "";
      render();
    })
    .catch(function () {
      players = [];
      loaded = true;
      failure = "offline";
      render();
    });
}

function openPlayerModal(playerName) {
  var player = players.find(function(p) { return p.name === playerName; });
  if (!player) return;

  var totalMatches = player.wins + player.losses;
  var wr = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) + "%" : "0%";

  var headEl = document.getElementById('modalPlayerHead');
  if (headEl) headEl.src = player.head;
  
  var nameEl = document.getElementById('modalPlayerName');
  if (nameEl) nameEl.innerText = player.name;
  
  var roleBadge = '';
  if (player.role === 'ADMIN') roleBadge = '<span class="badge-admin">ADMIN</span>';
  if (player.role === 'MOD') roleBadge = '<span class="badge-mod">MOD</span>';
  
  var badgesEl = document.getElementById('modalPlayerBadges');
  if (badgesEl) badgesEl.innerHTML = roleBadge;

  var tierEl = document.getElementById('modalPlayerTier');
  if (tierEl) tierEl.innerText = player.tier;

  var eloEl = document.getElementById('modalPlayerElo');
  if (eloEl) eloEl.innerText = player.elo + " ELO";

  var wrEl = document.getElementById('modalPlayerWinrate');
  if (wrEl) wrEl.innerText = wr;

  var recordEl = document.getElementById('modalPlayerRecord');
  if (recordEl) recordEl.innerText = player.wins + "W / " + player.losses + "L";

  var streakEl = document.getElementById('modalPlayerStreak');
  if (streakEl) streakEl.innerText = "🔥 " + player.streak;

  var metaEl = document.getElementById('modalPlayerMeta');
  if (metaEl) metaEl.innerText = player.region + " • " + player.device;

  openModal('playerStatsModal');
}

function initComparisonSelects() {
  var p1 = document.getElementById('p1Select');
  var p2 = document.getElementById('p2Select');
  if (!p1 || !p2 || players.length === 0) return;

  var options = players.map(function(p) { return '<option value="' + p.name + '">' + p.name + ' (' + p.tier + ')</option>'; }).join('');
  p1.innerHTML = options;
  p2.innerHTML = options;

  if (players.length > 1) {
    p2.selectedIndex = 1;
  }
  updateComparison();
}

function updateComparison() {
  var p1El = document.getElementById('p1Select');
  var p2El = document.getElementById('p2Select');
  if (!p1El || !p2El) return;

  var p1Name = p1El.value;
  var p2Name = p2El.value;

  var p1 = players.find(function(p) { return p.name === p1Name; });
  var p2 = players.find(function(p) { return p.name === p2Name; });
  var board = document.getElementById('compareBoard');

  if (!p1 || !p2 || !board) return;

  var wr1 = (p1.wins + p1.losses) > 0 ? Math.round((p1.wins / (p1.wins + p1.losses)) * 100) : 0;
  var wr2 = (p2.wins + p2.losses) > 0 ? Math.round((p2.wins / (p2.wins + p2.losses)) * 100) : 0;

  board.innerHTML = `
    <div class="compare-row">
      <div class="compare-val ${wr1 > wr2 ? 'stat-win' : wr1 < wr2 ? 'stat-loss' : ''}">${wr1}%</div>
      <div class="compare-metric">Win Rate</div>
      <div class="compare-val ${wr2 > wr1 ? 'stat-win' : wr2 < wr1 ? 'stat-loss' : ''}">${wr2}%</div>
    </div>
    <div class="compare-row">
      <div class="compare-val ${p1.elo > p2.elo ? 'stat-win' : p1.elo < p2.elo ? 'stat-loss' : ''}">${p1.elo}</div>
      <div class="compare-metric">ELO Points</div>
      <div class="compare-val ${p2.elo > p1.elo ? 'stat-win' : p2.elo < p1.elo ? 'stat-loss' : ''}">${p2.elo}</div>
    </div>
    <div class="compare-row">
      <div class="compare-val ${p1.streak > p2.streak ? 'stat-win' : p1.streak < p2.streak ? 'stat-loss' : ''}">🔥 ${p1.streak}</div>
      <div class="compare-metric">Win Streak</div>
      <div class="compare-val ${p2.streak > p1.streak ? 'stat-win' : p2.streak < p1.streak ? 'stat-loss' : ''}">🔥 ${p2.streak}</div>
    </div>
    <div class="compare-row">
      <div class="compare-val">${p1.tier}</div>
      <div class="compare-metric">Tier</div>
      <div class="compare-val">${p2.tier}</div>
    </div>
    <div class="compare-row">
      <div class="compare-val">${p1.device}</div>
      <div class="compare-metric">Platform</div>
      <div class="compare-val">${p2.device}</div>
    </div>
  `;
}

function triggerCardBlast(e) {
  var rect = e.currentTarget.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;

  for (var i = 0; i < 10; i++) {
    var particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.width = '5px';
    particle.style.height = '5px';
    particle.style.background = 'var(--accent-cyan)';
    particle.style.borderRadius = '50%';
    particle.style.pointerEvents = 'none';
    particle.style.boxShadow = '0 0 8px var(--accent-cyan)';
    particle.style.zIndex = '10';

    var angle = Math.random() * Math.PI * 2;
    var speed = Math.random() * 3 + 1;
    var vx = Math.cos(angle) * speed;
    var vy = Math.sin(angle) * speed;

    e.currentTarget.appendChild(particle);

    (function(p, vxVal, vyVal) {
      var life = 1;
      var anim = setInterval(function() {
        life -= 0.08;
        p.style.transform = 'translate(' + (vxVal * (1 - life) * 15) + 'px, ' + (vyVal * (1 - life) * 15) + 'px) scale(' + life + ')';
        p.style.opacity = life;

        if (life <= 0) {
          clearInterval(anim);
          p.remove();
        }
      }, 20);
    })(particle, vx, vy);
  }
}

// HAMBURGER DRAWER CONTROLS
var drawer = document.getElementById('drawer');
var drawerOverlay = document.getElementById('drawerOverlay');

function openDrawer() { 
  if (drawer && drawerOverlay) {
    drawer.classList.add('active'); 
    drawerOverlay.classList.add('active'); 
    triggerCornerSmoke(); 
  }
}

function closeDrawer() { 
  if (drawer && drawerOverlay) {
    drawer.classList.remove('active'); 
    drawerOverlay.classList.remove('active'); 
  }
}

function scrollToLeaderboard() { 
  closeDrawer(); 
  window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

var openMenuBtn = document.getElementById('openMenuBtn');
var closeMenuBtn = document.getElementById('closeMenuBtn');

if (openMenuBtn) openMenuBtn.addEventListener('click', openDrawer);
if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

function openModal(id) { 
  closeDrawer(); 
  var m = document.getElementById(id);
  if (m) {
    m.classList.add('active'); 
    triggerCornerSmoke(); 
  }
}

function closeModal(id) { 
  var m = document.getElementById(id);
  if (m) m.classList.remove('active'); 
}

// THEME TOGGLE
var themeBtn = document.getElementById('themeToggleBtn');
var isDark = localStorage.getItem('theme') !== 'light';

function applyTheme() {
  if (!isDark) {
    document.body.classList.add('light-theme');
    if (themeBtn) themeBtn.innerText = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    if (themeBtn) themeBtn.innerText = '🌙';
  }
}

if (themeBtn) {
  themeBtn.addEventListener('click', function() {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
  });
}
applyTheme();

// FULL BACKGROUND PARTICLE CANVAS
var canvas = document.getElementById('bg-canvas');
if (canvas) {
  var ctx = canvas.getContext('2d');
  var mouse = { x: null, y: null, radius: 120 };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('mousemove', function(e) {
    mouse.x = e.x;
    mouse.y = e.y;
  });
  resizeCanvas();

  var particles = Array.from({ length: 40 }, function() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      size: Math.random() * 2 + 0.5
    };
  });

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(0, 242, 254, 0.7)' : 'rgba(2, 132, 199, 0.7)';
      ctx.fill();

      for (var j = i + 1; j < particles.length; j++) {
        var p2 = particles[j];
        var dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isDark 
            ? 'rgba(0, 242, 254, ' + ((1 - dist / 110) * 0.35) + ')' 
            : 'rgba(2, 132, 199, ' + ((1 - dist / 110) * 0.35) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawBackground);
  }

  drawBackground();
}

function triggerCornerSmoke() {
  var smokeCanvas = document.getElementById('smoke-canvas');
  if (!smokeCanvas) return;
  var sCtx = smokeCanvas.getContext('2d');

  smokeCanvas.width = window.innerWidth;
  smokeCanvas.height = window.innerHeight;

  var smokeParticles = [];
  var corners = [
    { x: 0, y: 0, vxMin: 2, vxMax: 6, vyMin: 2, vyMax: 6 },
    { x: smokeCanvas.width, y: 0, vxMin: -6, vxMax: -2, vyMin: 2, vyMax: 6 }
  ];

  corners.forEach(function(c) {
    for (var i = 0; i < 50; i++) {
      smokeParticles.push({
        x: c.x,
        y: c.y,
        vx: (Math.random() * (c.vxMax - c.vxMin) + c.vxMin),
        vy: (Math.random() * (c.vyMax - c.vyMin) + c.vyMin),
        radius: Math.random() * 35 + 15,
        alpha: Math.random() * 0.5 + 0.2,
        grow: Math.random() * 0.6 + 0.3,
        color: isDark ? '220, 225, 230' : '80, 90, 100'
      });
    }
  });

  var startTime = Date.now();
  function animateSmoke() {
    var elapsed = Date.now() - startTime;
    sCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);

    smokeParticles.forEach(function(p) {
      p.x += p.vx;
      p.y += p.vy;
      p.radius += p.grow;
      p.alpha -= 0.008;

      if (p.alpha > 0) {
        sCtx.beginPath();
        var grad = sCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, 'rgba(' + p.color + ', ' + p.alpha + ')');
        grad.addColorStop(1, 'rgba(' + p.color + ', 0)');
        sCtx.fillStyle = grad;
        sCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        sCtx.fill();
      }
    });

    if (elapsed < 2000) {
      requestAnimationFrame(animateSmoke);
    } else {
      sCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);
    }
  }

  animateSmoke();
}

// MULTI-LANGUAGE TRANSLATION DICTIONARY
var TRANSLATIONS = {
  en: {
    title: "Ranked PvP tier list",
    search: "Search players",
    offline: "SERVER IS CURRENTLY OFFLINE",
    offlineSub: "Leaderboard data sync is paused until the PocketMine server goes live.",
    rankedPlayers: "Ranked Players",
    peakElo: "Peak ELO"
  },
  fr: {
    title: "Classement PvP par niveaux",
    search: "Rechercher des joueurs",
    offline: "SERVEUR ACTUELLEMENT HORS LIGNE",
    offlineSub: "La synchronisation est suspendue jusqu'à ce que le serveur PocketMine soit en ligne.",
    rankedPlayers: "Joueurs Classés",
    peakElo: "ELO Maximum"
  },
  es: {
    title: "Tabla de clasificación PvP",
    search: "Buscar jugadores",
    offline: "SERVIDOR DESCONECTADO",
    offlineSub: "La sincronización de datos está pausada hasta que el servidor esté en línea.",
    rankedPlayers: "Jugadores Clasificados",
    peakElo: "Puntuación Máxima ELO"
  },
  pt: {
    title: "Lista de Níveis PvP",
    search: "Buscar jogadores",
    offline: "SERVIDOR OFFLINE",
    offlineSub: "Sincronização de dados pausada até o servidor ficar online.",
    rankedPlayers: "Jogadores Rankeados",
    peakElo: "ELO Máximo"
  },
  ru: {
    title: "Рейтинговый список PvP",
    search: "Поиск игроков",
    offline: "СЕРВЕР ОФФЛАЙН",
    offlineSub: "Синхронизация данных приостановлена до запуска сервера.",
    rankedPlayers: "Рейтинговые игроки",
    peakElo: "Пиковый ELO"
  },
  ja: {
    title: "PvP ティアリスト",
    search: "プレイヤーを検索",
    offline: "サーバーオフライン",
    offlineSub: "サーバーがオンラインになるまでデータ同期は停止中です。",
    rankedPlayers: "ランク付けされたプレイヤー",
    peakElo: "最高 ELO"
  }
};

function translateSite(langKey) {
  var lang = TRANSLATIONS[langKey] || TRANSLATIONS.en;

  var subHeader = document.querySelector('.header-wrap p');
  if (subHeader) subHeader.innerText = lang.title;

  var searchInput = document.getElementById('q');
  if (searchInput) searchInput.placeholder = lang.search;

  var offlineTitle = document.querySelector('.offline-text h3');
  if (offlineTitle) offlineTitle.innerText = lang.offline;

  var offlineSub = document.querySelector('.offline-text p');
  if (offlineSub) offlineSub.innerText = lang.offlineSub;

  var statBadgeLabels = document.querySelectorAll('.stat-badge-lbl');
  if (statBadgeLabels[0]) statBadgeLabels[0].innerText = lang.rankedPlayers;
  if (statBadgeLabels[1]) statBadgeLabels[1].innerText = lang.peakElo;
}

if (q) q.addEventListener("input", render);

render();
load();
setInterval(load, REFRESH_SECONDS * 1000);
