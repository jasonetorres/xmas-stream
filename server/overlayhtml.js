import fs from "node:fs";
import path from "node:path";
import { brandFor } from "./brands.js";
import { campaign, siteUrl } from "./campaign.js";
import { SEGMENTS, presentersFor, segmentRange } from "./schedule.js";

const FONT = `"JetBrains Mono", ui-monospace, monospace`;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const SKY = "background: radial-gradient(circle at 18px 28px, #ffffffb8 0 2px, transparent 3px) 0 0 / 109px 89px, radial-gradient(ellipse at 85% 0%, #fff8d5 0, transparent 28%), linear-gradient(180deg, #8fd3f0 0%, #bce8ed 52%, #e6f6f4 100%);";

export function stage(body, { opaque = false } = {}) {
  const bg = opaque ? SKY : "background: transparent;";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; ${bg} color: #254f55; font-family: ${FONT}; }
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

const TICKER = 42;
const BAR = 104;

export function frameHtml() {
  return stage(`<div style="position:absolute;inset:0 0 ${TICKER}px 0;border:4px solid #fbd475;border-bottom:0"></div>
    <div style="position:absolute;top:32px;left:32px;display:flex;max-width:980px;background:#fffbed;border:3px solid #c6dbcc;border-radius:28px;box-shadow:0 8px 0 #254f5518">
      <div style="width:12px;flex:none;background:#bd373b;border-radius:24px 0 0 24px"></div>
      <div style="padding:16px 26px 18px 22px">
        <div style="color:#8a5a09;font-size:20px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">On the air</div>
        <div style="margin-top:4px;font-size:46px;font-weight:700;line-height:1.05">Birthday + Christmas Stream</div>
        <div style="margin-top:8px;color:#3e6866;font-size:26px;line-height:1.2">Raising $10K for charity · tilt.fyi/9va4uz7GEn</div>
      </div>
    </div>`);
}

export function sceneHtml({ kicker, title, detail, qr }) {
  const code = qr ? `<img alt="" src="${qr}" style="width:248px;height:248px;background:#f5e6b8;border-radius:12px;padding:12px">` : "";
  return stage(`<div style="height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 56px">
      <div style="color:#8a5a09;letter-spacing:.16em;text-transform:uppercase;font-size:22px;font-weight:700">${esc(kicker)}</div>
      <div style="margin-top:14px;font-size:76px;font-weight:700;line-height:1.02">${esc(title)}</div>
      <div style="margin-top:16px;color:#3e6866;font-size:30px;line-height:1.25;white-space:nowrap">${esc(detail)}</div>
      ${code ? `<div style="margin-top:28px">${code}</div>` : ""}
    </div>`, { opaque: true });
}

/** Full-width lower third, 104px tall, sitting just above the 42px ticker. */
export function broadcastBar({ eyebrow, title, aside = "" }) {
  return stage(`<div style="position:absolute;left:0;right:0;bottom:${TICKER}px;height:${BAR}px;display:flex;background:#fffbed;color:#254f55">
      <div style="width:12px;flex:none;background:#bd373b"></div>
      <div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;padding:0 28px 0 22px">
        <div style="min-width:0">
          <div style="color:#8a5a09;font-size:18px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;line-height:1">${esc(eyebrow)}</div>
          <div style="margin-top:6px;font-size:40px;font-weight:700;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div>
        </div>
        ${aside}
      </div>
    </div>`);
}

function platedLogo(sponsor, uri, imgStyle) {
  if (!uri) return "";
  const img = `<img alt="${esc(sponsor.name || "")}" src="${uri}" style="${imgStyle}">`;
  if (brandFor(sponsor.slug).plate !== "ink") return img;
  return `<span style="display:inline-flex;align-items:center;justify-content:center;background:#254f55;border-radius:14px;padding:6px 10px">${img}</span>`;
}

export function lowerHtml({ time, name, presenters = [], logoUris = [] }) {
  const logos = presenters.map((sponsor, index) => {
    const uri = logoUris[index];
    if (uri) return platedLogo(sponsor, uri, "height:64px;max-width:220px;object-fit:contain");
    return `<b style="font-size:24px;color:#8a5a09">${esc(sponsor.name)}</b>`;
  }).join("");
  const aside = logos ? `<div style="display:flex;align-items:center;gap:18px;margin-left:24px;flex:none">${logos}</div>` : "";
  return broadcastBar({ eyebrow: time, title: name, aside });
}

export function slateHtml({ name, prize, link, logo, plate = "" }) {
  const raw = logo ? `<img alt="" src="${logo}" style="height:160px;width:auto;max-width:860px;object-fit:contain">` : "";
  const img = raw && plate === "ink" ? `<span style="display:inline-flex;background:#254f55;border-radius:24px;padding:16px 22px">${raw}</span>` : raw;
  return stage(`<div style="height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 64px">
      <div style="height:180px;display:flex;align-items:center;justify-content:center">${img}</div>
      <div style="margin-top:8px;font-size:52px;font-weight:700;line-height:1.1">${esc(name)}</div>
      <div style="margin-top:10px;font-size:28px;color:#3e6866;line-height:1.3">${esc(prize || "On the show")}</div>
      <div style="margin-top:12px;font-size:24px;color:#8a5a09">${esc(link || "")}</div>
    </div>`, { opaque: true });
}

export function wallHtml(groups) {
  const columns = groups.map((group) => {
    const items = group.sponsors.map((sponsor) => {
      const raw = sponsor.logo
        ? `<img alt="" src="${sponsor.logo}" style="width:200px;height:64px;object-fit:contain">`
        : "";
      const img = raw
        ? (sponsor.plate === "ink" ? `<span style="display:inline-flex;background:#254f55;border-radius:14px;padding:6px 10px">${raw}</span>` : raw)
        : `<b style="font-size:22px;line-height:64px">${esc(sponsor.name)}</b>`;
      return `<div style="width:216px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px">${img}<span style="font-size:13px;line-height:1.15;text-align:center;white-space:nowrap">${esc(sponsor.name)}</span></div>`;
    }).join("");
    return `<section style="margin-top:18px"><div style="color:#8a5a09;letter-spacing:.16em;text-transform:uppercase;font-size:16px;font-weight:700">${esc(group.tier)}</div><div style="margin-top:10px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:14px 18px">${items}</div></section>`;
  }).join("");
  return stage(`<div style="height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 32px;text-align:center"><div style="font-size:48px;font-weight:700;line-height:1.05">Thank you, sponsors</div><div style="margin-top:6px;color:#3e6866;font-size:22px">Raising $10,000 for charity</div>${columns}</div>`, { opaque: true });
}

export function guestLowerHtml({ name, handle, time }) {
  const who = handle ? `${name}, @${String(handle).replace(/^@/, "")}` : name;
  const eyebrow = time ? `Guest · ${time}` : "Guest";
  return broadcastBar({ eyebrow, title: who });
}

export function winnerTemplateHtml() {
  return broadcastBar({
    eyebrow: "Winner",
    title: "Winner!",
    aside: `<div style="margin-left:24px;text-align:right;flex:none"><div style="font-size:28px;font-weight:700">Name goes here</div><div style="margin-top:4px;color:#3e6866;font-size:20px">Prize goes here</div></div>`,
  });
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
    { file: "starting-soon.png", title: "Starting Soon", html: sceneHtml({ kicker: "Friday, December 18 · 2:00 PM ET", title: "Starting soon", detail: "Six holiday games. Raising $10,000 for charity." }) },
    { file: "brb.png", title: "Be right back", html: sceneHtml({ kicker: "Stay here", title: "Be right back", detail: "Grab a cocoa. The next game starts in a minute." }) },
    { file: "ending.png", title: "Thanks for watching", html: sceneHtml({ kicker: "That’s a wrap", title: "Thanks for watching", detail: "Merry Christmas. Every dollar went to charity." }) },
    { file: "donate-qr.png", title: "Donate QR", html: sceneHtml({ kicker: "For charity", title: "Donate now", detail: campaign.tiltifyUrl.replace("https://", ""), qr: qrs.donate }) },
    { file: "enter-giveaway.png", title: "Enter the giveaway", html: sceneHtml({ kicker: "Open to US residents only", title: "Enter the giveaway", detail: `${siteUrl.replace("https://", "")}/enter`, qr: qrs.enter }) },
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
        plate: brandFor(sponsor.slug).plate || "",
      }),
    });
  }
  const order = ["Platinum", "Gold", "Silver"];
  const groups = order.map((tier) => ({
    tier,
    sponsors: sponsors.filter((sponsor) => sponsor.tier === tier.toLowerCase()).map((sponsor) => ({
      name: sponsor.name,
      logo: logoUri(publicDir, sponsor),
      plate: brandFor(sponsor.slug).plate || "",
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
