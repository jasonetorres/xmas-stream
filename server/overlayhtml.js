import fs from "node:fs";
import path from "node:path";
import { brandFor } from "./brands.js";
import { campaign, siteUrl } from "./campaign.js";
import { SEGMENTS, presentersFor, segmentRange } from "./schedule.js";

const FONT = `"JetBrains Mono", ui-monospace, monospace`;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function stage(body, { opaque = false } = {}) {
  const bg = opaque ? "background: radial-gradient(ellipse at 50% -8%, #3a2a1d 0%, #17110d 58%);" : "background: transparent;";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; ${bg} color: #f5e6b8; font-family: ${FONT}; }
    img { object-fit: contain; }
  </style></head><body>${body}</body></html>`;
}

export function dataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".svg" ? "image/svg+xml" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function logoUri(publicDir, sponsor) {
  const hub = brandFor(sponsor.slug).hub || "";
  if (!hub) return "";
  return dataUri(path.join(publicDir, hub.replace(/^\//, "")));
}

export function frameHtml() {
  return stage(`<div style="position:absolute;inset:0 0 42px 0;border:3px solid rgba(242,179,61,.9);border-bottom:0"></div>
    <div style="position:absolute;top:28px;left:28px;max-width:640px;padding:14px 18px;border:2px solid #f2b33d;border-radius:16px;background:rgba(23,17,13,.9)">
      <div style="color:#f2b33d;font-size:15px;letter-spacing:.14em;text-transform:uppercase">On the air</div>
      <div style="font-size:28px;font-weight:700;line-height:1.25">Birthday + Christmas Stream</div>
      <div style="margin-top:6px;color:#cdbf98;font-size:20px">Raising $10K for freeCodeCamp · tilt.fyi/9va4uz7GEn</div>
    </div>`);
}

export function sceneHtml({ kicker, title, detail, qr }) {
  const code = qr ? `<img alt="" src="${qr}" style="width:220px;height:220px;background:#f5e6b8;border-radius:12px;padding:10px">` : "";
  return stage(`<div style="height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:64px">
      <div style="color:#f2b33d;letter-spacing:.16em;text-transform:uppercase;font-size:18px">${esc(kicker)}</div>
      <div style="margin-top:16px;font-size:84px;font-weight:700;line-height:1.05">${esc(title)}</div>
      <div style="margin-top:18px;max-width:860px;color:#cdbf98;font-size:28px">${esc(detail)}</div>
      ${code ? `<div style="margin-top:28px">${code}</div>` : ""}
    </div>`, { opaque: true });
}

export function lowerHtml({ time, name, presenters = [], logoUris = [] }) {
  const logos = presenters.map((sponsor, index) => {
    const uri = logoUris[index];
    const img = uri ? `<img alt="" src="${uri}" style="height:56px;max-width:180px">` : "";
    return `<span style="display:flex;align-items:center;gap:10px">${img}<b>${esc(sponsor.name)}</b></span>`;
  }).join("");
  const by = presenters.length ? `<div style="margin-top:6px;display:flex;gap:16px;align-items:center;color:#f2b33d;font-size:22px">Presented by ${logos}</div>` : "";
  return stage(`<div style="position:absolute;left:40px;bottom:58px;max-width:1100px;padding:16px 20px;background:rgba(23,17,13,.92);border-left:8px solid #f2b33d;border-radius:14px">
      <div style="color:#f2b33d;font-size:18px">${esc(time)}</div>
      <div style="font-size:40px;font-weight:700;line-height:1.15">${esc(name)}</div>
      ${by}
    </div>`);
}

export function slateHtml({ name, prize, link, logo }) {
  const img = logo ? `<img alt="" src="${logo}" style="max-height:180px;max-width:640px">` : "";
  return stage(`<div style="height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px">
      ${img}
      <div style="margin-top:22px;font-size:54px;font-weight:700">${esc(name)}</div>
      <div style="margin-top:10px;font-size:28px;color:#cdbf98">${esc(prize || "On the show")}</div>
      <div style="margin-top:14px;font-size:24px;color:#f2b33d">${esc(link || "")}</div>
    </div>`, { opaque: true });
}

export function wallHtml(groups) {
  const columns = groups.map((group) => {
    const items = group.sponsors.map((sponsor) => {
      const img = sponsor.logo ? `<img alt="" src="${sponsor.logo}" style="height:54px;max-width:180px">` : `<b>${esc(sponsor.name)}</b>`;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:180px">${img}<span style="font-size:16px">${esc(sponsor.name)}</span></div>`;
    }).join("");
    return `<section style="margin-top:18px"><div style="color:#f2b33d;letter-spacing:.14em;text-transform:uppercase;font-size:14px">${esc(group.tier)}</div><div style="margin-top:10px;display:flex;flex-wrap:wrap;justify-content:center;gap:18px 28px">${items}</div></section>`;
  }).join("");
  return stage(`<div style="height:720px;padding:36px 48px;text-align:center"><div style="font-size:42px;font-weight:700">Thank you, sponsors</div><div style="color:#cdbf98">Raising $10,000 for freeCodeCamp</div>${columns}</div>`, { opaque: true });
}

export function guestLowerHtml({ name, handle, time }) {
  const who = handle ? `${name}, @${String(handle).replace(/^@/, "")}` : name;
  return lowerHtml({ time: time || "", name: `Guest: ${who}` });
}

export function winnerTemplateHtml() {
  return stage(`<div style="position:absolute;left:40px;right:40px;bottom:58px;padding:18px 22px;background:rgba(23,17,13,.94);border-left:8px solid #f2b33d;border-radius:14px">
      <div style="color:#f2b33d;letter-spacing:.14em;text-transform:uppercase">Winner</div>
      <div style="font-size:48px;font-weight:700">Winner!</div>
      <div style="color:#cdbf98;font-size:24px">Name goes here · prize goes here</div>
    </div>`);
}

export function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url || ""; }
}

export function segmentCard(segment, sponsors, publicDir) {
  const presenters = presentersFor(segment, sponsors);
  return {
    file: `lower-${segment.id}.png`,
    title: `Lower third · ${segment.name}`,
    html: lowerHtml({
      time: segmentRange(segment),
      name: segment.name,
      presenters,
      logoUris: presenters.map((sponsor) => logoUri(publicDir, sponsor)),
    }),
  };
}

export function catalog(sponsors, publicDir, qrs, guests = []) {
  const items = [
    { file: "frame.png", title: "Main frame", html: frameHtml() },
    { file: "starting-soon.png", title: "Starting Soon", html: sceneHtml({ kicker: "Friday, December 18 · 2:00 PM ET", title: "Starting soon", detail: "Six holiday games. Raising $10,000 for freeCodeCamp." }) },
    { file: "brb.png", title: "Be right back", html: sceneHtml({ kicker: "Stay here", title: "Be right back", detail: "Grab a cocoa. The next game starts in a minute." }) },
    { file: "ending.png", title: "Thanks for watching", html: sceneHtml({ kicker: "That’s a wrap", title: "Thanks for watching", detail: "Merry Christmas. Every dollar went to freeCodeCamp." }) },
    { file: "donate-qr.png", title: "Donate QR", html: sceneHtml({ kicker: "freeCodeCamp", title: "Donate now", detail: campaign.tiltifyUrl.replace("https://", ""), qr: qrs.donate }) },
    { file: "enter-giveaway.png", title: "Enter the giveaway", html: sceneHtml({ kicker: "No donation needed", title: "Enter the giveaway", detail: `${siteUrl.replace("https://", "")}/enter`, qr: qrs.enter }) },
    { file: "winner.png", title: "Winner lower third", html: winnerTemplateHtml() },
  ];
  for (const segment of SEGMENTS) items.push(segmentCard(segment, sponsors, publicDir));
  for (const sponsor of sponsors) {
    items.push({
      file: `slate-${sponsor.slug}.png`,
      title: `Slate · ${sponsor.name}`,
      html: slateHtml({
        name: sponsor.name,
        prize: sponsor.prize_details,
        link: hostOf(sponsor.url || brandFor(sponsor.slug).website || ""),
        logo: logoUri(publicDir, sponsor),
      }),
    });
  }
  const order = ["Platinum", "Gold", "Silver"];
  const groups = order.map((tier) => ({
    tier,
    sponsors: sponsors.filter((sponsor) => sponsor.tier === tier.toLowerCase()).map((sponsor) => ({
      name: sponsor.name,
      logo: logoUri(publicDir, sponsor),
    })),
  })).filter((group) => group.sponsors.length);
  items.push({ file: "thank-you.png", title: "Thank you sponsors", html: wallHtml(groups) });
  for (const guest of guests.filter((item) => item.status === "approved")) {
    items.push({
      file: `guest-${guest.id}.png`,
      title: `Guest · ${guest.name}`,
      html: guestLowerHtml({ name: guest.name, handle: guest.handle, time: "" }),
    });
  }
  return items;
}
