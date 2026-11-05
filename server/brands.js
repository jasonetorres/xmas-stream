/**
 * Logo files and websites checked against the repo.
 * No sponsor stores a logo URL. Uploads live as bytes in the logos table.
 * A public file is what the hub shows. An empty list means a text badge.
 */
export const BRANDS = {
  laravel: {
    website: "https://laravel.com",
    logos: ["public/logos/laravel-wordmark.png", "public/logos/laravel-mark.png"],
    hub: "/logos/laravel-wordmark.png",
  },
  unkey: {
    website: "https://unkey.com",
    logos: ["public/logos/unkey.svg"],
    hub: "/logos/unkey.svg",
  },
  coder: {
    website: "https://coder.com",
    logos: ["public/logos/coder.png"],
    hub: "/logos/coder.png",
  },
  luke: {
    website: "https://www.levelupfinancialplanning.com/",
    logos: [],
    x: "https://x.com/LukeCFPLevelUp",
  },
  kunal: {
    website: "https://www.wemakedevs.org/",
    logos: [
      "public/logos/wemakedevs-wordmark-light.svg",
      "public/logos/wemakedevs-wordmark-dark.svg",
    ],
    hub: "/logos/wemakedevs-wordmark-light.svg",
    x: "https://x.com/kunalstwt",
  },
  tighten: {
    website: "https://tighten.com",
    logos: ["public/logos/tighten-mark.png", "server/seed-logos/tighten-mark.png", "server/seed-logos/tighten-wordmark.png"],
    hub: "/logos/tighten-mark.png",
    dbSeed: ["server/seed-logos/tighten-mark.png", "server/seed-logos/tighten-wordmark.png"],
  },
  coderabbit: {
    website: "https://coderabbit.ai",
    logos: ["public/logos/coderabbit.png"],
    hub: "/logos/coderabbit.png",
  },
  torc: {
    website: "https://torc.dev",
    logos: ["public/logos/randstad.png"],
    hub: "/logos/randstad.png",
    note: "The file is the Randstad mark. The stream credits Torc.",
  },
  renderatl: {
    website: "https://renderatl.com",
    logos: [
      "public/logos/renderatl-wordmark-dark.svg",
      "public/logos/renderatl-wordmark-light.svg",
      "public/logos/renderatl-mark-dark.svg",
      "public/logos/renderatl-mark-light.svg",
    ],
    hub: "/logos/renderatl-mark-dark.svg",
  },
};

const SHOWCASE = [
  { tier: "Platinum", id: "platinum", slugs: ["laravel", "unkey"] },
  { tier: "Gold", id: "gold", slugs: ["coder", "luke", "kunal", "tighten"] },
  { tier: "Silver", id: "silver", slugs: ["coderabbit", "torc", "renderatl"] },
];

export function brandFor(slug) {
  return BRANDS[slug] || { website: "", logos: [], hub: "" };
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function hubHref(sponsor) {
  const brand = brandFor(sponsor?.slug);
  if (sponsor?.url) return sponsor.url;
  if (brand.website) return brand.website;
  if (brand.x) return brand.x;
  const handle = sponsor?.x_handle;
  if (handle) return `https://x.com/${handle}`;
  return "";
}

export function logoStatusText(sponsor) {
  const brand = brandFor(sponsor.slug);
  const files = brand.logos || [];
  const uploaded = sponsor.logoCount || sponsor.logos?.length || 0;
  const fileBit = files.length ? `present · ${files.join(", ")}` : "missing";
  const dbBit = uploaded ? `${uploaded} in the database` : "none in the database";
  return `Logo: ${fileBit} · ${dbBit}`;
}

function showcaseRoster(sponsors, group) {
  const inTier = (sponsors || []).filter((sponsor) => sponsor.tier === group.id);
  const rank = new Map(group.slugs.map((slug, index) => [slug, index]));
  return inTier.sort((a, b) => (rank.get(a.slug) ?? 99) - (rank.get(b.slug) ?? 99) || a.name.localeCompare(b.name));
}

/** Same four fields on every public card: name, logo or badge, website, prize. */
export function sponsorCard(sponsor) {
  const brand = brandFor(sponsor.slug);
  const href = hubHref(sponsor);
  const mark = brand.hub
    ? `<img src="${esc(brand.hub)}" alt="${esc(sponsor.name)}">`
    : `<span class="badge">${esc(sponsor.name)}</span>`;
  const prize = sponsor.prize_details ? `<small>${esc(sponsor.prize_details)}</small>` : `<small>Prize to be announced</small>`;
  const body = `${mark}<span>${esc(sponsor.name)}</span>${prize}`;
  const card = href ? `<a class="brand" href="${esc(href)}">${body}</a>` : `<div class="brand">${body}</div>`;
  return `<li>${card}</li>`;
}

export function showcaseHtml(sponsors) {
  return `<div class="tiers">${SHOWCASE.map((group) => {
    const items = showcaseRoster(sponsors, group).map((sponsor) => sponsorCard(sponsor)).join("");
    return `<article class="tier"><h3>${esc(group.tier)}</h3><ul>${items}</ul></article>`;
  }).join("")}</div>`;
}
