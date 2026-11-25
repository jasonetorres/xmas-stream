import { formatRange } from "./time.js";

/**
 * One source for the public schedule, lower thirds, the live up-next board,
 * and the run of show. `href` is the public watch link. `soon` hides that
 * link until the outside app is confirmed live.
 */
export const SEGMENTS = [
  {
    id: "santa",
    name: "Call Santa",
    note: "Santavel. Call Santa live.",
    start: 14 * 60,
    href: "https://findsanta.vercel.app",
    watch: "Watch",
  },
  {
    id: "movie",
    name: "Name That Christmas Movie",
    note: "Emoji, line, and scene clues. Played live on the stream.",
    start: 15 * 60,
    href: "/games/movie/display",
    watch: "Watch",
  },
  {
    id: "price",
    name: "Holiday Price is Right",
    note: "Level Up Financial Planning’s finance-friendly hour. No sales pitch.",
    start: 16 * 60,
    href: "/games/price/display",
    watch: "Watch",
  },
  {
    id: "feud",
    name: "Christmas Family Feud",
    note: "Survey board with two teams. Played live on the stream.",
    start: 17 * 60,
    href: "/games/feud/display",
    watch: "Watch",
  },
  {
    id: "sweater",
    name: "Ugly Sweater Showdown + Donation Dares",
    note: "Sweater votes, then donation dares. Played live on the stream.",
    start: 18 * 60,
    href: "/games/sweater/display",
    watch: "Watch",
  },
  {
    id: "christmasaire",
    name: "Christmasaire 2.0",
    note: "Christmas Millionaire finale.",
    start: 19 * 60,
    href: "https://christmasmillionaire.vercel.app",
    watch: "Watch",
    soon: true,
  },
].map((segment) => ({ ...segment, end: segment.start + 60 }));

const STREAM_DATE = "2026-12-18";

export function segmentRange(segment) {
  return formatRange(segment.start, segment.end);
}

export function segmentAt(minute) {
  return SEGMENTS.find((segment) => minute >= segment.start && minute < segment.end) || null;
}

export function scheduleHtml() {
  return `<ol class="games">${SEGMENTS.map((segment) => {
    const hour = String(Math.floor(segment.start / 60)).padStart(2, "0");
    const soon = segment.soon ? `<p class="soon">Coming soon</p>` : "";
    const link = !segment.soon && segment.href
      ? `<p><a class="watch" href="${escapeHtml(segment.href)}"${segment.href.startsWith("http") ? ` target="_blank" rel="noopener noreferrer"` : ""}>${escapeHtml(segment.watch || "Watch")}</a></p>`
      : "";
    return `<li class="game"><time datetime="${STREAM_DATE}T${hour}:00:00-05:00">${segmentRange(segment)}</time><div><h3>${escapeHtml(segment.name)}</h3><p>${escapeHtml(segment.note)}</p>${soon}${link}</div></li>`;
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
