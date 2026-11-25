import { campaign, siteUrl } from "./campaign.js";

const ENTER = `${siteUrl}/enter`;

export function tickerText(sponsors) {
  const names = (sponsors || []).map((sponsor) => sponsor.name).filter(Boolean).join(", ");
  const line = `Donate at tilt.fyi/9va4uz7GEn · Raising $${campaign.goal.toLocaleString("en-US")} for freeCodeCamp · Thank you ${names} · Enter the giveaway at ${ENTER} · No donation needed to enter · Open to US residents only`;
  return line.replace(/\s+/g, " ").trim();
}

export function bannerLines() {
  return [
    "Donate at tilt.fyi/9va4uz7GEn. Every dollar goes to freeCodeCamp.",
    "Goal: $10,000 for freeCodeCamp. The giveaway needs no donation.",
    "Enter the giveaway. Open to US residents only. One entry per email. No purchase necessary.",
    "Open to US residents only.",
    "Six holiday games, 2:00–8:00 PM ET, Friday, December 18.",
    "Thank you to every sponsor on the Christmas Birthday Stream.",
    "Scan the on-screen QR or open the entry page. No donation needed.",
    "Call Santa opens at 2:00 PM ET. Christmasaire 2.0 closes the show at 7:00.",
    `Be a guest. Request a half-hour slot at ${siteUrl}/guests.`,
  ];
}
