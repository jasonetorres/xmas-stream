import { campaign, siteUrl } from "./campaign.js";
import { bannerLines, tickerText } from "./ticker.js";
import { onAir, segmentRange } from "./schedule.js";
import { publicName } from "./giveaway.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const css = `
:root { --ground:#e7f6f4; --panel:#fffbed; --line:#c6dbcc; --cream:#254f55; --muted:#3e6866; --gold:#8a5a09; --red:#bd373b; }
* { box-sizing: border-box; }
body { margin:0; min-height:100vh; color:var(--cream); font-family:"JetBrains Mono",ui-monospace,monospace; font-size:16px; line-height:1.5; background:radial-gradient(ellipse at 85% 0%, #fff8d5 0, transparent 28%), linear-gradient(180deg, #8fd3f0 0%, #bce8ed 48%, #e6f6f4 100%); background-attachment:fixed; }
body.live { background:transparent; }
body.green { background:#00b140; color:#073018; }
a { color:var(--gold); }
.wrap { max-width:1080px; margin:0 auto; padding:28px 20px 64px; }
h1 { font-size:clamp(1.8rem,4vw,2.6rem); margin:8px 0; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
.card { padding:14px; border:2px solid var(--line); border-radius:22px; background:#fffbed; box-shadow:0 5px 0 #254f5512, 0 14px 28px #254f5514; }
.card img {
  width:100%; height:148px; object-fit:contain; border-radius:14px;
  background-color:#d7ece4;
  background-image:
    linear-gradient(45deg, #c5e0d6 25%, transparent 25%),
    linear-gradient(-45deg, #c5e0d6 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #c5e0d6 75%),
    linear-gradient(-45deg, transparent 75%, #c5e0d6 75%);
  background-size:16px 16px;
  background-position:0 0, 0 8px, 8px -8px, -8px 0;
}
.card a.btn, button.btn { display:inline-flex; align-items:center; min-height:44px; margin-top:8px; padding:0 14px; border-radius:999px; background:#fbd475; color:#254f55; text-decoration:none; font-weight:700; border:0; font:inherit; cursor:pointer; }
label { display:block; margin:12px 0; }
input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea { width:100%; min-height:48px; padding:10px 12px; border-radius:12px; border:2px solid var(--line); background:#fff; color:var(--cream); font:inherit; }
input[type="checkbox"], input[type="radio"] {
  appearance:none; -webkit-appearance:none; width:22px; height:22px; min-width:22px; min-height:22px; margin:0; flex:0 0 22px;
  border:2px solid var(--gold); background:#fff; display:grid; place-content:center; cursor:pointer;
}
input[type="checkbox"] { border-radius:6px; }
input[type="radio"] { border-radius:50%; }
input[type="checkbox"]:checked, input[type="radio"]:checked { background:#fbd475; }
input[type="checkbox"]:checked::before { content:""; width:5px; height:9px; border:solid #254f55; border-width:0 2px 2px 0; transform:rotate(45deg) translate(-1px,-1px); }
input[type="radio"]:checked::before { content:""; width:8px; height:8px; border-radius:50%; background:#254f55; }
input[type="checkbox"]:disabled { opacity:.45; cursor:not-allowed; }
label.prize {
  display:flex; align-items:center; justify-content:flex-start; gap:14px; width:100%; margin:8px 0; padding:12px 14px;
  min-height:56px; text-align:left; border:2px solid var(--line); border-radius:16px; background:#fff; cursor:pointer;
}
label.prize > span { display:flex; flex-direction:column; align-items:flex-start; text-align:left; gap:2px; min-width:0; }
label.prize b { font-weight:700; }
label.prize:has(input:disabled) { opacity:.55; cursor:not-allowed; }
.note { color:var(--muted); }
.l3 { position:fixed; left:0; right:0; bottom:42px; height:104px; display:flex; background:#fffbed; color:#254f55; }
.l3 .stripe { width:12px; flex:none; background:#bd373b; }
.l3-body { flex:1; min-width:0; display:flex; align-items:center; justify-content:space-between; padding:0 28px 0 22px; gap:24px; }
.l3 .eye { color:#8a5a09; font-size:18px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; line-height:1; }
.l3-title { margin-top:6px; font-size:40px; font-weight:700; line-height:1.05; }
.l3-aside { text-align:right; font-size:28px; font-weight:700; }
.banner { padding:12px 14px; border-radius:16px; background:#fff4d2; border:2px solid #fbd475; }
.hp { position:absolute; left:-9999px; }
.ticker { overflow:hidden; white-space:nowrap; background:#fffbed; color:#254f55; border-top:4px solid #fbd475; border-bottom:4px solid #fbd475; font-size:32px; line-height:64px; }
.ticker span { display:inline-block; padding-left:100%; animation:marquee 28s linear infinite; }
@keyframes marquee { to { transform:translateX(-100%); } }
.goal { max-width:960px; margin:8vh auto; padding:28px; border:2px solid #c6dbcc; border-radius:28px; background:#fffbed; box-shadow:0 8px 0 #254f5514; }
.bar { height:28px; border:2px solid #c6dbcc; border-radius:999px; overflow:hidden; background:#fff; }
.bar b { display:block; height:100%; background:#fbd475; }
.alert { position:fixed; left:32px; bottom:64px; padding:16px 18px; background:#fffbed; color:#254f55; border-left:8px solid #bd373b; border-radius:16px; box-shadow:0 8px 24px #254f5528; }
.up { min-height:100vh; display:flex; flex-direction:column; justify-content:flex-end; padding:36px 48px 72px; }
`;

function page(title, body, { live = false, mode = "" } = {}) {
  const cls = mode === "green" ? "green" : live ? "live" : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap">
<link rel="stylesheet" href="/theme.css">
<style>${css}</style></head><body class="${cls}">${body}</body></html>`;
}

export function renderGallery({ items, ticker, lines }) {
  const cards = items.map((item) => `<article class="card"><img src="/overlays/${esc(item.file)}" alt=""><h2>${esc(item.title)}</h2><a class="btn" href="/overlays/${esc(item.file)}" download>Download</a></article>`).join("");
  const banners = lines.map((line) => `<li>${esc(line)}</li>`).join("");
  const body = `<div class="wrap"><p class="note">StreamYard overlays · 1280×720</p><h1>Overlay pack</h1>
    <p class="note">Static PNG and GIF files for StreamYard. Bottom 42px of the frame stays clear for the ticker. Live boards are under <a href="/live/goal">/live</a> for screen share or OBS.</p>
    <p><a class="btn" href="/overlays/pack.zip">Download the whole pack</a></p>
    <h2>Ticker</h2>
    <p class="note">${ticker.length} characters. One line. Paste into a StreamYard banner with “Scroll across bottom” on.</p>
    <textarea id="ticker" rows="4" readonly>${esc(ticker)}</textarea>
    <button class="btn" type="button" id="copy">Copy ticker</button>
    <h2>Short banners</h2><ul>${banners}</ul>
    <h2>Images</h2><div class="grid">${cards}</div>
    <script>document.getElementById("copy").onclick=function(){navigator.clipboard.writeText(document.getElementById("ticker").value);this.textContent="Copied";}</script>
    </div>`;
  return page("Overlay pack", body);
}

export function renderRules({ prizes = [] } = {}) {
  const list = prizes.length
    ? `<ul>${prizes.map((prize) => `<li><b>${esc(prize.prize)}</b> from ${esc(prize.sponsor)}</li>`).join("")}</ul>`
    : "<p>The prizes are the ones listed on the entry page.</p>";
  const body = `<div class="wrap"><h1>Official rules</h1>
    <p>These are the rules for the giveaway on Jason Torres’s Birthday + Christmas Stream. The stream benefits freeCodeCamp.</p>
    <h2>Who can enter</h2>
    <p>Legal residents of the United States.</p>
    <p class="banner"><b>Jason, confirm this before the stream.</b> Placeholder, not a rule yet: the minimum age still needs your sign-off. Do not treat this sentence as an age limit.</p>
    <h2>When</h2>
    <p>Entries are open now. Each drawing closes when that prize is drawn live on Friday, December 18, 2026, from 2:00 to 8:00 PM ET.</p>
    <h2>No purchase necessary</h2>
    <p>No purchase or donation is necessary. Donating does not improve your odds.</p>
    <h2>How many entries</h2>
    <p>One entry per person. That is one entry per email, at <a href="/enter">/enter</a>.</p>
    <h2>Which drawings</h2>
    <p>You can enter any of the prize drawings, or all of them. Once you win one prize, you are removed from every remaining drawing. One win per person.</p>
    <h2>How winners are picked</h2>
    <p>Winners are picked at random and drawn live on the stream.</p>
    <h2>How to claim</h2>
    <p>Winners are contacted at the email they entered.</p>
    <p class="banner"><b>Jason, confirm this before the stream.</b> Placeholder, not a rule yet: the winner must respond within 72 hours. If there is no response, a new winner is drawn.</p>
    <h2>Prizes</h2>
    ${list}
    <h2>Who sends the prize</h2>
    <p>Sponsors provide the prizes and ship them. A prize can’t be transferred. There is no cash alternative.</p>
    <h2>Privacy</h2>
    <p>The email is used only to contact winners, and to share with a prize’s sponsor only if the entrant opted in.</p>
    <h2>Platforms</h2>
    <p>This giveaway is not affiliated with or endorsed by any platform, including X, YouTube, Twitch, or LinkedIn.</p>
    <h2>Contact</h2>
    <p><a href="mailto:jason.torres@jetbrains.com">jason.torres@jetbrains.com</a></p>
    <p><a href="/enter">Enter the giveaway</a></p></div>`;
  return page("Official rules", body);
}

export function renderEnter({ prizes, message, error }) {
  const boxes = prizes.map((prize) => `<label class="prize"><input type="checkbox" name="prize" value="${esc(prize.slug)}" ${prize.closed ? "disabled" : ""}><span><b>${esc(prize.prize)}</b><span class="note">${esc(prize.sponsor)}${prize.closed ? " · drawn" : ""}</span></span></label>`).join("");
  const flash = error ? `<p class="banner">${esc(error)}</p>` : message ? `<p class="banner">${esc(message)}</p>` : "";
  const body = `<div class="wrap"><p class="note">Friday, December 18, 2026</p><h1>Enter the giveaway</h1>
    <p class="banner">Open to US residents only.</p>
    <p class="banner">No purchase or donation is necessary. Donating does not add entries.</p>
    ${flash}
    <form method="post" action="/enter">
      <label class="prize"><input type="checkbox" name="us" value="yes" required><span>I live in the United States</span></label>
      <label>Name<input name="name" required maxlength="80" autocomplete="name"></label>
      <label>Email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
      <label>X or other handle, optional<input name="handle" maxlength="40" placeholder="without @"></label>
      <label class="prize"><input type="checkbox" name="all" value="yes"><span>Enter me in every prize that is still open</span></label>
      ${boxes}
      <label class="prize"><input type="checkbox" name="share" value="yes"><span>Share my info with the sponsor of prizes I enter.</span></label>
      <label class="hp">Company<input name="company_site" tabindex="-1" autocomplete="off"></label>
      <button class="btn" type="submit">Enter</button>
    </form>
    <p class="note"><a href="/rules">Official rules</a></p></div>`;
  return page("Enter the giveaway", body);
}

export function renderDraw({ prizes, counts, log, reveal, error }) {
  const buttons = prizes.map((prize) => {
    const pool = counts?.get?.(prize.slug) ?? 0;
    return `<form method="post" action="/draw" style="margin:8px 0"><input type="hidden" name="prize" value="${esc(prize.slug)}"><button class="btn" type="submit">${esc(prize.prize)} · ${esc(prize.sponsor)} · ${pool} in the pool${prize.closed ? " · drawn" : ""}</button>${prize.closed ? `<button class="btn" name="redraw" value="yes" type="submit">Re-draw</button>` : ""}</form>`;
  }).join("");
  const rows = (log || []).map((row) => `<li>${esc(row.display_name)} · ${esc(row.prize_slug)} · ${esc(row.status)} · ${esc(row.drawn_at)}</li>`).join("");
  const show = reveal ? `<section id="reveal" data-winner="${esc(reveal.display)}" data-names="${esc(JSON.stringify(reveal.decoys || []))}" style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div id="spin" style="font-size:64px;font-weight:700">…</div>
      <div id="prize" style="display:none;font-size:28px;color:#cdbf98"></div>
      <canvas id="confetti" width="800" height="300"></canvas>
    </section>
    <script>
      const winner = document.getElementById("reveal").dataset.winner;
      const names = JSON.parse(document.getElementById("reveal").dataset.names || "[]");
      const reel = names.concat([winner, winner]);
      const spin = document.getElementById("spin");
      let i = 0; let delay = 40;
      function tick(){ spin.textContent = reel[i % reel.length]; i++; delay = Math.min(420, delay + 18); if (delay < 420) setTimeout(tick, delay); else { spin.textContent = winner; document.getElementById("prize").style.display="block"; document.getElementById("prize").textContent = ${JSON.stringify(reveal.prize.prize + " · " + reveal.prize.sponsor)}; burst(); } }
      function burst(){ const c=document.getElementById("confetti"); const x=c.getContext("2d"); const bits=Array.from({length:80},()=>({x:Math.random()*800,y:0,v:2+Math.random()*4,color:Math.random()>.5?"#f2b33d":"#f5e6b8"})); function frame(){ x.clearRect(0,0,800,300); bits.forEach(b=>{ b.y+=b.v; x.fillStyle=b.color; x.fillRect(b.x,b.y,6,8); }); if(bits.some(b=>b.y<300)) requestAnimationFrame(frame);} frame(); }
      tick();
    </script>` : "";
  const body = `<div class="wrap"><h1>Draw a winner</h1>${error ? `<p class="banner">${esc(error)}</p>` : ""}<p class="note">The screen shows a first name and last initial, or a handle. Email stays off this page.</p>${show}${buttons}
    <h2>Winner card</h2>
    <form method="get" action="/draw/card"><label>Name on the lower third<input name="name" maxlength="40"></label><label>Prize<input name="prize" maxlength="80"></label><button class="btn" type="submit">Open overlay</button></form>
    <p><a href="/admin/giveaway.csv">Export entrants</a></p>
    <h2>Log</h2><ul>${rows || "<li>No draws yet.</li>"}</ul></div>`;
  return page("Draw", body);
}

export function renderWinnerCard({ name, prize, mode }) {
  const aside = prize ? `<div class="l3-aside">${esc(prize)}</div>` : "";
  const body = `<div class="l3"><div class="stripe"></div><div class="l3-body"><div><div class="eye">Winner</div><div class="l3-title">${esc(name || "Winner!")}</div></div>${aside}</div></div>`;
  return page("Winner", body, { live: true, mode });
}

export function renderLiveGoal(mode) {
  const body = `<div class="goal"><div style="letter-spacing:.14em;text-transform:uppercase;color:#8a5a09">freeCodeCamp</div><h1 id="raised">$0</h1><div class="bar"><b id="fill" style="width:0"></b></div><p id="meta"></p></div>
    <script>
      async function pull(){
        var raised=0, goal=10000, live=false;
        try {
          const res=await fetch("/api/live/goal",{cache:"no-store"});
          if(!res.ok) throw new Error("goal");
          const data=await res.json();
          raised=Math.max(0,Math.round(Number(data.raised)||0));
          goal=Math.max(1,Math.round(Number(data.goal)||10000));
          live=data.source==="tiltify";
        } catch (e) { raised=0; goal=10000; live=false; }
        document.getElementById("raised").textContent="$"+raised.toLocaleString("en-US");
        document.getElementById("fill").style.width=Math.min(100,Math.round(raised/goal*100))+"%";
        document.getElementById("meta").textContent="of $"+goal.toLocaleString("en-US")+(live?" · live from Tiltify":"");
      }
      pull(); setInterval(pull, 15000);
    </script>`;
  return page("Goal", body, { live: false, mode });
}

export function renderLiveAlerts(mode) {
  const body = `<div id="stack"></div><script>
    const seen=new Set();
    async function pull(){ const res=await fetch("/api/live/goal"); const data=await res.json(); (data.donations||[]).slice().reverse().forEach(row=>{ if(seen.has(row.id)) return; seen.add(row.id); const el=document.createElement("div"); el.className="alert"; el.textContent=row.name+" donated $"+Math.round(row.amount||0).toLocaleString("en-US"); document.body.appendChild(el); setTimeout(()=>el.remove(), 8000); }); }
    pull(); setInterval(pull, 8000);
  </script>`;
  return page("Alerts", body, { live: true, mode });
}

export function renderLiveTicker(mode, line) {
  const body = `<div class="ticker"><span id="line">${esc(line)}</span></div><script>
    const base = ${JSON.stringify(line)};
    async function pull(){
      var raised=0;
      try {
        const res=await fetch("/api/live/goal",{cache:"no-store"});
        if(!res.ok) throw new Error("goal");
        const data=await res.json();
        raised=Math.max(0,Math.round(Number(data.raised)||0));
      } catch (e) { raised=0; }
      document.getElementById("line").textContent="$"+raised.toLocaleString("en-US")+" raised for freeCodeCamp · "+base;
    }
    pull(); setInterval(pull, 15000);
  </script>`;
  return page("Ticker", body, { live: true, mode });
}

export function renderUpNext(mode, air, guestNote = "") {
  const current = air.current ? `${air.current.name} · ${segmentRange(air.current)}` : air.phase === "after" ? "Thanks for watching" : "Starting soon";
  const next = air.next ? `Up next: ${air.next.name} · ${segmentRange(air.next)}` : "";
  const guest = guestNote ? `<div style="margin-top:12px;font-size:32px;color:#8a5a09">${esc(guestNote)}</div>` : "";
  const body = `<div class="up"><div style="color:#8a5a09;letter-spacing:.14em;text-transform:uppercase">${air.phase === "live" ? "On now" : "Stream"}</div><div style="font-size:54px;font-weight:700;max-width:1000px">${esc(current)}</div><div style="font-size:28px;color:#3e6866">${esc(next)}</div>${guest}</div>`;
  return page("Up next", body, { live: false, mode });
}

export function modeFrom(url) {
  return url.searchParams.get("mode") === "green" ? "green" : "";
}

export function galleryCopy(sponsors) {
  return { ticker: tickerText(sponsors), lines: bannerLines() };
}

export const enterUrl = `${siteUrl}/enter`;
export const donateUrl = campaign.tiltifyUrl;

export function safeDisplay(name) {
  return publicName({ name, handle: "" });
}
