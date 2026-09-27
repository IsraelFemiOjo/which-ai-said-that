/* Which AI Said That? — daily game
   Edit CONFIG when you launch. Everything else runs on its own. */
const CONFIG = {
  launchDate: "2026-09-27",           // the date of round #1
  models: ["ChatGPT", "Claude", "Gemini", "Grok"],
  handle: "@israelfemiojo",
  lookbackDays: 14,                   // if today's file is missing, show the latest round from the last 14 days
  liveUrl: "",                        // optional: your live web address. Left empty, the game uses the address it is running on
  goatcounter: ""                     // optional: your GoatCounter code (the part before .goatcounter.com) to count plays
};

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- dates ---------- */
function pad(n) { return String(n).padStart(2, "0"); }
function dateStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
function dayDiff(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function roundNumber(s) { return dayDiff(CONFIG.launchDate, s) + 1; }
function prettyDate(s) {
  return parseDate(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------- state ---------- */
const params = new URLSearchParams(location.search);
const MODE = params.has("preview") ? "preview" : params.has("demo") ? "demo" : "live";
let round = null;      // loaded round file
let picks = [];        // player's picks, one per question
let qi = 0;            // current question index

function siteUrl() {
  if (CONFIG.liveUrl) return CONFIG.liveUrl;
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === "file:";
  return local ? "" : location.origin + location.pathname.replace(/index\.html$/, "");
}

/* ---------- loading ---------- */
async function fetchRound(date) {
  try {
    const r = await fetch("rounds/" + date + ".json", { cache: "no-cache" });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

async function loadRound() {
  if (MODE === "preview") {
    const p = store.get("wast-preview", null);
    return p ? p : null;
  }
  if (MODE === "demo") {
    const d = await fetchRound("demo");
    if (d) d.demo = true;
    return d;
  }
  const asked = params.get("date");
  if (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= dateStr(new Date())) {
    const r = await fetchRound(asked);
    if (r) { r.date = r.date || asked; return r; }
  }
  const today = dateStr(new Date());
  // players in time zones still on the day before launch get round #1 instead of an empty page
  if (today < CONFIG.launchDate) {
    const first = await fetchRound(CONFIG.launchDate);
    if (first) { first.date = first.date || CONFIG.launchDate; return first; }
  }
  for (let i = 0; i <= CONFIG.lookbackDays; i++) {
    const d = addDays(today, -i);
    if (d < CONFIG.launchDate) break;
    const r = await fetchRound(d);
    if (r) { r.date = r.date || d; return r; }
  }
  return null;
}

function validRound(r) {
  if (!r || !Array.isArray(r.questions) || !r.questions.length) return false;
  return r.questions.every(q => q && q.prompt && q.answer && q.model);
}

/* ---------- screens ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("on"));
  $(id).classList.add("on");
  document.body.classList.toggle("playing", id === "sQuestion");
  window.scrollTo(0, 0);
}

function optionsFor(q) {
  return Array.isArray(q.options) && q.options.length ? q.options : CONFIG.models;
}

/* ---------- tiny, safe markdown so answers keep their formatting ---------- */
function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
}
function renderMarkdown(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  let html = "", list = null, para = [], code = null;
  const flushPara = () => { if (para.length) { html += "<p>" + para.map(inline).join("<br>") + "</p>"; para = []; } };
  const closeList = () => { if (list) { html += "</" + list + ">"; list = null; } };
  for (const raw of lines) {
    if (code !== null) {
      if (/^\s*```/.test(raw)) { html += "<pre><code>" + esc(code.join("\n")) + "</code></pre>"; code = null; }
      else code.push(raw);
      continue;
    }
    if (/^\s*```/.test(raw)) { flushPara(); closeList(); code = []; continue; }
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); closeList(); continue; }
    let m;
    if ((m = line.match(/^\s*#{1,6}\s+(.*)$/))) { flushPara(); closeList(); html += "<h4>" + inline(m[1]) + "</h4>"; continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flushPara(); if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; }
      html += "<li>" + inline(m[1]) + "</li>"; continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara(); if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; }
      html += "<li>" + inline(m[1]) + "</li>"; continue;
    }
    closeList(); para.push(line.trim());
  }
  if (code !== null) html += "<pre><code>" + esc(code.join("\n")) + "</code></pre>";
  flushPara(); closeList();
  return html;
}

/* word limits are only for you, so players never see them */
function cleanPrompt(t) {
  return String(t).replace(/\s*(?:keep it |answer in |in )?under \d+ words\.?\s*$/i, "").trim();
}

/* ---------- tiers ---------- */
const TIERS = [
  { title: "Perfectly Fooled", line: "Zero. The machines would like to thank you for your confidence." },
  { title: "Trusting Soul", line: "One right. Every AI in this round thinks you're lovely." },
  { title: "Easily Charmed", line: "Two right. The rest sounded smart enough to fool you." },
  { title: "Half Detector", line: "Three right. The other two had you nodding along." },
  { title: "Fluent in Bot", line: "One slipped past you. It was probably the polite one." },
  { title: "Model Whisperer", line: "You can hear a model's accent in one paragraph." }
];
function tierFor(score, total) {
  return TIERS[Math.max(0, Math.min(5, Math.round((score / total) * 5)))];
}

/* ---------- answer reveal rules ----------
   Today's round: players only learn Correct or Wrong. The real answers unlock the next day.
   Demo, preview and past rounds show answers straight away. */
function answersHidden() {
  return MODE === "live" && !round.demo && round.date >= dateStr(new Date());
}
let prevRound = null;
async function findPrevRound() {
  if (MODE !== "live" || round.demo) return null;
  for (let i = 1; i <= CONFIG.lookbackDays; i++) {
    const d = addDays(round.date, -i);
    if (d < CONFIG.launchDate) break;
    const r = await fetchRound(d);
    if (r && validRound(r)) { r.date = r.date || d; return r; }
  }
  return null;
}
function renderPrev() {
  const r = prevRound;
  const saved = store.get("wast-" + r.date, null);
  const theirs = saved && Array.isArray(saved.picks) ? saved.picks : [];
  $("pvKicker").textContent = "Round #" + (r.number || roundNumber(r.date)) + " · " + prettyDate(r.date);
  $("pvTheme").textContent = r.theme || "";
  $("pvList").innerHTML = r.questions.map((q, i) => {
    let mine = "";
    if (theirs[i]) mine = theirs[i] === q.model ? " · You got it ✓" : " · You chose " + esc(theirs[i]);
    return '<li><p class="prompt">' + esc(cleanPrompt(q.prompt)) + '</p><div class="answer">' + renderMarkdown(q.answer) +
      '</div><p class="who"><b>' + esc(q.model) + "</b>" + mine + "</p></li>";
  }).join("");
  show("sPrev");
}
function wirePrevButtons() {
  ["btnPrev", "btnPrev2"].forEach(id => {
    const b = $(id);
    if (!b) return;
    b.hidden = !prevRound;
    b.onclick = renderPrev;
  });
}
$("btnBack").onclick = () => {
  if (picks.length === round.questions.length) renderResult(); else renderStart();
};

/* ---------- start ---------- */
function keyFor(r) { return "wast-" + (r.demo ? "demo" : r.date); }

function renderStart() {
  const num = round.number || roundNumber(round.date);
  const isToday = round.date === dateStr(new Date());
  $("startKicker").textContent = MODE === "preview" ? "Preview · " + prettyDate(round.date) : round.demo ? "Demo round" : (isToday ? "Daily game" : "Latest round · " + prettyDate(round.date));
  $("startNum").textContent = round.demo ? "Demo" : "#" + num;
  $("startLead").textContent = round.demo
    ? "Sample answers for practice. Think you can tell which AI wrote each one?"
    : "Think you can tell which AI wrote each answer?";
  $("startTheme").textContent = round.theme || "Mixed bag";
  $("demoNotice").hidden = !round.demo;
  $("btnPlay").textContent = "Play this round";
  $("btnPlay").onclick = () => { if (!picks.length) track("round-started"); qi = picks.length; renderQuestion(); show("sQuestion"); };
  if (picks.length && picks.length < round.questions.length) $("btnPlay").textContent = "Continue your round";
  show("sStart");
}

/* ---------- question ---------- */
function renderQuestion() {
  const q = round.questions[qi];
  const total = round.questions.length;
  $("progress").innerHTML = round.questions.map((_, i) =>
    '<span class="' + (i < qi ? "done" : i === qi ? "now" : "") + '"></span>').join("");
  $("qCount").textContent = (qi + 1) + " of " + total;
  $("qScore").textContent = picks.filter((p, i) => p === round.questions[i].model).length + " correct";
  $("qPrompt").textContent = cleanPrompt(q.prompt);
  $("qAnswer").innerHTML = renderMarkdown(q.answer);
  $("qAnswer").classList.toggle("short", q.answer.length <= 160);
  $("qAnswer").scrollTop = 0;
  $("qReveal").classList.remove("on");
  const box = $("qOptions");
  box.innerHTML = "";
  optionsFor(q).forEach(name => {
    const b = document.createElement("button");
    b.className = "pill glass";
    b.textContent = name;
    b.onclick = () => pick(name);
    box.appendChild(b);
  });
}

function pick(name) {
  const q = round.questions[qi];
  if (picks.length > qi) return;
  picks.push(name);
  saveProgress();
  const right = name === q.model;
  const hidden = answersHidden();
  document.querySelectorAll("#qOptions .pill").forEach(b => {
    b.disabled = true;
    if (hidden) {
      if (b.textContent === name) b.classList.add(right ? "is-right" : "is-wrong");
      else b.classList.add("is-other");
    } else {
      if (b.textContent === q.model) b.classList.add("is-right");
      else if (b.textContent === name) b.classList.add("is-wrong");
      else b.classList.add("is-other");
    }
  });
  $("qVerdict").textContent = hidden
    ? (right ? "Correct." : "Wrong.")
    : (right ? "Right. That was " + q.model + "." : "Nope. That was " + q.model + ".");
  // players only ever see the four names; the exact model stays in your private record
  $("qDetail").textContent = round.demo ? "This demo uses placeholder text." : (q.note || "");
  $("btnNext").textContent = qi + 1 < round.questions.length ? "Next question" : "See my score";
  $("qReveal").classList.add("on");
  $("qScore").textContent = picks.filter((p, i) => p === round.questions[i].model).length + " correct";
  setTimeout(() => $("qReveal").scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
}

$("btnNext").onclick = () => {
  qi++;
  if (qi < round.questions.length) { renderQuestion(); window.scrollTo(0, 0); }
  else finish();
};

/* ---------- progress + stats ---------- */
function saveProgress() {
  if (MODE !== "live") return;
  store.set(keyFor(round), { picks });
}

function finish() {
  const score = scoreOf();
  if (MODE === "live") {
    const stats = store.get("wast-stats", { played: 0, total: 0, streak: 0, lastDate: null, rounds: {} });
    if (!stats.rounds[round.date]) {
      track("round-finished");
      track("score-" + score + "-of-" + round.questions.length);
      stats.rounds[round.date] = score;
      stats.played += 1;
      stats.total += score;
      if (!stats.lastDate || round.date > stats.lastDate) {
        stats.streak = stats.lastDate && dayDiff(stats.lastDate, round.date) === 1 ? stats.streak + 1 : 1;
        stats.lastDate = round.date;
      }
      store.set("wast-stats", stats);
    }
  }
  renderResult();
}

function scoreOf() { return picks.filter((p, i) => p === round.questions[i].model).length; }

/* ---------- result ---------- */
function shareText() {
  const total = round.questions.length;
  const score = scoreOf();
  const grid = picks.map((p, i) => p === round.questions[i].model ? "⬛" : "⬜").join("");
  const num = round.number || roundNumber(round.date);
  return "Which AI Said That? #" + num + "\n" + score + "/" + total + " " + grid + "\n" + tierFor(score, total).title + (siteUrl() ? "\n\n" + siteUrl() : "");
}

async function renderResult() {
  const total = round.questions.length;
  const score = scoreOf();
  const tier = tierFor(score, total);
  const num = round.number || roundNumber(round.date);
  $("rKicker").textContent = round.demo ? "Demo round" : "Round #" + num + " · " + prettyDate(round.date);
  $("rScore").innerHTML = score + "<small>/" + total + "</small>";
  $("rTitle").textContent = tier.title;
  $("rLine").textContent = tier.line;
  $("rDots").innerHTML = picks.map((p, i) => {
    const ok = p === round.questions[i].model;
    return '<span class="' + (ok ? "y" : "n") + '">' + (ok ? "✓" : "✕") + "</span>";
  }).join("");

  const stats = store.get("wast-stats", { played: 0, total: 0, streak: 0 });
  $("rStreak").textContent = MODE === "live" ? stats.streak : "–";
  $("rPlayed").textContent = MODE === "live" ? stats.played : "–";
  $("rAvg").textContent = MODE === "live" && stats.played ? (stats.total / stats.played).toFixed(1) : "–";

  const hidden = answersHidden();
  $("rRecapTitle").textContent = round.demo ? "Demo answers" : hidden ? "Your answers" : "Answers";
  $("rRecapNote").hidden = !hidden;
  $("rRecap").innerHTML = round.questions.map((q, i) => {
    const ok = picks[i] === q.model;
    const cp = cleanPrompt(q.prompt);
    const short = cp.length > 52 ? cp.slice(0, 50).trim() + "…" : cp;
    const right = hidden
      ? "You chose " + esc(picks[i]) + (ok ? " ✓" : " ✕")
      : esc(q.model) + (ok ? " ✓" : " · You chose " + esc(picks[i]));
    return "<li><span>" + esc(short) + "</span><em>" + right + "</em></li>";
  }).join("");

  // countdown to the next round
  const tick = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(0, Math.floor((next - now) / 60000));
    $("rNext").textContent = "Next round in " + Math.floor(mins / 60) + "h " + (mins % 60) + "m";
  };
  tick(); clearInterval(window.__tick); window.__tick = setInterval(tick, 30000);

  show("sResult");

  const canvas = await drawCard();
  $("rCard").src = canvas.toDataURL("image/png");
  wireShare(canvas);
}

/* ---------- share card (certificate style) ---------- */
function wrapText(ctx, text, maxW) {
  const words = text.split(" "); const out = []; let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function loadImg(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

async function drawCard() {
  try {
    await Promise.all([
      document.fonts.load('600 40px "Instrument Sans"'),
      document.fonts.load('400 24px "Instrument Sans"'),
      document.fonts.load('500 24px "Instrument Sans"')
    ]);
  } catch (e) {}
  const W = 1200, H = 675, BAND = 440;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const INK = "#111", MUTED = "rgba(0,0,0,.56)", GREY = "#f2f2f2";
  const SANS = '"Instrument Sans", "Liberation Sans", Arial, sans-serif';
  const total = round.questions.length, score = scoreOf(), tier = tierFor(score, total);
  const num = round.number || roundNumber(round.date);

  // white top, grey band below, like the portfolio
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, BAND);
  x.fillStyle = GREY; x.fillRect(0, BAND, W, H - BAND);

  // logo + round
  const logo = await loadImg("assets/ifo-mark.svg");
  if (logo) x.drawImage(logo, 64, 52, 96, 46);
  x.textBaseline = "alphabetic";
  x.fillStyle = MUTED; x.font = "400 22px " + SANS; x.textAlign = "right";
  x.fillText(round.demo ? "Demo" : "Round #" + num + " · " + prettyDate(round.date), W - 64, 84);
  x.textAlign = "left";

  // left: game name + score
  x.fillStyle = INK; x.font = "600 34px " + SANS;
  x.fillText("Which AI Said That?", 64, 170);
  x.font = "600 210px " + SANS;
  x.fillText(String(score), 56, 392);
  const sw = x.measureText(String(score)).width;
  x.fillStyle = MUTED; x.font = "600 76px " + SANS;
  x.fillText("/" + total, 56 + sw + 8, 392);

  // right: tier + line
  const RX = 640, RW = 500;
  x.fillStyle = INK; x.font = "600 46px " + SANS;
  let y = 250;
  for (const l of wrapText(x, tier.title, RW)) { x.fillText(l, RX, y); y += 54; }
  x.fillStyle = MUTED; x.font = "400 26px " + SANS; y += 6;
  for (const l of wrapText(x, tier.line, RW)) { x.fillText(l, RX, y); y += 36; }

  // band: squares + link + credit
  const sq = 52, gap = 12, sy = 486;
  picks.forEach((p, i) => {
    const ok = p === round.questions[i].model;
    const sx = 64 + i * (sq + gap);
    x.beginPath();
    if (x.roundRect) x.roundRect(sx, sy, sq, sq, 12); else x.rect(sx, sy, sq, sq);
    if (ok) { x.fillStyle = INK; x.fill(); }
    else { x.fillStyle = "#fff"; x.fill(); x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 2; x.stroke(); }
    x.fillStyle = ok ? "#fff" : MUTED; x.font = "600 24px " + SANS; x.textAlign = "center";
    x.fillText(ok ? "✓" : "✕", sx + sq / 2, sy + 35);
    x.textAlign = "left";
  });
  x.fillStyle = INK; x.font = "500 24px " + SANS;
  const link = siteUrl().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (link) x.fillText(link, 64 + 5 * (sq + gap) + 18, sy + 34);
  x.fillStyle = MUTED; x.font = "400 19px " + SANS; x.textAlign = "center";
  x.fillText("A game by Israel Femi-Ojo.", W / 2, H - 38);
  x.textAlign = "left";
  return c;
}

function wireShare(canvas) {
  const text = shareText();
  const fileName = "which-ai-said-that-" + (round.demo ? "demo" : round.date) + ".png";
  $("btnShareX").onclick = () => {
    track("shared-x");
    window.open("https://x.com/intent/post?text=" + encodeURIComponent(text), "_blank", "noopener");
  };
  $("btnSave").onclick = () => {
    track("saved-image");
    const a = document.createElement("a");
    a.download = fileName; a.href = canvas.toDataURL("image/png"); a.click();
  };
  $("btnShareImg").onclick = () => {
    track("shared-image");
    canvas.toBlob(async blob => {
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); } catch (e) {}
      } else { $("btnSave").click(); }
    }, "image/png");
  };
  $("btnCopy").onclick = async () => {
    track("copied-result");
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t);
      t.select(); try { document.execCommand("copy"); } catch (e2) {} t.remove();
    }
    $("btnCopy").textContent = "Copied";
    setTimeout(() => { $("btnCopy").textContent = "Copy result text"; }, 1600);
  };
}

/* ---------- play counts (GoatCounter, only if a code is set) ---------- */
function setupCounter() {
  if (!CONFIG.goatcounter || MODE !== "live") return;
  const sc = document.createElement("script");
  sc.async = true;
  sc.src = "https://gc.zgo.at/count.js";
  sc.setAttribute("data-goatcounter", "https://" + CONFIG.goatcounter + ".goatcounter.com/count");
  document.head.appendChild(sc);
}
function track(name) {
  if (!CONFIG.goatcounter || MODE !== "live") return;
  const send = () => window.goatcounter && window.goatcounter.count && window.goatcounter.count({ path: name, title: name, event: true });
  if (window.goatcounter && window.goatcounter.count) send(); else setTimeout(send, 1500);
}
setupCounter();

/* ---------- boot ---------- */
(async function boot() {
  round = await loadRound();
  if (!validRound(round)) { show("sEmpty"); return; }
  if (!round.date) round.date = dateStr(new Date());
  prevRound = await findPrevRound();
  wirePrevButtons();
  if (MODE === "live") {
    const saved = store.get(keyFor(round), null);
    picks = saved && Array.isArray(saved.picks) ? saved.picks.slice(0, round.questions.length) : [];
    if (picks.length === round.questions.length) { renderResult(); return; }
  }
  renderStart();
})();
