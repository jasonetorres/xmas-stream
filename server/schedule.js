import { formatRange } from "./time.js";

/** One source for the public schedule, lower thirds, and the live up-next board. */
export const SEGMENTS = [
  { id: "christmasaire", name: "Christmasaire 2.0", note: "Christmas Millionaire. The audience app is not up yet.", soon: true, start: 14 * 60 },
  { id: "movie", name: "Name That Christmas Movie", note: "Played live on the stream.", start: 15 * 60 },
  { id: "price", name: "Holiday Price is Right", note: "Played live on the stream.", start: 16 * 60 },
  { id: "feud", name: "Family Feud", note: "Played live on the stream.", start: 17 * 60 },
  { id: "sweater", name: "Ugly Sweater + Donation Dares", note: "Played live on the stream.", start: 18 * 60 },
  { id: "santa", name: "Call Santa finale", note: "Santavel. Played live on the stream.", start: 19 * 60 },
].map((segment) => ({ ...segment, end: segment.start + 60 }));

const STREAM_DATE = "2026-12-18";

export function segmentRange(segment) {
  return formatRange(segment.start, segment.end);
}

export function scheduleHtml() {
  return `<ol class="games">${SEGMENTS.map((segment) => {
    const hour = String(Math.floor(segment.start / 60)).padStart(2, "0");
    const soon = segment.soon ? `<p class="soon">Coming soon</p>` : "";
    return `<li class="game"><time datetime="${STREAM_DATE}T${hour}:00:00-05:00">${segmentRange(segment)}</time><div><h3>${escapeHtml(segment.name)}</h3><p>${escapeHtml(segment.note)}</p>${soon}</div></li>`;
  }).join("")}</ol>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Wall-clock Eastern Time. December 18, 2026 is EST (UTC−5). */
export function etParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(get("hour"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: (Number.isFinite(hour) ? hour : 0) * 60 + Number(get("minute") || 0),
  };
}

export function onAir(date = new Date()) {
  const now = etParts(date);
  if (now.date < STREAM_DATE) return { phase: "before", current: null, next: SEGMENTS[0] };
  if (now.date > STREAM_DATE) return { phase: "after", current: null, next: null };
  if (now.minutes < SEGMENTS[0].start) return { phase: "before", current: null, next: SEGMENTS[0] };
  const current = SEGMENTS.find((segment) => now.minutes >= segment.start && now.minutes < segment.end) || null;
  if (!current) return { phase: "after", current: null, next: null };
  const next = SEGMENTS[SEGMENTS.indexOf(current) + 1] || null;
  return { phase: "live", current, next };
}

export function presentersFor(segment, sponsors) {
  return (sponsors || []).filter((sponsor) => {
    if (sponsor.tier !== "platinum" && sponsor.tier !== "gold") return false;
    const booking = sponsor.booking;
    if (!booking) return false;
    return Number(booking.start_min) < segment.end && Number(booking.end_min) > segment.start;
  });
}
