import { campaign, siteUrl } from "./campaign.js";
import { bannerLines, tickerText } from "./ticker.js";
import { onAir, segmentRange } from "./schedule.js";
import { publicName } from "./giveaway.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const css = `
:root { --ground:#17110d; --panel:#221a14; --line:rgba(245,230,184,.22); --cream:#f5e6b8; --muted:#cdbf98; --gold:#f2b33d; --red:#c8322b; }
* { box-sizing: border-box; }
body { margin:0; background:var(--ground); color:var(--cream); font-family:"JetBrains Mono",ui-monospace,monospace; font-size:16px; line-height:1.5; }
body.live { background:transparent; }
body.green { background:#00b140; }
a { color:var(--gold); }
.wrap { max-width:1080px; margin:0 auto; padding:28px 20px 64px; }
h1 { font-size:clamp(1.8rem,4vw,2.6rem); margin:8px 0; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
.card { padding:14px; border:1px solid var(--line); border-radius:16px; background:rgba(0,0,0,.2); }
.card img { width:100%; height:135px; object-fit:contain; background:#0e0b09; border-radius:10px; }
.card a.btn, button.btn { display:inline-flex; align-items:center; min-height:44px; margin-top:8px; padding:0 14px; border-radius:999px; background:var(--gold); color:#17110d; text-decoration:none; font-weight:700; border:0; font:inherit; cursor:pointer; }
label { display:block; margin:12px 0; }
input, textarea { width:100%; min-height:48px; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:#100d0b; color:var(--cream); font:inherit; }
.prize { display:flex; gap:10px; align-items:flex-start; }
.note { color:var(--muted); }
.banner { padding:12px 14px; border-radius:12px; background:rgba(242,179,61,.12); }
.hp { position:absolute; left:-9999px; }
.ticker { overflow:hidden; white-space:nowrap; border-top:4px solid var(--gold); border-bottom:4px solid var(--gold); font-size:32px; line-height:64px; }
.ticker span { display:inline-block; padding-left:100%; animation:marquee 28s linear infinite; }
@keyframes marquee { to { transform:translateX(-100%); } }
.goal { max-width:960px; margin:8vh auto; padding:28px; }
.bar { height:28px; border:2px solid var(--gold); border-radius:999px; overflow:hidden; }
.bar b { display:block; height:100%; background:var(--gold); }
.alert { position:fixed; left:32px; bottom:64px; padding:16px 18px; background:rgba(23,17,13,.92); border-left:8px solid var(--gold); border-radius:12px; }
.up { min-height:100vh; display:flex; flex-direction:column; justify-content:flex-end; padding:36px 48px 72px; }
`;

function page(title, body, { live = false, mode = "" } = {}) {
  const cls = mode === "green" ? "green" : live ? "live" : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap">
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

export function renderRules() {
  const body = `<div class="wrap"><h1>Giveaway rules</h1>
    <p class="banner">No purchase or donation is necessary. A donation does not raise your odds.</p>
    <h2>Who can enter</h2>
    <p class="banner"><b>Jason, confirm this before the stream.</b> Placeholder, not a rule yet: age and region still need your sign-off. Do not treat this sentence as eligibility.</p>
    <h2>How to enter</h2>
    <p>One entry per email at <a href="/enter">/enter</a>. You can enter specific prizes or every prize that is still open. Entries close for a prize when that prize is drawn.</p>
    <h2>How a winner is picked</h2>
    <p>Jason draws on the admin page. The app picks one random eligible entrant with a cryptographic random number. A person who has already won is not drawn again. If a winner does not respond, Jason can re-draw that prize. The new draw is logged with a timestamp.</p>
    <h2>How to claim</h2>
    <p>Jason contacts the winner using the email or handle on the entry. The winner replies to confirm. The prize is the one shown on the stream. Shipping details are collected after the win, not on the public entry form.</p>
    <h2>Sponsor opt-in</h2>
    <p>A separate checkbox asks if the entry may be shared with the sponsor of the prizes you enter. It is off unless you check it. That list is the sponsor’s opt-in lead CSV.</p>
    <p><a href="/enter">Enter the giveaway</a></p></div>`;
  return page("Giveaway rules", body);
}

export function renderEnter({ prizes, message, error }) {
  const boxes = prizes.map((prize) => `<label class="prize"><input type="checkbox" name="prize" value="${esc(prize.slug)}" ${prize.closed ? "disabled" : ""}><span><b>${esc(prize.prize)}</b><br><span class="note">${esc(prize.sponsor)}${prize.closed ? " · drawn" : ""}</span></span></label>`).join("");
  const flash = error ? `<p class="banner">${esc(error)}</p>` : message ? `<p class="banner">${esc(message)}</p>` : "";
  const body = `<div class="wrap"><p class="note">Friday, December 18, 2026</p><h1>Enter the giveaway</h1>
    <p class="banner">No purchase or donation is necessary. Donating does not add entries.</p>
    ${flash}
    <form method="post" action="/enter">
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

export function renderDraw({ prizes, log, reveal, error }) {
  const buttons = prizes.map((prize) => `<form method="post" action="/draw" style="margin:8px 0"><input type="hidden" name="prize" value="${esc(prize.slug)}"><button class="btn" type="submit">${esc(prize.prize)} · ${esc(prize.sponsor)}${prize.closed ? " · drawn" : ""}</button>${prize.closed ? `<button class="btn" name="redraw" value="yes" type="submit">Re-draw</button>` : ""}</form>`).join("");
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
  const body = `<div style="min-height:100vh;display:flex;align-items:flex-end;padding:48px"><div style="padding:18px 22px;background:rgba(23,17,13,.94);border-left:8px solid #f2b33d;border-radius:14px">
    <div style="color:#f2b33d;letter-spacing:.14em;text-transform:uppercase">Winner</div>
    <div style="font-size:64px;font-weight:700">${esc(name || "Winner!")}</div>
    <div style="font-size:28px;color:#cdbf98">${esc(prize || "")}</div></div></div>`;
  return page("Winner", body, { live: true, mode });
}

export function renderLiveGoal(mode) {
  const body = `<div class="goal"><div style="letter-spacing:.14em;text-transform:uppercase;color:#f2b33d">freeCodeCamp</div><h1 id="raised">$0</h1><div class="bar"><b id="fill" style="width:0"></b></div><p id="meta"></p></div>
    <script>
      async function pull(){ const res=await fetch("/api/live/goal"); const data=await res.json(); const raised=Math.round(data.raised||0); const goal=Math.round(data.goal||10000); document.getElementById("raised").textContent="$"+raised.toLocaleString("en-US"); document.getElementById("fill").style.width=Math.min(100,Math.round(raised/goal*100))+"%"; document.getElementById("meta").textContent="of $"+goal.toLocaleString("en-US")+" · "+(data.source==="tiltify"?"live from Tiltify":"site total until Tiltify is connected"); }
      pull(); setInterval(pull, 15000);
    </script>`;
  return page("Goal", body, { live: true, mode });
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
    async function pull(){ const res=await fetch("/api/live/goal"); const data=await res.json(); const raised=Math.round(data.raised||0).toLocaleString("en-US"); document.getElementById("line").textContent="$"+raised+" raised for freeCodeCamp · "+base; }
    pull(); setInterval(pull, 20000);
  </script>`;
  return page("Ticker", body, { live: true, mode });
}

export function renderUpNext(mode, air, guestNote = "") {
  const current = air.current ? `${air.current.name} · ${segmentRange(air.current)}` : air.phase === "after" ? "Thanks for watching" : "Starting soon";
  const next = air.next ? `Up next: ${air.next.name} · ${segmentRange(air.next)}` : "";
  const guest = guestNote ? `<div style="margin-top:12px;font-size:32px;color:#f2b33d">${esc(guestNote)}</div>` : "";
  const body = `<div class="up"><div style="color:#f2b33d;letter-spacing:.14em;text-transform:uppercase">${air.phase === "live" ? "On now" : "Stream"}</div><div style="font-size:54px;font-weight:700;max-width:1000px">${esc(current)}</div><div style="font-size:28px;color:#cdbf98">${esc(next)}</div>${guest}</div>`;
  return page("Up next", body, { live: true, mode });
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
