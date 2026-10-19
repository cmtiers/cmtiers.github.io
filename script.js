// ---- settings -------------------------------------------------------------
var DATA_URL = "players.json";   // same path as tier-sync.file in the plugin's config.yml
var ROOT = "";                // e.g. "players" if the file looks like {"players": [ ... ]}
var REFRESH_SECONDS = 60;

// Highest tier first. "keys" are the tier values the plugin writes (lower-case).
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
// ---------------------------------------------------------------------------

var players = [], loaded = false, failure = "";
var out = document.getElementById("out");
var q = document.getElementById("q");

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function toPlayers(d) {
  if (ROOT) {
    ROOT.split(".").forEach(function (k) { d = d && d[k]; });
  }
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
      head: String(p && p.head || "https://mc-heads.net/avatar/MHF_Steve/28")
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
  out.textContent = "";
  document.getElementById("count").textContent = loaded ? players.length + (players.length === 1 ? " player" : " players") : "";

  if (failure) {
    var err = el("div", "note err");
    err.appendChild(el("strong", "", "Couldn’t load " + DATA_URL));
    err.appendChild(el("div", "", failure));
    out.appendChild(err);
    return;
  }
  if (!loaded) { out.appendChild(el("div", "note", "Loading…")); return; }
  if (players.length === 0) {
    out.appendChild(el("div", "note", "No players yet. Players appear here once they reach C Tier."));
    return;
  }

  var term = q.value.trim().toLowerCase();
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

  if (rows.length === 0) {
    out.appendChild(el("div", "note", "No player matches “" + q.value.trim() + "”."));
    return;
  }

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
      chip.onclick = function(e) { openPlayerModal(p.name); triggerCardBlast(e); };
      
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
      if (!r.ok) throw new Error("HTTP " + r.status + " – check that the file exists in the repo and that DATA_URL matches tier-sync.file.");
      return r.json();
    })
    .then(function (d) {
      players = toPlayers(d);
      loaded = true;
      failure = "";
      document.getElementById("updated").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      render();
    })
    .catch(function (e) {
      failure = location.protocol === "file:"
        ? "Browsers block loading data from a file opened on your computer. Open the page through GitHub Pages or a local server instead."
        : String(e.message || e);
      render();
    });
}

function openPlayerModal(playerName) {
  var player = players.find(function(p) { return p.name === playerName; });
  if (!player) return;

  var totalMatches = player.wins + player.losses;
  var wr = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) + "%" : "0%";

  document.getElementById('modalPlayerHead').src = player.head;
  document.getElementById('modalPlayerName').innerText = player.name;
  
  var roleBadge = '';
  if (player.role === 'ADMIN') roleBadge = '<span class="badge-admin">ADMIN</span>';
  if (player.role === 'MOD') roleBadge = '<span class="badge-mod">MOD</span>';
  document.getElementById('modalPlayerBadges').innerHTML = roleBadge;

  document.getElementById('modalPlayerTier').innerText = player.tier;
  document.getElementById('modalPlayerWinrate').innerText = wr;
  document.getElementById('modalPlayerRecord').innerText = player.wins + "W / " + player.losses + "L";
  document.getElementById('modalPlayerMatches').innerText = player.elo + " ELO";
  document.getElementById('modalPlayerStreak').innerText = "🔥 " + player.streak;
  document.getElementById('modalPlayerMeta').innerText = player.region + " • " + player.device;

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
  var p1Name = document.getElementById('p1Select').value;
  var p2Name = document.getElementById('p2Select').value;

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

  for (var i = 0; i < 12; i++) {
    var particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.width = '6px';
    particle.style.height = '6px';
    particle.style.background = 'var(--accent-cyan)';
    particle.style.borderRadius = '50%';
    particle.style.pointerEvents = 'none';
    particle.style.boxShadow = '0 0 10px var(--accent-cyan)';
    particle.style.zIndex = '10';

    var angle = Math.random() * Math.PI * 2;
    var speed = Math.random() * 4 + 2;
    var vx = Math.cos(angle) * speed;
    var vy = Math.sin(angle) * speed;

    e.currentTarget.appendChild(particle);

    (function(p, vxVal, vyVal) {
      var life = 1;
      var anim = setInterval(function() {
        life -= 0.08;
        p.style.transform = 'translate(' + (vxVal * (1 - life) * 20) + 'px, ' + (vyVal * (1 - life) * 20) + 'px) scale(' + life + ')';
        p.style.opacity = life;

        if (life <= 0) {
          clearInterval(anim);
          p.remove();
        }
      }, 20);
    })(particle, vx, vy);
  }
}

function playSmokeExplosionSound() {
  try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var bufferSize = audioCtx.sampleRate * 2.5;
    var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 2.0);

    var gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.4);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noise.start();
    noise.stop(audioCtx.currentTime + 2.5);
  } catch (e) {}
}

// 10-SECOND LOCK TIMER
var totalSecs = 10; 
var unlocked = false;

function updateLockTimer() {
  var h = Math.floor(totalSecs / 3600);
  var m = Math.floor((totalSecs % 3600) / 60);
  var s = totalSecs % 60;

  var hrsEl = document.getElementById('hrs');
  var minsEl = document.getElementById('mins');
  var secsEl = document.getElementById('secs');

  if (hrsEl) hrsEl.innerText = String(h).padStart(2, '0');
  if (minsEl) minsEl.innerText = String(m).padStart(2, '0');
  if (secsEl) secsEl.innerText = String(s).padStart(2, '0');

  if (totalSecs > 0) {
    totalSecs--;
  } else if (!unlocked) {
    unlocked = true;
    var lock = document.getElementById('timer-lockscreen');
    if (lock) lock.classList.add('unlocked');
    
    document.body.classList.add('unlocked-scroll');
    playSmokeExplosionSound();
    triggerCornerSmoke();
  }
}

setInterval(updateLockTimer, 1000);

var openMenuBtn = document.getElementById('openMenuBtn');
var closeMenuBtn = document.getElementById('closeMenuBtn');
var drawer = document.getElementById('drawer');
var drawerOverlay = document.getElementById('drawerOverlay');

function openDrawer() {
  drawer.classList.add('active');
  drawerOverlay.classList.add('active');
}

function closeDrawer() {
  drawer.classList.remove('active');
  drawerOverlay.classList.remove('active');
}

function scrollToLeaderboard() {
  closeDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

if (openMenuBtn) openMenuBtn.addEventListener('click', openDrawer);
if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

function openModal(id) {
  closeDrawer();
  var m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

// THEME TOGGLE LOGIC
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

// BACKGROUND PARTICLE CANVAS
var canvas = document.getElementById('bg-canvas');
if (canvas) {
  var ctx = canvas.getContext('2d');
  var mouse = { x: null, y: null, radius: 150 };

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

  var particles = Array.from({ length: 70 }, function() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
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
      ctx.fillStyle = isDark ? getComputedStyle(document.body).getPropertyValue('--accent-cyan') : '#0284c7';
      ctx.fill();

      if (mouse.x && mouse.y) {
        var mDist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (mDist < mouse.radius) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = 'rgba(0, 242, 254, ' + (1 - mDist / mouse.radius) + ')';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      for (var j = i + 1; j < particles.length; j++) {
        var p2 = particles[j];
        var dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isDark 
            ? 'rgba(0, 242, 254, ' + (1 - dist / 130) + ')' 
            : 'rgba(2, 132, 199, ' + (1 - dist / 130) + ')';
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
    { x: 0, y: 0, vxMin: 2, vxMax: 7, vyMin: 2, vyMax: 7 },
    { x: smokeCanvas.width, y: 0, vxMin: -7, vxMax: -2, vyMin: 2, vyMax: 7 },
    { x: 0, y: smokeCanvas.height, vxMin: 2, vxMax: 7, vyMin: -7, vyMax: -2 },
    { x: smokeCanvas.width, y: smokeCanvas.height, vxMin: -7, vxMax: -2, vyMin: -7, vyMax: -2 }
  ];

  corners.forEach(function(c) {
    for (var i = 0; i < 110; i++) {
      smokeParticles.push({
        x: c.x,
        y: c.y,
        vx: (Math.random() * (c.vxMax - c.vxMin) + c.vxMin) * (Math.random() * 1.5 + 0.5),
        vy: (Math.random() * (c.vyMax - c.vyMin) + c.vyMin) * (Math.random() * 1.5 + 0.5),
        radius: Math.random() * 45 + 25,
        alpha: Math.random() * 0.7 + 0.3,
        grow: Math.random() * 0.9 + 0.5,
        color: Math.random() > 0.4 ? '220, 225, 230' : '160, 170, 185'
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
      p.alpha -= 0.005;

      if (p.alpha > 0) {
        sCtx.beginPath();
        var grad = sCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, 'rgba(' + p.color + ', ' + p.alpha + ')');
        grad.addColorStop(0.6, 'rgba(' + p.color + ', ' + (p.alpha * 0.5) + ')');
        grad.addColorStop(1, 'rgba(' + p.color + ', 0)');
        sCtx.fillStyle = grad;
        sCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        sCtx.fill();
      }
    });

    if (elapsed < 3800) {
      requestAnimationFrame(animateSmoke);
    } else {
      sCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);
    }
  }

  animateSmoke();
}

render();
load();
setInterval(load, REFRESH_SECONDS * 1000);
