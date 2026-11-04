import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACCESS_CODE_PATTERN, codeHash, decryptCode, encryptCode, generateAccessCode } from "./auth.js";
import { BRANDS } from "./brands.js";
import { STREAM_END, STREAM_START, formatClock, formatRange, gridStarts } from "./time.js";

const TIERS = ["platinum", "gold", "prize", "silver", "community"];
const TIER_RANK = { platinum: 0, gold: 1, prize: 2, silver: 3, community: 4 };

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function durationFor(tier) {
  if (tier === "platinum") return 60;
  if (tier === "gold") return 30;
  return 0;
}

export function pickerLabel(sponsor) {
  if (sponsor.slug === "luke") return "Luke / LevelUp";
  return sponsor.name;
}

export function tierLabel(tier) {
  if (tier === "prize") return "Prize sponsor";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function cashOnly(tier) {
  return tier === "silver" || tier === "community";
}

function assetChecks(sponsor) {
  const checks = [
    ["Logo", (s) => s.logoCount > 0],
    ["Website", (s) => Boolean(s.url)],
    ["Talking points", (s) => Boolean(s.talking_points)],
  ];
  if (!cashOnly(sponsor.tier)) {
    checks.push(
      ["Prize details", (s) => Boolean(s.prize_details)],
      ["Shipping and fulfillment", (s) => Boolean(s.shipping)]
    );
  }
  checks.push(
    ["X handle", (s) => Boolean(s.x_handle)],
    ["Credit line", (s) => Boolean(s.credit)]
  );
  return checks;
}

export function assetReport(sponsor) {
  const missing = assetChecks(sponsor).filter(([, ok]) => !ok(sponsor)).map(([label]) => label);
  const total = assetChecks(sponsor).length;
  const done = total - missing.length;
  return { done, total, missing, complete: missing.length === 0 };
}

export function spotLines(sponsors, caps) {
  const count = (tier) => sponsors.filter((s) => s.tier === tier).length;
  const line = (label, tier, cap) => {
    const n = count(tier);
    const open = Math.max(0, cap - n);
    if (open === 0) return `${label} is full (${n} of ${cap}).`;
    if (open === 1) return `1 ${label} spot is still open (${n} of ${cap}).`;
    return `${open} ${label} spots are still open (${n} of ${cap}).`;
  };
  return {
    lines: [line("Platinum", "platinum", caps.platinum), line("Gold", "gold", caps.gold)],
    silver: count("silver"),
    community: count("community"),
    prize: count("prize"),
  };
}

/** Openings for the public one-pager. A cap of 0 means the original pitch did not set a limit. */
export function tierOpenings(sponsors, caps) {
  const rows = [
    ["platinum", "Platinum", caps.platinum || 0],
    ["gold", "Gold", caps.gold || 0],
    ["silver", "Silver", caps.silver || 0],
    ["community", "Community", caps.community || 0],
  ];
  return rows.map(([id, label, cap]) => {
    const roster = sponsors.filter((sponsor) => sponsor.tier === id);
    const taken = roster.length;
    const limited = cap > 0;
    const open = limited ? Math.max(0, cap - taken) : null;
    let status = "Open";
    if (limited) status = open === 0 ? `Full · ${taken} of ${cap}` : `${open === 1 ? "1 spot open" : `${open} spots open`} · ${taken} of ${cap}`;
    return { id, label, cap: limited ? cap : null, taken, open, full: limited && open === 0, status, roster };
  });
}

function nowIso() {
  return new Date().toISOString();
}

function cleanLine(value, max, label) {
  const v = String(value ?? "").replace(/\s+/g, " ").trim();
  if (v.length > max) throw new AppError(`${label} needs to be under ${max} characters.`);
  return v;
}

function cleanBlock(value, max, label) {
  const v = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (v.length > max) throw new AppError(`${label} needs to be under ${max} characters.`);
  return v;
}

export function cleanHandle(value) {
  const v = String(value ?? "").trim().replace(/^@+/, "");
  if (!v) return "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(v)) throw new AppError("X handles are letters, numbers, and underscores, up to 15 characters.");
  return v;
}

export function cleanUrl(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  let url;
  try {
    url = new URL(v);
  } catch {
    throw new AppError("The URL needs to start with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new AppError("Use an http or https URL.");
  if (v.length > 500) throw new AppError("That URL is too long.");
  return url.toString();
}

export function parseStart(value) {
  if (value == null || value === "") return null;
  if (!/^\d+$/.test(String(value))) throw new AppError("Pick a block from the schedule.");
  return Number(value);
}

export function parseNotBefore(value) {
  if (value == null || value === "") return null;
  const n = parseStart(value);
  if (n < STREAM_START || n >= STREAM_END || n % 30 !== 0) throw new AppError("Earliest start has to be on the 2:00–7:30 PM ET grid.");
  return n;
}

function slugify(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "sponsor";
  return base;
}

async function uniqueSlug(db, name) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await db.get("SELECT id FROM sponsors WHERE slug = ?", [slug])) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function issueCode(secret, adminCode) {
  const adminHash = codeHash(secret, adminCode);
  for (let i = 0; i < 5; i++) {
    const code = generateAccessCode();
    const hash = codeHash(secret, code);
    if (hash !== adminHash) return { code, hash, enc: encryptCode(secret, code) };
  }
  throw new AppError("Could not mint an invite code.", 500);
}

const MAX_LOGO = Math.floor(1.5 * 1024 * 1024);

export function inspectLogo(filename, bytes) {
  if (!bytes || bytes.length === 0) throw new AppError("That logo file is empty.");
  if (bytes.length > MAX_LOGO) throw new AppError("Each logo needs to be 1.5 MB or smaller.");
  const mime = sniff(bytes);
  if (!mime) throw new AppError("Upload a PNG, JPG, WEBP, GIF, or plain SVG logo.");
  if (mime === "image/svg+xml") assertPlainSvg(bytes);
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" }[mime];
  const safe = `logo.${ext}`;
  return { filename: safe, mime, bytes, original: filename };
}

function sniff(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 6) {
    const head = buf.toString("ascii", 0, 6);
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  const text = buf.subarray(0, Math.min(buf.length, 400)).toString("utf8").trimStart().toLowerCase();
  if (text.startsWith("<svg") || text.startsWith("<?xml")) return "image/svg+xml";
  return "";
}

function assertPlainSvg(buf) {
  const text = buf.toString("utf8");
  if (!/<svg[\s>]/i.test(text)) throw new AppError("That SVG does not look like a logo.");
  if (/<script|on[a-z]+\s*=|javascript:/i.test(text)) throw new AppError("That SVG has scripts in it. Export a plain logo.");
}

async function attach(db, rows, { secret, withCodes }) {
  const bookings = await db.all("SELECT * FROM bookings");
  const logos = await db.all("SELECT id, sponsor_id, filename, mime FROM logos ORDER BY id");
  const leadRows = await db.all("SELECT sponsor_id, COUNT(*) AS n FROM leads GROUP BY sponsor_id");
  const leadCount = new Map(leadRows.map((row) => [Number(row.sponsor_id), Number(row.n || 0)]));
  const byBooking = new Map(bookings.map((b) => [Number(b.sponsor_id), {
    ...b,
    id: Number(b.id),
    sponsor_id: Number(b.sponsor_id),
    start_min: Number(b.start_min),
    end_min: Number(b.end_min),
    gift_drop: Number(b.gift_drop),
    hot_seat: Number(b.hot_seat),
  }]));
  return rows
    .map((row) => {
      const mine = logos.filter((l) => Number(l.sponsor_id) === Number(row.id));
      const view = {
        ...row,
        id: Number(row.id),
        not_before: row.not_before == null || row.not_before === "" ? null : Number(row.not_before),
        booking: byBooking.get(Number(row.id)) || null,
        logos: mine.map((l) => ({ id: Number(l.id), filename: l.filename, mime: l.mime })),
        logoCount: mine.length,
        leadCount: leadCount.get(Number(row.id)) || 0,
      };
      if (withCodes) view.inviteCode = decryptCode(secret, row.code_enc);
      delete view.code_enc;
      delete view.code_hash;
      view.assets = assetReport(view);
      return view;
    })
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.name.localeCompare(b.name) || a.id - b.id);
}

export async function listSponsors(db, secret, { withCodes = false } = {}) {
  const rows = await db.all("SELECT * FROM sponsors");
  return attach(db, rows, { secret, withCodes });
}

export async function getSponsor(db, id) {
  const row = await db.get("SELECT * FROM sponsors WHERE id = ?", [id]);
  if (!row) return null;
  const [view] = await attach(db, [row], { secret: "", withCodes: false });
  return view;
}

export function scheduleRows(sponsor, sponsors) {
  const duration = durationFor(sponsor.tier);
  const bookings = sponsors.filter((s) => s.booking).map((s) => ({ ...s.booking, name: s.name, sponsor_id: s.id }));
  const rows = [];
  for (let start = STREAM_START; start < STREAM_END; start += 30) {
    const covering = bookings.find((b) => b.start_min <= start && start < b.end_min) || null;
    let selectable = false;
    let reason = "";
    const end = start + duration;
    if (duration) {
      if (end > STREAM_END) reason = "Runs past 8:00 PM ET";
      else if (sponsor.not_before != null && start < sponsor.not_before) reason = `Before ${formatClock(sponsor.not_before)} ET`;
      else {
        const hit = bookings.find((b) => b.sponsor_id !== sponsor.id && b.start_min < end && start < b.end_min);
        if (hit) reason = "Taken";
        else selectable = true;
      }
    }
    rows.push({
      start,
      end: duration ? end : start + 30,
      label: formatClock(start),
      range: duration ? formatRange(start, end) : "",
      covering,
      own: covering ? covering.sponsor_id === sponsor.id : false,
      selectable,
      reason,
      current: sponsor.booking?.start_min === start,
    });
  }
  return rows;
}

function assertBookable(sponsor, start, actor) {
  const duration = durationFor(sponsor.tier);
  if (!duration) {
    const why = sponsor.tier === "prize"
      ? "Prize sponsors are already on the lineup"
      : `${tierLabel(sponsor.tier)} is a cash gift for freeCodeCamp`;
    throw new AppError(`${why}, so there’s no stream block to book.`);
  }
  if (!Number.isInteger(start) || start % 30 !== 0) throw new AppError("Pick a block from the schedule.");
  if (start < STREAM_START || start + duration > STREAM_END) throw new AppError("That block sits outside 2:00–8:00 PM ET.");
  if (sponsor.not_before != null && start < sponsor.not_before) {
    const when = formatClock(sponsor.not_before);
    throw new AppError(
      actor === "admin"
        ? `${sponsor.name} asked to go on at ${when} ET or later.`
        : `Your earliest start is ${when} ET.`
    );
  }
  return duration;
}

export async function book(db, { sponsor, start, giftDrop, hotSeat, guestName, force, actor }) {
  const duration = assertBookable(sponsor, start, actor);
  const end = start + duration;
  const platinum = sponsor.tier === "platinum";
  const segments = {
    gift_drop: platinum && giftDrop ? 1 : 0,
    hot_seat: platinum && hotSeat ? 1 : 0,
    guest_name: platinum ? cleanLine(guestName, 80, "Guest name") : "",
  };
  await db.tx(async () => {
    const conflicts = await db.all(
      `SELECT b.id, b.start_min, b.end_min, b.sponsor_id, s.name
       FROM bookings b JOIN sponsors s ON s.id = b.sponsor_id
       WHERE b.sponsor_id != ? AND b.start_min < ? AND b.end_min > ?`,
      [sponsor.id, end, start]
    );
    if (conflicts.length && !(force && actor === "admin")) {
      if (actor !== "admin") throw new AppError("That block is already taken. Pick an open block.");
      const who = conflicts.map((c) => `${c.name} (${formatRange(c.start_min, c.end_min)})`).join(" and ");
      throw new AppError(`That block overlaps ${who}. Pick an open block.`);
    }
    if (conflicts.length) {
      const ids = conflicts.map((c) => c.id);
      await db.run(`DELETE FROM bookings WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
    }
    await db.run("DELETE FROM bookings WHERE sponsor_id = ?", [sponsor.id]);
    const ts = nowIso();
    await db.run(
      `INSERT INTO bookings (sponsor_id, start_min, end_min, gift_drop, hot_seat, guest_name, set_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sponsor.id, start, end, segments.gift_drop, segments.hot_seat, segments.guest_name, actor === "admin" ? "admin" : "sponsor", ts, ts]
    );
  });
  return formatRange(start, end);
}

export async function releaseBooking(db, sponsorId) {
  await db.run("DELETE FROM bookings WHERE sponsor_id = ?", [sponsorId]);
}

export async function saveAssets(db, sponsorId, fields, files) {
  const current = await db.get("SELECT tier FROM sponsors WHERE id = ?", [sponsorId]);
  if (!current) throw new AppError("That sponsor is gone.");
  const url = cleanUrl(fields.url);
  const talking = cleanBlock(fields.talking_points, 5000, "Talking points");
  const handle = cleanHandle(fields.x_handle);
  const credit = cleanLine(fields.credit, 200, "Credit line");
  const cash = cashOnly(current.tier);
  const prize = cash ? null : cleanBlock(fields.prize_details, 2000, "Prize details");
  const shipping = cash ? null : cleanBlock(fields.shipping, 2000, "Shipping and fulfillment");
  const logos = (files || []).filter((file) => file?.bytes?.length);
  if (logos.length > 2) throw new AppError("Upload up to two logos, a mark and a wordmark.");
  const inspected = logos.map((f) => inspectLogo(f.filename, f.bytes));
  const ts = nowIso();
  await db.tx(async () => {
    if (cash) {
      await db.run(
        `UPDATE sponsors SET url = ?, talking_points = ?, x_handle = ?, credit = ?, assets_updated_at = ? WHERE id = ?`,
        [url, talking, handle, credit, ts, sponsorId]
      );
    } else {
      await db.run(
        `UPDATE sponsors SET url = ?, talking_points = ?, prize_details = ?, shipping = ?, x_handle = ?, credit = ?, assets_updated_at = ? WHERE id = ?`,
        [url, talking, prize, shipping, handle, credit, ts, sponsorId]
      );
    }
    if (inspected.length) {
      await db.run("DELETE FROM logos WHERE sponsor_id = ?", [sponsorId]);
      for (const logo of inspected) {
        await db.run("INSERT INTO logos (sponsor_id, filename, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?)", [
          sponsorId,
          logo.filename,
          logo.mime,
          logo.bytes,
          ts,
        ]);
      }
    }
  });
}

export async function removeLogo(db, sponsorId, logoId) {
  const row = await db.get("SELECT id FROM logos WHERE id = ? AND sponsor_id = ?", [logoId, sponsorId]);
  if (!row) throw new AppError("That logo is already gone.");
  await db.run("DELETE FROM logos WHERE id = ?", [logoId]);
}

export async function getLogo(db, id) {
  return db.get("SELECT id, sponsor_id, mime, bytes, filename FROM logos WHERE id = ?", [id]);
}

export function leadsCsv(rows, { includeSponsor = false } = {}) {
  const header = includeSponsor
    ? "sponsor,name,email,platform,opted_in_at"
    : "name,email,platform,opted_in_at";
  const lines = [header];
  for (const row of rows) {
    const cells = [];
    if (includeSponsor) cells.push(row.sponsor_name || "");
    cells.push(row.name || "", row.email || "", row.platform || "", row.created_at || "");
    lines.push(cells.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function listLeads(db, sponsorId) {
  if (sponsorId) {
    return db.all(
      "SELECT name, email, platform, created_at FROM leads WHERE sponsor_id = ? ORDER BY id",
      [sponsorId]
    );
  }
  return db.all(
    `SELECT s.name AS sponsor_name, l.name, l.email, l.platform, l.created_at
     FROM leads l JOIN sponsors s ON s.id = l.sponsor_id ORDER BY l.id`
  );
}

export async function addLead(db, sponsorId, input) {
  const sponsor = await db.get("SELECT id FROM sponsors WHERE id = ?", [sponsorId]);
  if (!sponsor) throw new AppError("That sponsor is gone.");
  const name = cleanLine(input.lead_name, 120, "Lead name");
  const email = cleanLine(input.lead_email, 200, "Lead email");
  const platform = cleanLine(input.lead_platform, 40, "Platform");
  if (!name) throw new AppError("A lead needs a name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("That email doesn’t look right.");
  await db.run(
    "INSERT INTO leads (sponsor_id, name, email, platform, created_at) VALUES (?, ?, ?, ?, ?)",
    [sponsorId, name, email, platform, nowIso()]
  );
}

function sponsorFields(input) {
  const name = cleanLine(input.name, 80, "Name");
  if (!name) throw new AppError("A sponsor needs a name.");
  const tier = String(input.tier || "");
  if (!TIERS.includes(tier)) throw new AppError("Pick a tier.");
  return {
    name,
    tier,
    contact_name: cleanLine(input.contact_name, 80, "Contact name"),
    x_handle: cleanHandle(input.x_handle),
    prize_details: cleanBlock(input.prize_details, 2000, "Prize or cash details"),
    not_before: parseNotBefore(input.not_before),
    url: cleanUrl(input.url),
  };
}

async function assertCapacity(db, tier, caps, ignoreId) {
  const cap = tier === "platinum" ? caps.platinum : tier === "gold" ? caps.gold : 0;
  if (!cap) return;
  const row = await db.get("SELECT COUNT(*) AS n FROM sponsors WHERE tier = ? AND id != ?", [tier, ignoreId || 0]);
  const n = Number(row?.n || 0);
  if (n >= cap) throw new AppError(`${tierLabel(tier)} is full (${cap} of ${cap}). Remove one or raise the cap.`);
}

export async function addSponsor(db, input, secret, adminCode, caps) {
  const fields = sponsorFields(input);
  const ts = nowIso();
  return db.tx(async () => {
    await assertCapacity(db, fields.tier, caps);
    const slug = await uniqueSlug(db, fields.name);
    const issued = issueCode(secret, adminCode);
    const row = await db.get(
      `INSERT INTO sponsors (slug, name, tier, contact_name, x_handle, prize_details, not_before, url, code_hash, code_enc, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [slug, fields.name, fields.tier, fields.contact_name, fields.x_handle, fields.prize_details, fields.not_before, fields.url, issued.hash, issued.enc, ts]
    );
    return Number(row.id);
  });
}

export async function updateSponsor(db, id, input, caps) {
  const fields = sponsorFields(input);
  const current = await db.get("SELECT id, tier FROM sponsors WHERE id = ?", [id]);
  if (!current) throw new AppError("That sponsor is gone.");
  if (fields.tier !== current.tier) {
    const booking = await db.get("SELECT id FROM bookings WHERE sponsor_id = ?", [id]);
    if (booking) throw new AppError("Clear their block before changing the tier.");
  }
  await db.tx(async () => {
    if (fields.tier !== current.tier) await assertCapacity(db, fields.tier, caps, id);
    await db.run(
      `UPDATE sponsors SET name = ?, tier = ?, contact_name = ?, x_handle = ?, prize_details = ?, not_before = ?, url = ? WHERE id = ?`,
      [fields.name, fields.tier, fields.contact_name, fields.x_handle, fields.prize_details, fields.not_before, fields.url, id]
    );
  });
}

export async function deleteSponsor(db, id) {
  const row = await db.get("SELECT id FROM sponsors WHERE id = ?", [id]);
  if (!row) throw new AppError("That sponsor is gone.");
  await db.run("DELETE FROM sponsors WHERE id = ?", [id]);
}

export async function ensureWebsites(db) {
  for (const [slug, brand] of Object.entries(BRANDS)) {
    if (!brand.website) continue;
    await db.run("UPDATE sponsors SET url = ? WHERE slug = ? AND (url IS NULL OR url = '')", [brand.website, slug]);
  }
}

export async function ensureAccessCodes(db, secret, adminCode) {
  const rows = await db.all("SELECT id, code_enc FROM sponsors");
  for (const row of rows) {
    const plain = decryptCode(secret, row.code_enc);
    if (ACCESS_CODE_PATTERN.test(plain)) continue;
    const issued = issueCode(secret, adminCode);
    await db.run("UPDATE sponsors SET code_hash = ?, code_enc = ? WHERE id = ?", [issued.hash, issued.enc, row.id]);
  }
}

export async function regenerateInvite(db, id, secret, adminCode) {
  const issued = issueCode(secret, adminCode);
  const res = await db.run("UPDATE sponsors SET code_hash = ?, code_enc = ? WHERE id = ?", [issued.hash, issued.enc, id]);
  if (!res.changes) throw new AppError("That sponsor is gone.");
  return issued.code;
}

export function segmentSummary(booking) {
  if (!booking) return "";
  const parts = [];
  if (Number(booking.gift_drop)) parts.push("Gift Drop");
  if (Number(booking.hot_seat)) parts.push("Hot Seat");
  if (booking.guest_name) parts.push(booking.guest_name);
  return parts.join(" · ");
}

const SEED = [
  { slug: "laravel", name: "Laravel", tier: "platinum", prize_details: "New MacBook Pro", logos: [] },
  { slug: "unkey", name: "Unkey", tier: "platinum", prize_details: "$3,000 cash + NuPhy Air75 V3", logos: [] },
  { slug: "coder", name: "Coder", tier: "gold", prize_details: "$1,000 cash", logos: [] },
  {
    slug: "luke",
    name: "Luke",
    tier: "gold",
    contact_name: "Luke",
    x_handle: "LukeCFPLevelUp",
    prize_details: "$500+ prize, details TBD",
    not_before: 14 * 60,
  },
  { slug: "kunal", name: "Kunal", tier: "gold", contact_name: "Kunal", x_handle: "kunalstwt", prize_details: "5 Keychron keyboards" },
  { slug: "tighten", name: "Tighten", tier: "gold", contact_name: "Matt", prize_details: "Nintendo Switch 2", logos: ["mark", "wordmark"] },
  { slug: "coderabbit", name: "CodeRabbit", tier: "silver", prize_details: "Work Louder keyboard" },
  { slug: "torc", name: "Torc", tier: "silver", prize_details: "Two $100 Amazon gift cards" },
  { slug: "renderatl", name: "RenderATL", tier: "prize", prize_details: "RenderATL VIP ticket. Travel TBD." },
];

export async function seedIfEmpty(db, secret, adminCode) {
  const logoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "seed-logos");
  const ts = nowIso();
  let added = false;
  await db.tx(async () => {
    for (const item of SEED) {
      const existing = await db.get("SELECT id FROM sponsors WHERE slug = ?", [item.slug]);
      if (existing) continue;
      added = true;
      const issued = issueCode(secret, adminCode);
      const inserted = await db.get(
        `INSERT INTO sponsors (slug, name, tier, contact_name, x_handle, prize_details, not_before, url, code_hash, code_enc, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          item.slug,
          item.name,
          item.tier,
          item.contact_name || "",
          item.x_handle || "",
          item.prize_details || "",
          item.not_before ?? null,
          BRANDS[item.slug]?.website || "",
          issued.hash,
          issued.enc,
          ts,
        ]
      );
      for (const kind of item.logos || []) {
        const file = path.join(logoDir, `tighten-${kind}.png`);
        const bytes = fs.readFileSync(file);
        await db.run("INSERT INTO logos (sponsor_id, filename, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?)", [
          Number(inserted.id),
          `tighten-${kind}.png`,
          "image/png",
          bytes,
          ts,
        ]);
      }
    }
  });
  return added;
}

export function optionStarts(tier) {
  return gridStarts(durationFor(tier) || 30);
}
