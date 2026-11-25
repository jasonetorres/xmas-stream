import crypto from "node:crypto";
import { STREAM_END, STREAM_START, formatRange } from "./time.js";
import { AppError } from "./domain.js";
import { segmentAt } from "./schedule.js";

export const GUEST_SLOT = 30;
export const STREAM_UTC = Date.parse("2026-12-18T00:00:00-05:00");

export const ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["Pacific/Honolulu", "Hawaii"],
  ["Europe/London", "UK"],
  ["Europe/Paris", "Central Europe"],
  ["Asia/Kolkata", "India"],
  ["Asia/Tokyo", "Japan"],
  ["Australia/Sydney", "Sydney"],
];

export function guestStarts() {
  const starts = [];
  for (let t = STREAM_START; t + GUEST_SLOT <= STREAM_END; t += GUEST_SLOT) starts.push(t);
  return starts;
}

export function slotOk(start) {
  const n = Number(start);
  return guestStarts().includes(n);
}

export function sponsorAt(sponsors, start) {
  return (sponsors || []).find((sponsor) => {
    const booking = sponsor.booking;
    if (!booking) return false;
    return Number(booking.start_min) <= start && start < Number(booking.end_min);
  }) || null;
}

export function localClock(start, zone) {
  const safe = ZONES.some(([id]) => id === zone) ? zone : "America/New_York";
  const when = new Date(STREAM_UTC + Number(start) * 60000);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safe,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(when);
}

export async function listGuests(db) {
  return db.all("SELECT * FROM guest_requests ORDER BY start_min, id");
}

export async function listBlocks(db) {
  return db.all("SELECT * FROM slot_blocks ORDER BY start_min");
}

export async function streamyardLink(db) {
  const row = await db.get("SELECT value FROM settings WHERE key = ?", ["streamyard_guest_url"]);
  return row?.value || "";
}

export async function saveStreamyardLink(db, value) {
  const url = String(value || "").trim();
  if (url && !/^https:\/\/[\w.-]+/i.test(url)) throw new AppError("The StreamYard link has to be an https URL.");
  await db.run(
    "INSERT INTO settings (key, value) VALUES ('streamyard_guest_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [url]
  );
  return url;
}

function clean(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function requestGuest(db, input, sponsors) {
  if (clean(input.company_site, 80)) return { silent: true };
  const start = Number(input.start_min);
  if (!slotOk(start)) throw new AppError("Pick a 30-minute slot between 2:00 and 8:00 PM ET.");
  const blocks = await listBlocks(db);
  if (blocks.some((block) => Number(block.start_min) === start)) throw new AppError("That slot is held for the show.");
  const taken = await db.get("SELECT id FROM guest_requests WHERE start_min = ? AND status = 'approved'", [start]);
  if (taken) throw new AppError("That slot is already booked.");
  const name = clean(input.name, 80);
  const email = clean(input.email, 200).toLowerCase();
  const handle = clean(input.handle, 80).replace(/^@/, "");
  const topic = clean(input.topic, 240);
  const headshot = clean(input.headshot_url, 400);
  const zone = ZONES.some(([id]) => id === input.timezone) ? input.timezone : "America/New_York";
  const sponsorSlug = sponsors.some((sponsor) => sponsor.slug === input.sponsor_slug) ? input.sponsor_slug : "";
  if (!name) throw new AppError("Add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("That email doesn’t look right.");
  if (!handle) throw new AppError("Add an X or LinkedIn handle.");
  if (!topic) throw new AppError("Add a short topic.");
  if (headshot && !/^https:\/\/[\w.-]+/i.test(headshot)) throw new AppError("The headshot link has to be an https URL.");
  const now = new Date().toISOString();
  const token = crypto.randomBytes(16).toString("hex");
  await db.run(
    `INSERT INTO guest_requests (start_min, name, email, handle, topic, headshot_url, sponsor_slug, timezone, status, token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [start, name, email, handle, topic, headshot, sponsorSlug, zone, token, now, now]
  );
  return { silent: false };
}

export async function addGuest(db, input, sponsors) {
  const start = Number(input.start_min);
  if (!slotOk(start)) throw new AppError("Pick a 30-minute slot.");
  await assertOpen(db, start, null);
  const name = clean(input.name, 80);
  const email = clean(input.email, 200).toLowerCase();
  const handle = clean(input.handle, 80).replace(/^@/, "");
  const topic = clean(input.topic, 240);
  if (!name || !email || !topic) throw new AppError("Name, email, and topic are required.");
  const zone = ZONES.some(([id]) => id === input.timezone) ? input.timezone : "America/New_York";
  const sponsorSlug = sponsors.some((sponsor) => sponsor.slug === input.sponsor_slug) ? input.sponsor_slug : "";
  const now = new Date().toISOString();
  const token = crypto.randomBytes(16).toString("hex");
  await db.run(
    `INSERT INTO guest_requests (start_min, name, email, handle, topic, headshot_url, sponsor_slug, timezone, status, token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)`,
    [start, name, email, handle, topic, clean(input.headshot_url, 400), sponsorSlug, zone, token, now, now]
  );
}

async function assertOpen(db, start, ignoreId) {
  const blocks = await listBlocks(db);
  if (blocks.some((block) => Number(block.start_min) === start)) throw new AppError("That slot is blocked.");
  const taken = await db.get("SELECT id FROM guest_requests WHERE start_min = ? AND status = 'approved' AND id != ?", [start, ignoreId || 0]);
  if (taken) throw new AppError("That slot already has a guest.");
}

export async function setGuestStatus(db, id, status) {
  const row = await db.get("SELECT * FROM guest_requests WHERE id = ?", [id]);
  if (!row) throw new AppError("That request is gone.");
  if (status === "approved") await assertOpen(db, Number(row.start_min), row.id);
  await db.run("UPDATE guest_requests SET status = ?, updated_at = ? WHERE id = ?", [status, new Date().toISOString(), id]);
  return row;
}

export async function moveGuest(db, id, start) {
  const n = Number(start);
  if (!slotOk(n)) throw new AppError("Pick a 30-minute slot.");
  const row = await db.get("SELECT * FROM guest_requests WHERE id = ?", [id]);
  if (!row) throw new AppError("That request is gone.");
  await assertOpen(db, n, id);
  await db.run("UPDATE guest_requests SET start_min = ?, updated_at = ? WHERE id = ?", [n, new Date().toISOString(), id]);
}

export async function blockSlot(db, start, reason) {
  const n = Number(start);
  if (!slotOk(n)) throw new AppError("Pick a 30-minute slot.");
  const taken = await db.get("SELECT id FROM guest_requests WHERE start_min = ? AND status = 'approved'", [n]);
  if (taken) throw new AppError("Move the booked guest before blocking that slot.");
  const label = clean(reason, 80) || "Held";
  await db.run(
    "INSERT INTO slot_blocks (start_min, reason, created_at) VALUES (?, ?, ?) ON CONFLICT(start_min) DO UPDATE SET reason = excluded.reason",
    [n, label, new Date().toISOString()]
  );
}

export async function unblockSlot(db, start) {
  await db.run("DELETE FROM slot_blocks WHERE start_min = ?", [Number(start)]);
}

export function confirmationText(guest, link, pageUrl) {
  const when = `${formatRange(guest.start_min, guest.start_min + GUEST_SLOT)} (${localClock(guest.start_min, guest.timezone)})`;
  return `Hi ${guest.name} — you’re on the Christmas Birthday Stream, Friday, Dec 18, ${when}. Join 10 minutes early, use headphones, and get good light. StreamYard: ${link || "(link not set yet)"} Confirmation: ${pageUrl}`;
}

export function icsFor(guest, link) {
  const start = new Date(STREAM_UTC + guest.start_min * 60000);
  const end = new Date(start.getTime() + GUEST_SLOT * 60000);
  const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//xmas-stream//guest//EN",
    "BEGIN:VEVENT",
    `UID:guest-${guest.token}@xmas-stream`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:Christmas Birthday Stream guest slot",
    `DESCRIPTION:Join 10 minutes early. Headphones. Good light. ${link || ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `${body}\r\n`;
}

export function runOfShowCsv(guests, blocks, sponsors) {
  const rows = [];
  for (const guest of guests.filter((item) => item.status === "approved")) {
    const sponsor = sponsorAt(sponsors, Number(guest.start_min));
    rows.push({
      start: Number(guest.start_min),
      time: formatRange(guest.start_min, guest.start_min + GUEST_SLOT),
      guest: guest.name,
      handle: guest.handle,
      topic: guest.topic,
      sponsor: sponsor ? sponsor.name : "",
      contact: guest.email,
      segment: segmentAt(Number(guest.start_min))?.name || "",
    });
  }
  for (const block of blocks) {
    rows.push({
      start: Number(block.start_min),
      time: formatRange(block.start_min, block.start_min + GUEST_SLOT),
      guest: "",
      handle: "",
      topic: block.reason,
      sponsor: "",
      contact: "",
      segment: segmentAt(Number(block.start_min))?.name || "",
    });
  }
  rows.sort((a, b) => a.start - b.start);
  const lines = ["time_et,segment,guest,handle,topic,sponsor_block,contact"];
  for (const row of rows) lines.push([row.time, row.segment, row.guest, row.handle, row.topic, row.sponsor, row.contact].map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function guestDuring(guests, start, end) {
  return (guests || [])
    .filter((guest) => guest.status === "approved" && Number(guest.start_min) >= start && Number(guest.start_min) < end)
    .sort((a, b) => Number(a.start_min) - Number(b.start_min));
}
