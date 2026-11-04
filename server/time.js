/** Stream window is wall-clock Eastern Time. December 18 is EST, and labels never depend on the server timezone. */
export const STREAM_START = 14 * 60;
export const STREAM_END = 20 * 60;
export const SLOT = 30;

export const STREAM_DAY = "Friday, Dec 18, 2026";
export const ASSETS_DUE = "Friday, Nov 20, 2026";
export const WINDOW_LABEL = "2:00–8:00 PM ET";

export function clockParts(minutesFromMidnight) {
  const min = Number(minutesFromMidnight);
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return { h, m: String(m).padStart(2, "0"), suffix };
}

export function formatClock(minutesFromMidnight) {
  const p = clockParts(minutesFromMidnight);
  return `${p.h}:${p.m} ${p.suffix}`;
}

/** 2:00–3:00 PM ET, or 11:30 AM–12:30 PM ET when the suffix changes. */
export function formatRange(start, end) {
  const a = clockParts(start);
  const b = clockParts(end);
  if (a.suffix === b.suffix) return `${a.h}:${a.m}–${b.h}:${b.m} ${b.suffix} ET`;
  return `${a.h}:${a.m} ${a.suffix}–${b.h}:${b.m} ${b.suffix} ET`;
}

export function gridStarts(duration) {
  const starts = [];
  for (let t = STREAM_START; t + duration <= STREAM_END; t += SLOT) starts.push(t);
  return starts;
}
