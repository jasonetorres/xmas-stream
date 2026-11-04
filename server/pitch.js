import { sponsorCard } from "./brands.js";
import { tierOpenings } from "./domain.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const COPY = {
  platinum: {
    price: "$3,000 cash, or a $1,500+ prize",
    block: "1-hour block",
    text: "Cash goes to freeCodeCamp. A prize at this level is an experience, a trip, or big-ticket gear worth $1,500 or more. You get a 1-hour block, plus a named segment inside it. Your logo is on screen all six hours, and Jason thanks you at the open and the close.",
    extra: `<div class="segments">
      <div class="segment"><b>The [Your Brand] Gift Drop</b>Your guest draws that hour’s winner live.</div>
      <div class="segment"><b>The [Your Brand] Hot Seat</b>A 10-minute holiday chat with someone from your team.</div>
    </div>`,
  },
  gold: {
    price: "$1,000 cash, or a $500+ prize",
    block: "30-minute block",
    text: "Cash goes to freeCodeCamp. Gear starts at $500. An experience or a trip starts at $1,000. You get a 30-minute block, bring a guest or jump into a game, and get a live giveaway moment.",
    extra: "",
  },
  silver: {
    price: "$500 cash",
    block: "No timed block",
    text: "Your $500 goes to freeCodeCamp. You get a shoutout during the stream and a spot on the sponsor logo wall.",
    extra: "",
  },
  community: {
    price: "$100+ cash",
    block: "No timed block",
    text: "Your gift goes to freeCodeCamp, and your name goes on the thank-you wall.",
    extra: "",
  },
};

function rosterList(roster) {
  if (!roster.length) return `<li class="quiet">No one at this level yet.</li>`;
  return roster.map((sponsor) => sponsorCard(sponsor)).join("");
}

export function tiersHtml(sponsors, caps) {
  return tierOpenings(sponsors, caps)
    .map((row) => {
      const copy = COPY[row.id];
      const flag = row.full ? "full" : "open";
      return `<article class="tier${row.id === "platinum" ? " top" : ""}" id="tier-${row.id}">
        <div class="tier-row"><h3>${esc(row.label)}</h3><span class="price">${esc(copy.price)}</span></div>
        <p class="spots" data-tier="${row.id}" data-open="${flag}">${esc(row.status)} · ${esc(copy.block)}</p>
        <p>${copy.text}</p>
        ${copy.extra}
        <ul class="roster">${rosterList(row.roster)}</ul>
      </article>`;
    })
    .join("");
}
