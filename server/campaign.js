/**
 * The one place Jason edits the public fundraiser.
 * Change `raised` when more cash lands. Add a prize by appending to `prizes`.
 * Paste the live Tiltify campaign URL into `tiltifyUrl` when that page exists.
 */
export const campaign = {
  cause: "freeCodeCamp",
  goal: 10000,
  raised: 4000,
  tiltifyUrl: "https://tiltify.com",
};

export const prizes = [
  { item: "MacBook Pro", from: "Laravel" },
  { item: "Nintendo Switch 2", from: "Tighten" },
  { item: "RenderATL VIP ticket", from: "RenderATL", note: "Travel TBD" },
  { item: "Keychron keyboards", from: "Kunal", count: 5 },
  { item: "NuPhy Air75 V3", from: "Unkey" },
  { item: "Work Louder keyboard", from: "CodeRabbit" },
  { item: "Amazon gift cards", from: "Torc" },
  { item: "$500+ prize", from: "Luke", note: "TBD" },
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

export function applyHome(html) {
  const raised = campaign.raised;
  const goal = campaign.goal;
  const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return html
    .replaceAll("__RAISED__", esc(money(raised)))
    .replaceAll("__GOAL__", esc(money(goal)))
    .replaceAll("__PERCENT__", String(percent))
    .replaceAll("__RAISED_RAW__", String(Math.round(raised)))
    .replaceAll("__GOAL_RAW__", String(Math.round(goal)))
    .replaceAll("__TILTIFY__", esc(campaign.tiltifyUrl))
    .replaceAll("__PRIZES__", prizes.map(prizeCard).join(""));
}
