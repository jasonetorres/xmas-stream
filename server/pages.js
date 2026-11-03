import { durationFor, segmentSummary, spotLines, tierLabel } from "./domain.js";
import { ASSETS_DUE, STREAM_DAY, STREAM_END, STREAM_START, WINDOW_LABEL, formatClock, formatRange, gridStarts } from "./time.js";

const SAVED = {
  booked: "Booked. That block is yours.",
  released: "Your block is released.",
  assets: "Assets saved.",
  logo: "Logo removed.",
  added: "Sponsor added. Copy their private link and send it over.",
  invite: "The old link no longer works. Copy the new one.",
  override: "Booking updated.",
  removed: "Sponsor removed.",
  edited: "Sponsor updated.",
};

export function flashFrom(url) {
  const key = url.searchParams.get("saved") || "";
  let error = url.searchParams.get("error") || "";
  if (error.length > 300 || /[\u0000-\u0008]/.test(error)) error = "";
  return { saved: SAVED[key] || "", error };
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function shell({ title, body, wide }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,500..900,0..100;1,9..144,500..900,0..100&family=Oswald:wght@400..700&display=swap">
<style>
:root {
  --ground: #17110d; --panel: #221a14; --line: rgba(245, 230, 184, 0.22);
  --cream: #f5e6b8; --muted: #cdbf98; --gold: #f2b33d; --red: #c8322b;
  --display: "Fraunces", Georgia, serif; --label: "Oswald", "Arial Narrow", Impact, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--cream);
  font-family: var(--display); font-size: 18px; line-height: 1.5;
  background-image: radial-gradient(ellipse at 50% -10%, #3a2a1d 0%, var(--ground) 55%);
  background-repeat: no-repeat; min-height: 100vh;
}
a { color: var(--gold); }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
.gutter { padding-left: max(20px, env(safe-area-inset-left, 0px)); padding-right: max(20px, env(safe-area-inset-right, 0px)); }
.wrap { max-width: ${wide ? "1040px" : "880px"}; margin: 0 auto; }
.label { font-family: var(--label); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 600; }
h1, h2, h3 { margin: 0; font-variation-settings: "SOFT" 100, "opsz" 144; text-wrap: balance; }
.mast { padding-block: 18px 12px; border-bottom: 4px double var(--line); }
.mast .wrap { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 18px; }
.mast-name { font-weight: 900; font-style: italic; font-size: 1.5rem; text-decoration: none; color: var(--cream); }
.mast-meta { color: var(--muted); font-size: 0.82rem; }
main { padding-block: 32px 64px; }
.kicker { color: var(--gold); font-size: 0.95rem; }
h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 0.98; font-weight: 900; letter-spacing: -0.02em; }
h1 em { font-style: italic; color: var(--gold); }
.lede { color: var(--muted); max-width: 62ch; }
.panel { background: var(--panel); border: 2px solid var(--line); border-radius: 16px; padding: 20px; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.btn, button.btn {
  display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 18px;
  border-radius: 999px; text-decoration: none; font-family: var(--label); text-transform: uppercase;
  letter-spacing: 0.1em; font-weight: 600; font-size: 0.95rem; border: 2px solid transparent; cursor: pointer;
  background: transparent; color: var(--cream);
}
.btn-gold { background: var(--gold); color: var(--ground); }
.btn-ghost { border-color: var(--cream); color: var(--cream); background: transparent; }
.btn-tiny { min-height: 40px; padding: 0 12px; font-size: 0.82rem; }
.banner { padding: 12px 14px; border-radius: 12px; }
.banner.ok { background: rgba(242, 179, 61, 0.12); border: 2px solid var(--gold); }
.banner.bad { background: rgba(200, 50, 43, 0.18); border: 2px solid var(--red); }
.banner.warn { background: rgba(200, 50, 43, 0.12); border: 2px solid var(--line); color: var(--muted); }
label.field, .field { display: flex; flex-direction: column; gap: 6px; }
.field span, legend { font-family: var(--label); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.82rem; color: var(--gold); }
input, select, textarea {
  width: 100%; padding: 12px 14px; border-radius: 10px; border: 2px solid var(--line);
  background: #140f0c; color: var(--cream); font: inherit; font-size: 1rem;
}
textarea { min-height: 110px; resize: vertical; }
input.code { font-family: var(--label); letter-spacing: 0.14em; font-size: 1.25rem; text-transform: lowercase; }
.hint, .quiet { color: var(--muted); margin: 0; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.board { border: 2px solid var(--line); border-radius: 14px; overflow: hidden; background: rgba(0,0,0,0.2); }
.slot { display: grid; grid-template-columns: 96px 1fr; gap: 10px; align-items: center; padding: 10px 12px; border-top: 1px solid var(--line); }
.slot:first-child { border-top: 0; }
.slot time { font-family: var(--label); letter-spacing: 0.06em; font-size: 0.95rem; }
.slot label.pick { display: flex; gap: 10px; align-items: flex-start; min-height: 44px; }
.slot label.pick input { width: auto; margin-top: 4px; accent-color: var(--gold); }
.slot.mine { background: rgba(242, 179, 61, 0.08); }
.slot.taken { color: var(--muted); }
.check { display: flex; gap: 10px; align-items: flex-start; }
.check input { width: auto; margin-top: 6px; accent-color: var(--gold); }
fieldset { border: 2px solid var(--line); border-radius: 14px; margin: 0; padding: 14px 16px 16px; }
.meter { height: 10px; border-radius: 999px; background: rgba(245, 230, 184, 0.12); overflow: hidden; }
.meter span { display: block; height: 100%; background: var(--gold); }
.logos { display: flex; flex-wrap: wrap; gap: 10px; }
.logo-tile { background: var(--cream); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.logo-tile img { display: block; max-height: 56px; max-width: 200px; width: auto; height: auto; object-fit: contain; }
.card { display: flex; flex-direction: column; gap: 12px; }
.card h2 { font-size: 1.7rem; }
.tier { font-family: var(--label); letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); font-size: 0.85rem; }
.split { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; align-items: baseline; }
.miss { margin: 0; padding-left: 18px; color: var(--muted); }
footer { border-top: 4px double var(--line); padding-block: 18px 28px; color: var(--muted); font-size: 0.92rem; }
footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; }
.stamp { display: inline-flex; align-self: flex-start; gap: 10px; align-items: center; padding: 8px 12px; background: var(--red); color: #fff6e0; transform: rotate(-1deg); }
.stamp b { font-size: 1.05rem; }
details { border-top: 1px solid var(--line); padding-top: 10px; }
summary { cursor: pointer; color: var(--gold); font-family: var(--label); letter-spacing: 0.08em; text-transform: uppercase; }
.link-label input { font-size: 0.92rem; }
@media (max-width: 720px) {
  .grid-2 { grid-template-columns: 1fr; }
  .slot { grid-template-columns: 1fr; gap: 4px; }
}
</style>
</head>
<body>
<header class="mast gutter"><div class="wrap">
  <a class="mast-name" href="/">Stream Weekly</a>
  <span class="mast-meta label">${esc(STREAM_DAY)} · ${esc(WINDOW_LABEL)}</span>
  <a class="label" href="/portal" style="color:var(--cream);text-decoration:none;font-size:0.82rem">Sponsor portal</a>
</div></header>
<main class="gutter"><div class="wrap stack">
${body}
</div></main>
<footer class="gutter"><div class="wrap">
  <span>Assets due ${esc(ASSETS_DUE)}</span>
  <span>${esc(STREAM_DAY)} · ${esc(WINDOW_LABEL)}</span>
</div></footer>
<script>
document.querySelectorAll("[data-copy]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var input = document.getElementById(btn.getAttribute("data-copy"));
    if (!input) return;
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy link"; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(done, function () { input.select(); done(); });
    else { input.select(); done(); }
  });
});
</script>
</body>
</html>`;
}

function banners({ saved, error }) {
  return `${error ? `<div class="banner bad" role="alert">${esc(error)}</div>` : ""}${saved ? `<div class="banner ok" role="status">${esc(saved)}</div>` : ""}`;
}

export function renderLogin({ flash }) {
  const body = `
${banners(flash)}
<p class="kicker label">Private · sponsors only</p>
<h1>Sponsor <em>portal</em></h1>
<p class="lede">Book your block on ${esc(STREAM_DAY)}, ${esc(WINDOW_LABEL)}, and send the assets Jason needs by ${esc(ASSETS_DUE)}. Open the private link he sent you, or paste the code from it.</p>
<form class="panel stack" method="post" action="/portal/login">
  <label class="field"><span>Invite code</span>
    <input class="code" name="code" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" required autofocus>
  </label>
  <button class="btn btn-gold" type="submit">Enter</button>
</form>`;
  return shell({ title: "Sponsor portal · Jason’s Christmas Birthday Stream", body });
}

export function renderDenied() {
  const body = `
<h1>That’s Jason’s <em>desk</em></h1>
<p class="lede">Sponsor logins land on your own page. The admin desk needs Jason’s code.</p>
<p><a class="btn btn-gold" href="/portal">Back to your page</a></p>`;
  return shell({ title: "Admin · Sponsor portal", body });
}

function assetBlock(sponsor) {
  const report = sponsor.assets;
  const width = Math.round((report.done / report.total) * 100);
  const logos = sponsor.logos
    .map(
      (logo) => `<div class="logo-tile">
        <img src="/portal/logos/${logo.id}" alt="${esc(sponsor.name)} logo">
        <button class="btn btn-ghost btn-tiny" type="submit" name="logo_id" value="${logo.id}" form="remove-${logo.id}">Remove</button>
      </div>`
    )
    .join("");
  const removes = sponsor.logos
    .map((logo) => `<form id="remove-${logo.id}" method="post" action="/portal/logos/remove"><input type="hidden" name="logo_id" value="${logo.id}"></form>`)
    .join("");
  return `<section class="panel stack" aria-labelledby="assets-h">
    <div class="split">
      <h2 id="assets-h">Assets</h2>
      <span class="tier">${report.complete ? "Complete" : `${report.done}/${report.total}`} · due ${esc(ASSETS_DUE)}</span>
    </div>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${report.total}" aria-valuenow="${report.done}" aria-label="Assets ${report.done} of ${report.total}"><span style="width:${width}%"></span></div>
    ${report.complete ? `<p class="quiet">Jason has everything he needs.</p>` : `<p class="quiet">Still needed: ${esc(report.missing.join(", "))}.</p>`}
    ${removes}
    ${logos ? `<div class="logos">${logos}</div>` : ""}
    <form class="stack" method="post" action="/portal/assets" enctype="multipart/form-data">
      <label class="field"><span>Logo</span>
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple>
      </label>
      <p class="hint">PNG, JPG, WEBP, GIF, or a plain SVG. Up to two files, 1.5 MB each. A mark and a wordmark are perfect. Leave this empty to keep what’s already on file.</p>
      <label class="field"><span>One URL</span><input name="url" type="url" inputmode="url" value="${esc(sponsor.url)}" placeholder="https://"></label>
      <label class="field"><span>Talking points</span><textarea name="talking_points" maxlength="5000">${esc(sponsor.talking_points)}</textarea></label>
      <div class="grid-2">
        <label class="field"><span>Prize or cash details</span><textarea name="prize_details">${esc(sponsor.prize_details)}</textarea></label>
        <label class="field"><span>Shipping and fulfillment</span><textarea name="shipping" placeholder="Where it ships from, who fulfills it, or “cash only, nothing to ship.”">${esc(sponsor.shipping)}</textarea></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>X handle</span><input name="x_handle" value="${esc(sponsor.x_handle)}" placeholder="without the @" maxlength="15"></label>
        <label class="field"><span>How should we credit you?</span><input name="credit" value="${esc(sponsor.credit)}" maxlength="200" placeholder="Name on the lower third and the thank-you wall"></label>
      </div>
      <button class="btn btn-gold" type="submit">Save assets</button>
    </form>
  </section>`;
}

function bookingBlock(sponsor) {
  const duration = durationFor(sponsor.tier);
  if (!duration) {
    return `<section class="panel stack"><h2>No time block</h2><p class="quiet">${esc(tierLabel(sponsor.tier))} sponsors don’t book a slot. Send your logo and logistics below and Jason will thank you on the wall.</p></section>`;
  }
  const rows = sponsor.rows
    .map((row) => {
      let detail = "";
      if (row.selectable) {
        detail = `<label class="pick"><input type="radio" name="start" value="${row.start}" ${row.current ? "checked" : ""}><span><b>${esc(row.range)}</b>${row.current ? " · your block" : row.own ? " · move here" : " · open"}</span></label>`;
      } else if (row.covering && !row.own) {
        const extra = segmentSummary(row.covering);
        detail = `<span><b>${esc(row.covering.name)}</b> · ${esc(formatRange(row.covering.start_min, row.covering.end_min))}${extra ? ` · ${esc(extra)}` : ""}</span>`;
      } else if (row.reason) {
        detail = `<span>${esc(row.reason)}</span>`;
      } else if (row.own) {
        detail = `<span>Your block continues until ${esc(formatClock(row.covering.end_min))}</span>`;
      } else {
        detail = `<span>Open</span>`;
      }
      const cls = row.own ? "mine" : row.covering ? "taken" : "";
      return `<div class="slot ${cls}"><time datetime="2026-12-18T${String(Math.floor(row.start / 60)).padStart(2, "0")}:${String(row.start % 60).padStart(2, "0")}:00-05:00">${esc(row.label)}</time><div>${detail}</div></div>`;
    })
    .join("");
  const booking = sponsor.booking;
  const mine = booking ? `<div class="banner ok"><b>You’re on ${esc(formatRange(booking.start_min, booking.end_min))}.</b>${segmentSummary(booking) ? ` ${esc(segmentSummary(booking))}.` : ""}</div>` : `<p class="quiet">Nothing booked yet. First open block wins.</p>`;
  const segments =
    sponsor.tier === "platinum"
      ? `<fieldset><legend>Named segment</legend><div class="stack">
          <label class="check"><input type="checkbox" name="gift_drop" ${Number(booking?.gift_drop) ? "checked" : ""}> <span>Gift Drop · your guest draws that hour’s winner live</span></label>
          <label class="check"><input type="checkbox" name="hot_seat" ${Number(booking?.hot_seat) ? "checked" : ""}> <span>Hot Seat · a 10-minute holiday chat with someone from your team</span></label>
          <label class="field"><span>Guest name</span><input name="guest_name" value="${esc(booking?.guest_name || "")}" maxlength="80"></label>
        </div></fieldset>`
      : "";
  const early =
    sponsor.not_before != null ? `<p class="quiet">You asked to go on at ${esc(formatClock(sponsor.not_before))} ET or later.</p>` : "";
  return `<section class="stack" aria-labelledby="book-h">
    <div class="split"><h2 id="book-h">${duration === 60 ? "Book 1 hour" : "Book 30 minutes"}</h2><span class="tier">${esc(WINDOW_LABEL)} · 30-minute grid</span></div>
    ${early}
    ${mine}
    <form class="stack" method="post" action="/portal/booking">
      ${segments}
      <div class="board">${rows}</div>
      <div class="row">
        <button class="btn btn-gold" type="submit" name="action" value="book">Book this block</button>
        ${booking ? `<button class="btn btn-ghost" type="submit" name="action" value="release">Release my block</button>` : ""}
      </div>
    </form>
  </section>`;
}

export function renderSponsor({ sponsor, flash }) {
  const who = sponsor.contact_name ? `${sponsor.name} · ${sponsor.contact_name}` : sponsor.name;
  const body = `
${banners(flash)}
<p class="kicker label">${esc(tierLabel(sponsor.tier))} sponsor</p>
<div class="split"><h1>${esc(who)}</h1><form method="post" action="/portal/logout"><button class="btn btn-ghost btn-tiny" type="submit">Log out</button></form></div>
<p class="lede">${esc(STREAM_DAY)}, ${esc(WINDOW_LABEL)}. Raising $10,000. Platinum holds a 1-hour block. Gold holds 30 minutes. Overlaps are refused.</p>
<div class="stamp label"><span>Assets due</span><b>${esc(ASSETS_DUE)}</b></div>
${bookingBlock(sponsor)}
${assetBlock(sponsor)}`;
  return shell({ title: `${sponsor.name} · Sponsor portal`, body });
}

function earliestOptions(selected) {
  let html = `<option value="">Any time in the window</option>`;
  for (let t = STREAM_START; t < STREAM_END; t += 30) {
    html += `<option value="${t}"${selected === t ? " selected" : ""}>${esc(formatClock(t))} ET or later</option>`;
  }
  return html;
}

const HINTS = {
  torc: "On the public logo wall this is Randstad, powered by Torc.",
  tighten: "CEO Matt. The mark and the wordmark are already on file.",
};

function adminCard(sponsor, base) {
  const booking = sponsor.booking;
  const block = booking ? `Booked · ${formatRange(booking.start_min, booking.end_min)}` : "No block booked";
  const extra = segmentSummary(booking);
  const by = booking && booking.set_by === "admin" ? " Jason set this." : "";
  const report = sponsor.assets;
  const link = sponsor.inviteCode ? `${base}/portal/i/${sponsor.inviteCode}` : "";
  const duration = durationFor(sponsor.tier);
  let bookForm = `<p class="quiet">No stream block at the ${esc(tierLabel(sponsor.tier))} tier. Assets only.</p>`;
  if (duration) {
    let options = `<option value="">No block</option>`;
    for (const start of gridStarts(duration)) {
      const selected = booking && booking.start_min === start ? " selected" : "";
      options += `<option value="${start}"${selected}>${esc(formatRange(start, start + duration))}</option>`;
    }
    const segments =
      sponsor.tier === "platinum"
        ? `<label class="check"><input type="checkbox" name="gift_drop" ${Number(booking?.gift_drop) ? "checked" : ""}> Gift Drop</label>
           <label class="check"><input type="checkbox" name="hot_seat" ${Number(booking?.hot_seat) ? "checked" : ""}> Hot Seat</label>
           <label class="field"><span>Guest</span><input name="guest_name" value="${esc(booking?.guest_name || "")}" maxlength="80"></label>`
        : "";
    bookForm = `<form class="stack" method="post" action="/portal/admin/booking">
      <input type="hidden" name="sponsor_id" value="${sponsor.id}">
      <label class="field"><span>Block</span><select name="start">${options}</select></label>
      ${segments}
      <label class="check"><input type="checkbox" name="force" value="yes"> Take it even if someone else has it. Their booking will be cleared.</label>
      <button class="btn btn-gold btn-tiny" type="submit">Save booking</button>
    </form>`;
  }
  const handle = sponsor.x_handle ? ` · @${sponsor.x_handle}` : "";
  const hint = HINTS[sponsor.slug] ? `<p class="quiet">${esc(HINTS[sponsor.slug])}</p>` : "";
  const early = sponsor.not_before != null ? `<p class="quiet">Earliest ${esc(formatClock(sponsor.not_before))} ET.</p>` : "";
  return `<article class="panel card" id="sponsor-${esc(sponsor.slug)}" data-sponsor="${esc(sponsor.slug)}">
    <div class="split">
      <h2>${esc(sponsor.name)}</h2>
      <span class="tier">${esc(tierLabel(sponsor.tier))}${esc(handle)}</span>
    </div>
    <p><b>${esc(block)}</b>${extra ? ` · ${esc(extra)}` : ""}${esc(by)}</p>
    ${early}
    ${hint}
    <p class="quiet">${sponsor.contact_name ? `${esc(sponsor.contact_name)} · ` : ""}${esc(sponsor.prize_details || "No prize noted yet")}</p>
    <p><b>${report.complete ? "Complete" : `${report.done}/${report.total}`}</b>${report.missing.length ? ` · still needs ${esc(report.missing.join(", "))}` : " · assets are in"}</p>
    ${sponsor.logos.length ? `<div class="logos">${sponsor.logos.map((logo) => `<div class="logo-tile"><img src="/portal/logos/${logo.id}" alt=""></div>`).join("")}</div>` : ""}
    ${link ? `<label class="field link-label"><span>Private link</span><input id="link-${esc(sponsor.slug)}" readonly value="${esc(link)}"></label>
      <div class="row">
        <button class="btn btn-ghost btn-tiny" type="button" data-copy="link-${esc(sponsor.slug)}">Copy link</button>
        <form method="post" action="/portal/admin/invite"><input type="hidden" name="sponsor_id" value="${sponsor.id}"><button class="btn btn-ghost btn-tiny" type="submit">New link</button></form>
      </div>` : `<p class="quiet">This link can’t be shown. Generate a new one.</p>
      <form method="post" action="/portal/admin/invite"><input type="hidden" name="sponsor_id" value="${sponsor.id}"><button class="btn btn-ghost btn-tiny" type="submit">New link</button></form>`}
    <details>
      <summary>Override booking</summary>
      <div class="stack" style="padding-top:12px">${bookForm}</div>
    </details>
    <details>
      <summary>Edit sponsor</summary>
      <form class="stack" style="padding-top:12px" method="post" action="/portal/admin/sponsor">
        <input type="hidden" name="sponsor_id" value="${sponsor.id}">
        <div class="grid-2">
          <label class="field"><span>Name</span><input name="name" value="${esc(sponsor.name)}" required maxlength="80"></label>
          <label class="field"><span>Tier</span><select name="tier">
            ${["platinum", "gold", "silver", "community"].map((tier) => `<option value="${tier}"${tier === sponsor.tier ? " selected" : ""}>${esc(tierLabel(tier))}</option>`).join("")}
          </select></label>
          <label class="field"><span>Contact</span><input name="contact_name" value="${esc(sponsor.contact_name)}" maxlength="80"></label>
          <label class="field"><span>X handle</span><input name="x_handle" value="${esc(sponsor.x_handle)}" maxlength="15"></label>
        </div>
        <label class="field"><span>Prize or cash</span><textarea name="prize_details">${esc(sponsor.prize_details)}</textarea></label>
        <label class="field"><span>Earliest start</span><select name="not_before">${earliestOptions(sponsor.not_before)}</select></label>
        <button class="btn btn-ghost btn-tiny" type="submit">Save sponsor</button>
      </form>
      <form class="stack" method="post" action="/portal/admin/sponsor/delete" style="margin-top:12px">
        <input type="hidden" name="sponsor_id" value="${sponsor.id}">
        <label class="check"><input type="checkbox" name="confirm" value="yes" required> Remove ${esc(sponsor.name)} and their booking</label>
        <button class="btn btn-ghost btn-tiny" type="submit">Remove sponsor</button>
      </form>
    </details>
  </article>`;
}

export function renderAdmin({ sponsors, caps, flash, base, ephemeral }) {
  const spots = spotLines(sponsors, caps);
  const body = `
${banners(flash)}
${ephemeral ? `<div class="banner warn">Temporary storage. Unkey wipes the container disk on restart, and a preview sleeps after an idle hour. Set <b>DATABASE_URL</b>, <b>SESSION_SECRET</b>, and <b>ADMIN_CODE</b> before real sponsors use this.</div>` : ""}
<div class="split">
  <div>
    <p class="kicker label">Jason’s desk</p>
    <h1>Every <em>sponsor</em></h1>
  </div>
  <form method="post" action="/portal/logout"><button class="btn btn-ghost btn-tiny" type="submit">Log out</button></form>
</div>
<p class="lede">${esc(STREAM_DAY)}, ${esc(WINDOW_LABEL)}. ${spots.lines.map(esc).join(" ")} Silver: ${spots.silver}. Community: ${spots.community}.</p>
<details class="panel" open>
  <summary>Add a sponsor</summary>
  <form class="stack" style="padding-top:14px" method="post" action="/portal/admin/sponsors">
    <div class="grid-2">
      <label class="field"><span>Name</span><input name="name" required maxlength="80" placeholder="Company or person"></label>
      <label class="field"><span>Tier</span><select name="tier">
        <option value="platinum">Platinum · 1 hour</option>
        <option value="gold" selected>Gold · 30 minutes</option>
        <option value="silver">Silver · assets only</option>
        <option value="community">Community · assets only</option>
      </select></label>
      <label class="field"><span>Contact</span><input name="contact_name" maxlength="80"></label>
      <label class="field"><span>X handle</span><input name="x_handle" maxlength="15" placeholder="without the @"></label>
    </div>
    <label class="field"><span>Prize or cash</span><textarea name="prize_details" placeholder="$1,000 cash, or the gear they’re sending"></textarea></label>
    <label class="field"><span>Earliest start</span><select name="not_before">${earliestOptions(null)}</select></label>
    <button class="btn btn-gold" type="submit">Add and make a link</button>
  </form>
</details>
${sponsors.map((sponsor) => adminCard(sponsor, base)).join("")}`;
  return shell({ title: "Admin · Sponsor portal", body, wide: true });
}
