import { showcaseHtml } from "./brands.js";

/**
 * The public goal. The raised amount is the Tiltify campaign total only.
 * Sponsor cash is not part of that number. Donate buttons use `tiltifyUrl`.
 */
export const campaign = {
  cause: "freeCodeCamp",
  goal: 10000,
  tiltifyUrl: "https://tilt.fyi/9va4uz7GEn",
};

export const siteUrl = "https://jetdemo-xmas-stream-jetbrain.unkey.app";
export const tiltifyCampaign = {
  user: "tasonjorres",
  slug: "livestream-fundraiser-for-freecodecamporg",
  page: "https://tiltify.com/@tasonjorres/livestream-fundraiser-for-freecodecamporg",
};

export const prizes = [
  { item: "MacBook Pro", from: "Laravel" },
  { item: "Streaming gear bundle (details TBA)", from: "Mux" },
  { item: "Nintendo Switch 2", from: "Tighten" },
  { item: "All-access RenderATL ticket", from: "RenderATL" },
  { item: "Keychron keyboards", from: "WeMakeDevs", count: 5 },
  { item: "$3,000 cash", from: "Unkey" },
  { item: "$1,500 cash", from: "Temporal" },
  { item: "$1,000 cash", from: "Coder" },
  { item: "$500 cash", from: "Resend" },
  { item: "Work Louder keyboard", from: "CodeRabbit" },
  { item: "Amazon gift cards", from: "Torc" },
  { item: "Apple Watch Series 12 (GPS + Cellular) 42mm", from: "Level Up Financial Planning" },
];

export function money(amount) {
  const n = Math.round(Number(amount) || 0);
  return `$${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function prizeCard(prize) {
  const count = prize.count > 1 ? ` ×${prize.count}` : "";
  const note = prize.note ? ` · ${prize.note}` : "";
  return `<article class="prize"><b>${esc(prize.item)}${esc(count)}</b><span>${esc(prize.from)}${esc(note)}</span></article>`;
}

export function applyHome(html, sponsors = [], raisedAmount = 0) {
  const raised = Math.max(0, Math.round(Number(raisedAmount) || 0));
  const goal = campaign.goal;
  const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return html
    .replaceAll("__RAISED__", esc(money(raised)))
    .replaceAll("__GOAL__", esc(money(goal)))
    .replaceAll("__PERCENT__", String(percent))
    .replaceAll("__RAISED_RAW__", String(Math.round(raised)))
    .replaceAll("__GOAL_RAW__", String(Math.round(goal)))
    .replaceAll("__TILTIFY__", esc(campaign.tiltifyUrl))
    .replaceAll("__PRIZES__", prizes.map(prizeCard).join(""))
    .replaceAll("__SHOWCASE__", showcaseHtml(sponsors));
}
