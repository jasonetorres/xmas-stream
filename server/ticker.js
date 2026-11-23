import { campaign, siteUrl } from "./campaign.js";

const ENTER = `${siteUrl}/enter`;

export function tickerText(sponsors) {
  const names = (sponsors || []).map((sponsor) => sponsor.name).filter(Boolean).join(", ");
  const line = `Donate at tilt.fyi/9va4uz7GEn · Raising $${campaign.goal.toLocaleString("en-US")} for freeCodeCamp · Thank you ${names} · Enter the giveaway at ${ENTER} · No donation needed to enter`;
  return line.replace(/\s+/g, " ").trim();
}

export function bannerLines() {
  return [
    "Donate at tilt.fyi/9va4uz7GEn. Every dollar goes to freeCodeCamp.",
    "Goal: $10,000 for freeCodeCamp. The giveaway needs no donation.",
    "Enter the giveaway. One entry per email. No purchase necessary.",
    "Six holiday games, 2:00–8:00 PM ET, Friday, December 18.",
    "Thank you to every sponsor on the Christmas Birthday Stream.",
    "Scan the on-screen QR or open the entry page. No donation needed.",
    "Call Santa finale at 7:00 PM ET. Stay through the end.",
    `Be a guest. Request a half-hour slot at ${siteUrl}/guests.`,
  ];
}
