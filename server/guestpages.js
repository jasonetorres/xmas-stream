import { formatRange } from "./time.js";
import { GUEST_SLOT, ZONES, confirmationText, localClock, sponsorAt } from "./guests.js";
import { siteUrl } from "./campaign.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const css = `
:root { --ground:#17110d; --line:rgba(245,230,184,.22); --cream:#f5e6b8; --muted:#cdbf98; --gold:#f2b33d; }
* { box-sizing: border-box; }
body { margin:0; background:#17110d; color:var(--cream); font-family:"JetBrains Mono",ui-monospace,monospace; font-size:16px; line-height:1.45; }
a { color:var(--gold); }
.wrap { max-width:980px; margin:0 auto; padding:24px 16px 72px; }
h1 { font-size:clamp(1.7rem,4vw,2.4rem); margin:8px 0; }
.slot { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 12px; padding:12px 0; border-top:1px solid var(--line); }
.meta { color:var(--muted); font-size:.86rem; }
.btn, button { display:inline-flex; align-items:center; min-height:44px; padding:0 14px; border-radius:999px; background:var(--gold); color:#17110d; font:inherit; font-weight:700; border:0; text-decoration:none; cursor:pointer; }
input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, textarea { width:100%; min-height:44px; margin-top:4px; padding:8px 10px; border-radius:10px; border:1px solid var(--line); background:#100d0b; color:var(--cream); font:inherit; }
input[type="checkbox"], input[type="radio"] {
  appearance:none; -webkit-appearance:none; width:22px; height:22px; min-width:22px; min-height:22px; margin:0; flex:0 0 22px;
  border:2px solid var(--gold); background:#100d0b; display:grid; place-content:center; cursor:pointer;
}
input[type="checkbox"] { border-radius:6px; }
input[type="radio"] { border-radius:50%; }
input[type="checkbox"]:checked, input[type="radio"]:checked { background:var(--gold); }
input[type="checkbox"]:checked::before { content:""; width:5px; height:9px; border:solid #17110d; border-width:0 2px 2px 0; transform:rotate(45deg) translate(-1px,-1px); }
input[type="radio"]:checked::before { content:""; width:8px; height:8px; border-radius:50%; background:#17110d; }
label.check { display:flex; align-items:center; justify-content:flex-start; gap:12px; width:100%; text-align:left; }
label { display:block; margin:12px 0; }
.banner { padding:12px; border-radius:12px; background:rgba(242,179,61,.12); }
.hp { position:absolute; left:-9999px; }
.tabs a { margin-right:12px; }
textarea.copy { min-height:96px; }
`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"><style>${css}</style></head><body>${body}</body></html>`;
}

export function renderGuests({ sponsors, guests, blocks, message, error }) {
  const approved = new Map(guests.filter((guest) => guest.status === "approved").map((guest) => [Number(guest.start_min), guest]));
  const held = new Map(blocks.map((block) => [Number(block.start_min), block.reason]));
  const options = sponsors.map((sponsor) => `<option value="${esc(sponsor.slug)}">${esc(sponsor.name)}</option>`).join("");
  const zones = ZONES.map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join("");
  const rows = [];
  for (let start = 14 * 60; start < 20 * 60; start += GUEST_SLOT) {
    const sponsor = sponsorAt(sponsors, start);
    const guest = approved.get(start);
    const block = held.get(start);
    const when = formatRange(start, start + GUEST_SLOT);
    let state = `<a class="btn" href="#request" onclick="document.getElementById('slot').value='${start}'">Request</a>`;
    let who = `<span class="meta">Open</span>`;
    if (block) {
      state = "";
      who = `<b>${esc(block)}</b>`;
    } else if (guest) {
      state = "";
      const handle = guest.handle ? ` · @${esc(guest.handle.replace(/^@/, ""))}` : "";
      who = `<b>${esc(guest.name)}</b><span class="meta">${handle}</span>`;
    }
    const blockNote = sponsor ? `<span class="meta">${esc(sponsor.name)} block</span>` : `<span class="meta">Open timeline</span>`;
    rows.push(`<article class="slot"><div><div>${esc(when)} <span class="local" data-min="${start}"></span></div>${blockNote}<div>${who}</div></div><div>${state}</div></article>`);
  }
  const flash = error ? `<p class="banner">${esc(error)}</p>` : message ? `<p class="banner">${esc(message)}</p>` : "";
  const body = `<div class="wrap"><p class="meta">Friday, Dec 18, 2026 · 2:00–8:00 PM ET</p><h1>Guest slots</h1>
    <p>Half-hour spots. A sponsor block is their branded time. You can still request a slot inside it. Requests stay pending until Jason approves them.</p>
    ${flash}
    <label>Show slot times in<select id="zone">${zones}</select></label>
    <p class="meta" id="helper"></p>
    ${rows.join("")}
    <h2 id="request">Request a slot</h2>
    <form method="post" action="/guests">
      <label>Slot<select name="start_min" id="slot" required>${rows.length ? guestOptions(approved, held) : ""}</select></label>
      <label>Name<input name="name" required maxlength="80"></label>
      <label>Email<input name="email" type="email" required maxlength="200"></label>
      <label>X or LinkedIn handle<input name="handle" required maxlength="80" placeholder="without @"></label>
      <label>Topic<input name="topic" required maxlength="240" placeholder="What you want to do or talk about"></label>
      <label>Headshot URL, optional<input name="headshot_url" type="url" maxlength="400" placeholder="https://"></label>
      <label>Sponsor affiliation, optional<select name="sponsor_slug"><option value="">None</option>${options}</select></label>
      <input type="hidden" name="timezone" id="tz" value="America/New_York">
      <label class="hp">Company<input name="company_site" tabindex="-1" autocomplete="off"></label>
      <button class="btn" type="submit">Request this slot</button>
    </form>
    <script>
      const zone = document.getElementById("zone");
      const helper = document.getElementById("helper");
      function paint() {
        const tz = zone.value;
        document.getElementById("tz").value = tz;
        document.querySelectorAll(".local").forEach((el) => {
          const start = Date.parse("2026-12-18T00:00:00-05:00") + Number(el.dataset.min) * 60000;
          el.textContent = "· " + new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" }).format(new Date(start));
        });
        const two = new Date(Date.parse("2026-12-18T00:00:00-05:00") + 14 * 60 * 60000);
        helper.textContent = "2:00 PM ET is " + new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" }).format(two) + " in this zone.";
      }
      zone.onchange = paint; paint();
    </script></div>`;
  return page("Guest slots", body);
}

function guestOptions(approved, held) {
  let html = "";
  for (let start = 14 * 60; start < 20 * 60; start += GUEST_SLOT) {
    if (approved.has(start) || held.has(start)) continue;
    html += `<option value="${start}">${esc(formatRange(start, start + GUEST_SLOT))}</option>`;
  }
  return html;
}

export function renderGuestConfirm({ guest, link }) {
  const when = formatRange(guest.start_min, guest.start_min + GUEST_SLOT);
  const local = localClock(guest.start_min, guest.timezone);
  const body = `<div class="wrap"><h1>You’re on the show</h1>
    <p><b>${esc(when)}</b></p>
    <p>That’s ${esc(local)} in the zone you picked.</p>
    <p>${link ? `<a href="${esc(link)}">Open the StreamYard guest link</a>` : "Jason will add the StreamYard link here."}</p>
    <p><a class="btn" href="/guests/c/${esc(guest.token)}.ics">Download calendar (.ics)</a></p>
    <h2>Before you join</h2>
    <ul>
      <li>Join 10 minutes early.</li>
      <li>Use headphones.</li>
      <li>Get good light on your face.</li>
    </ul></div>`;
  return page("Guest confirmation", body);
}

export function renderGuestAdmin({ guests, blocks, sponsors, link, flash }) {
  const sponsorName = (slug) => sponsors.find((sponsor) => sponsor.slug === slug)?.name || "";
  const options = guestOptions(new Map(guests.filter((g) => g.status === "approved").map((g) => [Number(g.start_min), g])), new Map(blocks.map((b) => [Number(b.start_min), b])));
  const cards = guests.map((guest) => {
    const when = formatRange(guest.start_min, guest.start_min + GUEST_SLOT);
    const sponsor = sponsorAt(sponsors, Number(guest.start_min));
    const pageUrl = `${siteUrl}/guests/c/${guest.token}`;
    const text = confirmationText(guest, link, pageUrl);
    return `<article class="slot"><div><b>${esc(guest.name)}</b> · @${esc(guest.handle)} · ${esc(guest.status)}<div class="meta">${esc(when)} · ${esc(guest.email)}</div><div>${esc(guest.topic)}</div><div class="meta">${sponsor ? esc(sponsor.name) + " block" : "No sponsor block"}${guest.sponsor_slug ? " · affiliation " + esc(sponsorName(guest.sponsor_slug)) : ""}</div>
      ${guest.status === "approved" ? `<textarea class="copy" readonly>${esc(text)}</textarea>` : ""}
      <form method="post" action="/admin/guests/move"><input type="hidden" name="id" value="${guest.id}"><label>Move<select name="start_min">${allOptions(guest.start_min)}</select></label><button class="btn" type="submit">Move</button></form>
      </div><div>
      ${guest.status !== "approved" ? `<form method="post" action="/admin/guests/approve"><input type="hidden" name="id" value="${guest.id}"><button class="btn" type="submit">Approve</button></form>` : ""}
      ${guest.status !== "declined" ? `<form method="post" action="/admin/guests/decline"><input type="hidden" name="id" value="${guest.id}"><button class="btn" type="submit">Decline</button></form>` : ""}
      </div></article>`;
  }).join("");
  const held = blocks.map((block) => `<li>${esc(formatRange(block.start_min, block.start_min + GUEST_SLOT))} · ${esc(block.reason)} <form method="post" action="/admin/guests/unblock" style="display:inline"><input type="hidden" name="start_min" value="${block.start_min}"><button class="btn" type="submit">Unblock</button></form></li>`).join("");
  const flashHtml = flash?.error ? `<p class="banner">${esc(flash.error)}</p>` : flash?.saved ? `<p class="banner">${esc(flash.saved)}</p>` : "";
  const body = `<div class="wrap"><p class="tabs"><a href="/admin">Sponsors</a><a href="/admin/guests">Guests</a><a href="/admin/guests/run-of-show.csv">Run of show CSV</a></p>
    <h1>Guests</h1>${flashHtml}
    <form method="post" action="/admin/guests/streamyard"><label>StreamYard guest link<input name="streamyard_guest_url" value="${esc(link)}" placeholder="https://"></label><button class="btn" type="submit">Save link</button></form>
    <h2>Add a guest</h2>
    <form method="post" action="/admin/guests/add"><label>Slot<select name="start_min">${options}</select></label><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Handle<input name="handle"></label><label>Topic<input name="topic" required></label><label>Zone<select name="timezone">${ZONES.map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join("")}</select></label><button class="btn" type="submit">Add and approve</button></form>
    <h2>Block a slot</h2>
    <form method="post" action="/admin/guests/block"><label>Slot<select name="start_min">${options}</select></label><label>Reason<input name="reason" placeholder="Break, game, segment"></label><button class="btn" type="submit">Block</button></form>
    <h2>Requests</h2>${cards || "<p>No requests yet.</p>"}
    <h2>Blocked</h2><ul>${held || "<li>None</li>"}</ul></div>`;
  return page("Guests · admin", body);
}

function allOptions(selected) {
  let html = "";
  for (let start = 14 * 60; start < 20 * 60; start += GUEST_SLOT) {
    html += `<option value="${start}"${Number(selected) === start ? " selected" : ""}>${esc(formatRangeSafe(start))}</option>`;
  }
  return html;
}

function formatRangeSafe(start) {
  return formatRange(start, start + GUEST_SLOT);
}
