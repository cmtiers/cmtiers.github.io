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
var lastUpdateTime = new Date();
var out = document.getElementById("out");
var q = document.getElementById("q");

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function showToast(message) {
  var container = document.getElementById("toastContainer");
  if (!container) return;

  var toast = document.createElement("div");
  toast.className = "toast-message";
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(function() {
    toast.style.animation = "toastFade 0.3s ease forwards";
    setTimeout(function() {
      toast.remove();
    }, 300);
  }, 2000);
}

function handleDiscordClick(e) {
  e.preventDefault();
  closeDrawer();
  showToast("SOON");
}

function updateLastUpdatedTimer() {
  var timeEl = document.getElementById("lastUpdatedTime");
  if (!timeEl) return;

  var now = new Date();
  var diffSeconds = Math.floor((now - lastUpdateTime) / 1000);

  if (diffSeconds < 10) {
    timeEl.innerText = "Just now";
  } else if (diffSeconds < 60) {
    timeEl.innerText = diffSeconds + " seconds ago";
  } else {
    var diffMinutes = Math.floor(diffSeconds / 60);
    timeEl.innerText = diffMinutes + (diffMinutes === 1 ? " minute ago" : " minutes ago");
  }
}
setInterval(updateLastUpdatedTimer, 10000);

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

function updateServerStatusBox(isOnline) {
  var statusBox = document.getElementById("mainServerStatusBox");
  if (!statusBox) return;

  var currentLang = document.getElementById("langSelect") ? document.getElementById("langSelect").value : "en";
  var lang = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  if (isOnline) {
    statusBox.className = "server-status-banner is-online";
    statusBox.innerHTML = `
      <div class="status-banner-header">
        <span class="status-indicator-dot green-dot"></span>
        <h2>SERVER IS ONLINE</h2>
      </div>
      <p>${lang.onlineMessage || "Live leaderboard tracking and ELO sync are fully active."}</p>
    `;
  } else {
    statusBox.className = "server-status-banner";
    statusBox.innerHTML = `
      <div class="status-banner-header">
        <span class="status-indicator-dot red-dot"></span>
        <h2 data-i18n="offlineTitle">${lang.offlineTitle}</h2>
      </div>
      <p data-i18n="offlineMessage">${lang.offlineMessage}</p>
    `;
  }
}

function render() {
  if (!out) return;
  out.textContent = "";
  
  var rankedCountEl = document.getElementById("rankedCountDisplay");
  var topEloEl = document.getElementById("topEloDisplay");

  if (rankedCountEl) rankedCountEl.textContent = players.length;

  var maxElo = players.length > 0 ? Math.max.apply(null, players.map(function(p){ return p.elo; })) : 0;
  if (topEloEl) topEloEl.textContent = maxElo;

  if (loaded && players.length > 0 && !failure) {
    updateServerStatusBox(true);
  } else {
    updateServerStatusBox(false);
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
      lastUpdateTime = new Date();
      updateLastUpdatedTimer();
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
    pageTitle: "CMTIERS - Ranked PvP Tier List & Leaderboard",
    navTitle: "NAVIGATION",
    navLeaderboard: "🏠 Leaderboard",
    navTierGuide: "🏆 Tier List Guide (C - S+)",
    navCompare: "⚔️ Compare Players",
    navRules: "📜 Rules",
    navRankings: "📈 How Rankings Work",
    navAchievements: "🏆 Titles & Achievements",
    navDiscord: "💬 Join Discord",
    subtitle: "Ranked PvP tier list",
    rankedPlayers: "Ranked Players",
    peakElo: "Peak ELO",
    offlineTitle: "SERVER IS CURRENTLY OFFLINE",
    offlineMessage: "Leaderboard data sync is paused until the PocketMine server goes live.",
    onlineMessage: "Live leaderboard tracking and ELO sync are fully active.",
    searchPlaceholder: "Search players",
    lastUpdatedText: "Last Updated:",
    mojangDisclaimer: "Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.",
    systemStatus: "System Status: Active Sync",
    modalTierTitle: "🏆 TIER LIST HIERARCHY (C TO S+)",
    tierSplus: "Elite Grandmasters (1600+ ELO)",
    tierS: "Master Tier PvP Champions (1450+ ELO)",
    tierAplus: "Expert Competitors (1300+ ELO)",
    tierA: "Advanced Fighters (1200+ ELO)",
    tierBplus: "Skilled Regulars (1100+ ELO)",
    tierB: "Intermediate Players (1000+ ELO)",
    tierCplus: "Rising Contenders (900+ ELO)",
    tierC: "Base Competitive Entry (0+ ELO)",
    closeGuide: "Close Guide",
    modalRulesTitle: "📜 OFFICIAL SERVER & LEADERBOARD RULES",
    modalRulesDesc: "<b>1. Real-Time In-Game Tracking:</b> All player stats, kills, deaths, and ELO ratings are registered live from our MCPE 0.15.10 PocketMine server.<br><br><b>2. Fair Play & Modded Clients:</b> Hacks, reach modifications, auto-clickers, macro tools, or illegal client patches are strictly prohibited.<br><br><b>3. Kill Farming & Exploits:</b> Intentionally killing alternate accounts (alts), AFK players, or trading kills to boost ELO points is banned.<br><br><b>4. Screen Recording Verification:</b> Official competitive duels require full, unedited screen recordings to be submitted upon staff request.",
    understood: "Understood",
    modalRankingsTitle: "📈 HOW RANKINGS & ELO WORK",
    modalRankingsDesc: "<b>1. Real-Time Server Sync:</b> Killing a player inside the server calculates new ELO points and pushes the update directly to `data.json`.<br><br><b>2. Tier Bands (C to S+):</b> Players are grouped automatically into tier bands based on rating.<br><br><b>3. Automatic ELO Sorting:</b> Inside each band, players are ordered from highest to lowest ELO rating.<br><br><b>4. Auto-Refresh:</b> Website polls for updates every 5 minutes to keep standings fresh.",
    gotIt: "Got It",
    modalAchTitle: "🏆 Titles & Achievements",
    modalAchDesc: "• <b>UHC Warlord:</b> Rank #1 Spot on S+ Tier<br>• <b>Flawless Victory:</b> 7-0 Match Sweep in official duels<br>• <b>Mobile Titan:</b> Rank #1 on Mobile Devices",
    close: "Close",
    statTier: "Tier",
    statElo: "ELO Points",
    statWinrate: "Winrate",
    statRecord: "Record (W / L)",
    statStreak: "Streak",
    statMeta: "Region / Device",
    closeOverview: "Close Overview",
    modalCompareTitle: "⚔️ PLAYER COMPARISON",
    player1Label: "Player 1",
    player2Label: "Player 2",
    closeComparison: "Close Comparison"
  },
  fr: {
    pageTitle: "CMTIERS - Classement PvP & Liste des Niveaux",
    navTitle: "NAVIGATION",
    navLeaderboard: "🏠 Classement",
    navTierGuide: "🏆 Guide des Niveaux (C - S+)",
    navCompare: "⚔️ Comparer les Joueurs",
    navRules: "📜 Règles",
    navRankings: "📈 Fonctionnement du Classement",
    navAchievements: "🏆 Titres et Succès",
    navDiscord: "💬 Rejoindre Discord",
    subtitle: "Classement PvP par niveaux",
    rankedPlayers: "Joueurs Classés",
    peakElo: "ELO Maximum",
    offlineTitle: "LE SERVEUR EST ACTUELLEMENT HORS LIGNE",
    offlineMessage: "La synchronisation du classement est en pause jusqu'à ce que le serveur soit en ligne.",
    onlineMessage: "Le suivi du classement en direct et la synchro ELO sont actifs.",
    searchPlaceholder: "Rechercher des joueurs",
    lastUpdatedText: "Dernière mise à jour :",
    mojangDisclaimer: "Produit Minecraft non officiel. Non approuvé ni associé à Mojang ou Microsoft.",
    systemStatus: "État du Système : Synchro Active",
    modalTierTitle: "🏆 HÉRARCHIE DES NIVEAUX (C À S+)",
    tierSplus: "Grands Maîtres d'Élite (1600+ ELO)",
    tierS: "Champions PvP Maîtres (1450+ ELO)",
    tierAplus: "Compétiteurs Experts (1300+ ELO)",
    tierA: "Combattants Avancés (1200+ ELO)",
    tierBplus: "Habitués Qualifiés (1100+ ELO)",
    tierB: "Joueurs Intermédiaires (1000+ ELO)",
    tierCplus: "Rivaux Montants (900+ ELO)",
    tierC: "Entrée Compétitive de Base (0+ ELO)",
    closeGuide: "Fermer le Guide",
    modalRulesTitle: "📜 RÈGLES OFFICIELLES DU SERVEUR",
    modalRulesDesc: "<b>1. Suivi en direct:</b> Toutes les statistiques des joueurs, éliminations, décès et classements ELO sont enregistrés en direct de notre serveur MCPE 0.15.10 PocketMine.<br><br><b>2. Fair-play et clients modifiés:</b> Les hacks, modifications de portée, auto-cliqueurs ou macros sont strictement interdits.<br><br><b>3. Farm de kills et exploits:</b> Tuer intentionnellement des comptes secondaires ou truquer les kills est banni.<br><br><b>4. Vérification d'enregistrement:</b> Les duels compétitifs officiels nécessitent des enregistrements complets sur demande.",
    understood: "Compris",
    modalRankingsTitle: "📈 COMMENT FONCTIONNENT LES CLASSEMENTS",
    modalRankingsDesc: "<b>1. Synchro Serveur:</b> Tuer un joueur calcule de nouveaux points ELO et met à jour `data.json`.<br><br><b>2. Bandes de Niveaux:</b> Les joueurs sont regroupés automatiquement selon leur classement.<br><br><b>3. Tri ELO Automatique:</b> Les joueurs sont triés du plus haut au plus bas ELO.<br><br><b>4. Actualisation Auto:</b> Le site vérifie les mises à jour toutes les 5 minutes.",
    gotIt: "Compris",
    modalAchTitle: "🏆 Titres & Succès",
    modalAchDesc: "• <b>Seigneur UHC:</b> Rang #1 du Tier S+<br>• <b>Victoire Parfaite:</b> Balayage 7-0 en duels officiels<br>• <b>Titan Mobile:</b> Rang #1 sur Mobile",
    close: "Fermer",
    statTier: "Niveau",
    statElo: "Points ELO",
    statWinrate: "Taux de Victoire",
    statRecord: "Bilan (V / D)",
    statStreak: "Série",
    statMeta: "Région / Appareil",
    closeOverview: "Fermer l'Aperçu",
    modalCompareTitle: "⚔️ COMPARAISON DE JOUEURS",
    player1Label: "Joueur 1",
    player2Label: "Joueur 2",
    closeComparison: "Fermer la Comparaison"
  },
  es: {
    pageTitle: "CMTIERS - Lista de Niveles y Clasificación PvP",
    navTitle: "NAVEGACIÓN",
    navLeaderboard: "🏠 Tabla de Clasificación",
    navTierGuide: "🏆 Guía de Niveles (C - S+)",
    navCompare: "⚔️ Comparar Jugadores",
    navRules: "📜 Reglas",
    navRankings: "📈 Cómo Funciona el Ranking",
    navAchievements: "🏆 Títulos y Logros",
    navDiscord: "💬 Unirse a Discord",
    subtitle: "Tabla de clasificación PvP",
    rankedPlayers: "Jugadores Clasificados",
    peakElo: "Puntuación Máxima ELO",
    offlineTitle: "EL SERVIDOR ESTÁ ACTUALMENTE FUERA DE LÍNEA",
    offlineMessage: "La sincronización de datos de la tabla de clasificación está pausada hasta que el servidor esté activo.",
    onlineMessage: "El seguimiento en vivo y la sincronización de ELO están activos.",
    searchPlaceholder: "Buscar jugadores",
    lastUpdatedText: "Última actualización:",
    mojangDisclaimer: "No es un producto oficial de Minecraft. No aprobado ni asociado con Mojang o Microsoft.",
    systemStatus: "Estado del Sistema: Sincronización Activa",
    modalTierTitle: "🏆 JERARQUÍA DE NIVELES (C A S+)",
    tierSplus: "Grandes Maestros de Élite (1600+ ELO)",
    tierS: "Campeones PvP Maestros (1450+ ELO)",
    tierAplus: "Competidores Expertos (1300+ ELO)",
    tierA: "Luchadores Avanzados (1200+ ELO)",
    tierBplus: "Veteranos Calificados (1100+ ELO)",
    tierB: "Jugadores Intermedios (1000+ ELO)",
    tierCplus: "Contendientes Ascendentes (900+ ELO)",
    tierC: "Entrada Competitiva Base (0+ ELO)",
    closeGuide: "Cerrar Guía",
    modalRulesTitle: "📜 REGLAS OFICIALES DEL SERVIDOR",
    modalRulesDesc: "<b>1. Seguimiento en tiempo real:</b> Las estadísticas, muertes y ELO de los jugadores se registran en vivo desde nuestro servidor PocketMine de MCPE 0.15.10.<br><br><b>2. Juego Limpio:</b> Hacks, modificaciones de alcance, auto-clickers o macros están estrictamente prohibidos.<br><br><b>3. Granjas de Kills y Exploits:</b> Matar cuentas alternativas o hacer trampa para subir ELO está prohibido.<br><br><b>4. Verificación de Video:</b> Los duelos competitivos oficiales requieren grabaciones sin editar si el staff lo solicita.",
    understood: "Entendido",
    modalRankingsTitle: "📈 CÓMO FUNCIONAN LOS RANKINGS",
    modalRankingsDesc: "<b>1. Sincronización:</b> Eliminar a un jugador calcula nuevos puntos ELO y actualiza `data.json`.<br><br><b>2. Bandas de Nivel:</b> Los jugadores se agrupan automáticamente según su rango.<br><br><b>3. Ordenamiento ELO:</b> Dentro de cada banda, se ordenan del ELO más alto al más bajo.<br><br><b>4. Actualización Automática:</b> El sitio verifica actualizaciones cada 5 minutos.",
    gotIt: "Entendido",
    modalAchTitle: "🏆 Títulos y Logros",
    modalAchDesc: "• <b>Señor de la Guerra UHC:</b> Puesto #1 en Tier S+<br>• <b>Victoria Impecable:</b> Racha de 7-0 en duelos oficiales<br>• <b>Titán Móvil:</b> Puesto #1 en Dispositivos Móviles",
    close: "Cerrar",
    statTier: "Nivel",
    statElo: "Puntos ELO",
    statWinrate: "Tasa de Victorias",
    statRecord: "Récord (G / P)",
    statStreak: "Racha",
    statMeta: "Región / Dispositivo",
    closeOverview: "Cerrar Resumen",
    modalCompareTitle: "⚔️ COMPARACIÓN DE JUGADORES",
    player1Label: "Jugador 1",
    player2Label: "Jugador 2",
    closeComparison: "Cerrar Comparación"
  },
  pt: {
    pageTitle: "CMTIERS - Lista de Níveis e Classificação PvP",
    navTitle: "NAVEGAÇÃO",
    navLeaderboard: "🏠 Leaderboard",
    navTierGuide: "🏆 Guia de Níveis (C - S+)",
    navCompare: "⚔️ Comparar Jogadores",
    navRules: "📜 Regras",
    navRankings: "📈 Como o Ranking Funciona",
    navAchievements: "🏆 Títulos e Conquistas",
    navDiscord: "💬 Entrar no Discord",
    subtitle: "Lista de níveis PvP",
    rankedPlayers: "Jogadores Rankeados",
    peakElo: "ELO Máximo",
    offlineTitle: "O SERVIDOR ESTÁ ATUALMENTE OFF-LINE",
    offlineMessage: "A sincronização de dados do leaderboard está pausada até que o servidor esteja on-line.",
    onlineMessage: "O rastreamento ao vivo do leaderboard e a sincronização de ELO estão ativos.",
    searchPlaceholder: "Buscar jogadores",
    lastUpdatedText: "Última atualização:",
    mojangDisclaimer: "Produto não oficial do Minecraft. Não aprovado ou associado à Mojang ou Microsoft.",
    systemStatus: "Status do Sistema: Sincronização Ativa",
    modalTierTitle: "🏆 HIERARQUIA DE NÍVEIS (C A S+)",
    tierSplus: "Grandes Mestres de Elite (1600+ ELO)",
    tierS: "Campeões PvP Mestres (1450+ ELO)",
    tierAplus: "Competidores Experientes (1300+ ELO)",
    tierA: "Lutadores Avançados (1200+ ELO)",
    tierBplus: "Regulares Habilidosos (1100+ ELO)",
    tierB: "Jogadores Intermediários (1000+ ELO)",
    tierCplus: "Contendores em Ascensão (900+ ELO)",
    tierC: "Entrada Competitiva Base (0+ ELO)",
    closeGuide: "Fechar Guia",
    modalRulesTitle: "📜 REGRAS OFICIAIS DO SERVIDOR",
    modalRulesDesc: "<b>1. Rastreamento em Tempo Real:</b> Todas as estatísticas e pontuações ELO são registradas ao vivo do nosso servidor PocketMine de MCPE 0.15.10.<br><br><b>2. Jogo Justo:</b> Hacks, modificações de alcance, auto-clickers ou macros são estritamente proibidos.<br><br><b>3. Farm de Kills e Exploits:</b> Matar contas alternativas ou farmar kills para subir ELO é banido.<br><br><b>4. Verificação de Vídeo:</b> Duelos competitivos oficiais exigem gravações completas se solicitadas pela staff.",
    understood: "Entendido",
    modalRankingsTitle: "📈 COMO FUNCIONAM OS RANKINGS",
    modalRankingsDesc: "<b>1. Sincronização:</b> Derrotar um jogador calcula novos pontos ELO e atualiza o `data.json`.<br><br><b>2. Bandas de Nível:</b> Os jogadores são agrupados automaticamente por classificação.<br><br><b>3. Ordenação ELO:</b> Em cada banda, os jogadores são ordenados do maior para o menor ELO.<br><br><b>4. Atualização Automática:</b> O site verifica atualizações a cada 5 minutos.",
    gotIt: "Entendi",
    modalAchTitle: "🏆 Títulos e Conquistas",
    modalAchDesc: "• <b>Senhor da Guerra UHC:</b> Posição #1 no Tier S+<br>• <b>Vitória Perfeita:</b> Vredas 7-0 em duelos oficiais<br>• <b>Titã Mobile:</b> Posição #1 em Dispositivos Móveis",
    close: "Fechar",
    statTier: "Nível",
    statElo: "Pontos ELO",
    statWinrate: "Taxa de Vitória",
    statRecord: "Recorde (V / D)",
    statStreak: "Sequência",
    statMeta: "Região / Dispositivo",
    closeOverview: "Fechar Visão Geral",
    modalCompareTitle: "⚔️ COMPARAÇÃO DE JOGADORES",
    player1Label: "Jogador 1",
    player2Label: "Jogador 2",
    closeComparison: "Fechar Comparação"
  },
  ru: {
    pageTitle: "CMTIERS - Рейтинговая таблица и список тиров PvP",
    navTitle: "НАВИГАЦИЯ",
    navLeaderboard: "🏠 Таблица лидеров",
    navTierGuide: "🏆 Гид по тирам (C - S+)",
    navCompare: "⚔️ Сравнить игроков",
    navRules: "📜 Правила",
    navRankings: "📈 Как работает рейтинг",
    navAchievements: "🏆 Титулы и достижения",
    navDiscord: "💬 Наш Discord",
    subtitle: "Рейтинговый список PvP",
    rankedPlayers: "Рейтинговые игроки",
    peakElo: "Пиковый ELO",
    offlineTitle: "СЕРВЕР В НАСТОЯЩЕЕ ВРЕМЯ ОФФЛАЙН",
    offlineMessage: "Синхронизация данных таблицы лидеров приостановлена до запуска сервера PocketMine.",
    onlineMessage: "Отслеживание рейтинга в реальном времени и синхронизация ELO активны.",
    searchPlaceholder: "Поиск игроков",
    lastUpdatedText: "Последнее обновление:",
    mojangDisclaimer: "Не является официальным продуктом Minecraft. Не связано с Mojang или Microsoft.",
    systemStatus: "Статус системы: Синхронизация",
    modalTierTitle: "🏆 ИЕРАРХИЯ ТИРОВ (ОТ C ДО S+)",
    tierSplus: "Элитные грандмастера (1600+ ELO)",
    tierS: "Мастера PvP чемпионата (1450+ ELO)",
    tierAplus: "Опытные конкуренты (1300+ ELO)",
    tierA: "Продвинутые бойцы (1200+ ELO)",
    tierBplus: "Уверенные игроки (1100+ ELO)",
    tierB: "Средний уровень (1000+ ELO)",
    tierCplus: "Восходящие претенденты (900+ ELO)",
    tierC: "Базовый соревновательный вход (0+ ELO)",
    closeGuide: "Закрыть гид",
    modalRulesTitle: "📜 ОФИЦИАЛЬНЫЕ ПРАВИЛА СЕРВЕРА",
    modalRulesDesc: "<b>1. Синхронизация в реальном времени:</b> Статистика, убийства и очки ELO регистрируются напрямую с нашего сервера MCPE 0.15.10 PocketMine.<br><br><b>2. Честная игра:</b> Читы, модификации дальности удара, автокликеры и макросы строго запрещены.<br><br><b>3. Накрутка убийств:</b> Убийство твинков или передача побед ради ELO карается баном.<br><br><b>4. Запись дуэлей:</b> Официальные соревновательные матчи требуют видеозаписи по запросу администрации.",
    understood: "Понятно",
    modalRankingsTitle: "📈 КАК РАБОТАЕТ РЕЙТИНГ",
    modalRankingsDesc: "<b>1. Синхронизация сервера:</b> Убийство игрока пересчитывает ELO и обновляет `data.json`.<br><br><b>2. Тир-группы:</b> Игроки автоматически распределяются по тирам.<br><br><b>3. Сортировка ELO:</b> Внутри тиров игроки сортируются от большего ELO к меньшему.<br><br><b>4. Автообновление:</b> Сайт проверяет новые данные каждые 5 минут.",
    gotIt: "Ясно",
    modalAchTitle: "🏆 Титулы и достижения",
    modalAchDesc: "• <b>Повелитель UHC:</b> 1-е место в тире S+<br>• <b>Безупречная победа:</b> Сухой счет 7-0 в официальных дуэлях<br>• <b>Мобильный титан:</b> 1-е место на мобильных устройствах",
    close: "Закрыть",
    statTier: "Тир",
    statElo: "Очки ELO",
    statWinrate: "Процент побед",
    statRecord: "Рекорд (П / Пр)",
    statStreak: "Серия побед",
    statMeta: "Регион / Устройство",
    closeOverview: "Закрыть обзор",
    modalCompareTitle: "⚔️ СРАВНЕНИЕ ИГРОКОВ",
    player1Label: "Игрок 1",
    player2Label: "Игрок 2",
    closeComparison: "Закрыть сравнение"
  },
  ja: {
    pageTitle: "CMTIERS - PvP ティアリストとリーダーボード",
    navTitle: "ナビゲーション",
    navLeaderboard: "🏠 リーダーボード",
    navTierGuide: "🏆 ティアリストガイド (C - S+)",
    navCompare: "⚔️ プレイヤー比較",
    navRules: "📜 ルール",
    navRankings: "📈 ランキングの仕組み",
    navAchievements: "🏆 称号と実績",
    navDiscord: "💬 Discordに参加",
    subtitle: "PvP ティアリスト",
    rankedPlayers: "ランク済みプレイヤー",
    peakElo: "最高 ELO",
    offlineTitle: "サーバーは現在オフラインです",
    offlineMessage: "PocketMine サーバーが稼働するまで、リーダーボード データの同期は停止されます。",
    onlineMessage: "ライブ リーダーボード追跡と ELO 同期が完全にアクティブです。",
    searchPlaceholder: "プレイヤーを検索",
    lastUpdatedText: "最終更新:",
    mojangDisclaimer: "公式のMinecraft製品ではありません。MojangまたはMicrosoft社とは一切関係ありません。",
    systemStatus: "システム状態: 同期中",
    modalTierTitle: "🏆 ティア階層 (C から S+)",
    tierSplus: "エリートグランドマスター (1600+ ELO)",
    tierS: "マスターティアPvPチャンピオン (1450+ ELO)",
    tierAplus: "エキスパート競技者 (1300+ ELO)",
    tierA: "上級ファイター (1200+ ELO)",
    tierBplus: "熟練プレイヤー (1100+ ELO)",
    tierB: "中級プレイヤー (1000+ ELO)",
    tierCplus: "ライジングコンテンダー (900+ ELO)",
    tierC: "ベース競技エントリー (0+ ELO)",
    closeGuide: "ガイドを閉じる",
    modalRulesTitle: "📜 公式サーバーとリーダーボードのルール",
    modalRulesDesc: "<b>1. リアルタイム追跡:</b> すべてのプレイヤー統計、キル数、ELOレートはMCPE 0.15.10 PocketMineサーバーからライブで登録されます。<br><br><b>2. フェアプレー:</b> ハック、リーチ変更、オートクリック、マクロツールなどの違法なクライアントパッチは厳禁です。<br><br><b>3. キルファームの禁止:</b> サブ垢やAFKプレイヤーの意図的なキルは禁止されています。<br><br><b>4. 画面録画の検証:</b> 公式デュエルではスタッフの要求に応じて未編集の画面録画提出が必要です。",
    understood: "了解",
    modalRankingsTitle: "📈 ランキングとELOの仕組み",
    modalRankingsDesc: "<b>1. サーバー同期:</b> サーバー内でプレイヤーをキルすると新しいELOが計算され `data.json` に反映されます。<br><br><b>2. ティアバンド:</b> 評価に基づいて自動的にグループ化されます。<br><br><b>3. ELO自動ソート:</b> 各バンド内でELOの高い順に並び替えられます。<br><br><b>4. 自動更新:</b> 5分ごとにサイトが更新を確認します。",
    gotIt: "理解した",
    modalAchTitle: "🏆 称号と実績",
    modalAchDesc: "• <b>UHCウォーロード:</b> S+ティア #1位<br>• <b>完全勝利:</b> 公式デュエルでの7-0スイープ<br>• <b>モバイルタイタン:</b> モバイルデバイス部門 #1位",
    close: "閉じる",
    statTier: "ティア",
    statElo: "ELOポイント",
    statWinrate: "勝率",
    statRecord: "戦績 (勝 / 敗)",
    statStreak: "連勝",
    statMeta: "地域 / デバイス",
    closeOverview: "概要を閉じる",
    modalCompareTitle: "⚔️ プレイヤー比較",
    player1Label: "プレイヤー 1",
    player2Label: "プレイヤー 2",
    closeComparison: "比較を閉じる"
  }
};

function translateSite(langKey) {
  var lang = TRANSLATIONS[langKey] || TRANSLATIONS.en;

  document.querySelectorAll("[data-i18n]").forEach(function(el) {
    var key = el.getAttribute("data-i18n");
    if (lang[key] !== undefined) {
      if (key === "modalRulesDesc" || key === "modalRankingsDesc" || key === "modalAchDesc") {
        el.innerHTML = lang[key];
      } else {
        el.innerText = lang[key];
      }
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(function(el) {
    var key = el.getAttribute("data-i18n-placeholder");
    if (lang[key] !== undefined) {
      el.placeholder = lang[key];
    }
  });

  var statusBox = document.getElementById("mainServerStatusBox");
  if (statusBox) {
    var isOnline = statusBox.classList.contains("is-online");
    updateServerStatusBox(isOnline);
  }
}

if (q) q.addEventListener("input", render);

render();
load();
setInterval(load, REFRESH_SECONDS * 1000);
