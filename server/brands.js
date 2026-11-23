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
  mux: {
    website: "https://mux.com",
    logos: [
      "public/logos/mux-wordmark-white.svg",
      "public/logos/mux-wordmark-black.svg",
      "public/logos/mux-wordmark-medium-white.svg",
      "public/logos/mux-wordmark-white.png",
    ],
    hub: "/logos/mux-wordmark-white.svg",
    x: "https://x.com/davekiss",
    clear: true,
  },
  coder: {
    website: "https://coder.com",
    logos: ["public/logos/coder.png"],
    hub: "/logos/coder.png",
  },
  luke: {
    website: "https://www.levelupfinancialplanning.com/",
    logos: ["public/logos/levelup-white.png", "public/logos/levelup-dark.png"],
    hub: "/logos/levelup-white.png",
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
    note: "Jason confirmed this Randstad mark is Torc’s logo. The stream credits Torc.",
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
  resend: {
    website: "https://resend.com",
    logos: ["public/logos/resend-wordmark-white.svg", "public/logos/resend-wordmark-black.svg"],
    hub: "/logos/resend-wordmark-white.svg",
    x: "https://x.com/_christinacodes",
  },
};

const SHOWCASE = [
  { tier: "Platinum", id: "platinum", slugs: ["laravel", "unkey", "mux"] },
  { tier: "Gold", id: "gold", slugs: ["coder", "luke", "kunal", "tighten"] },
  { tier: "Silver", id: "silver", slugs: ["coderabbit", "torc", "renderatl", "resend"] },
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

function linkLabel(href) {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/** Logo, name, prize, then the website link. The logo sits in its own padded slot. */
export function sponsorCard(sponsor) {
  const brand = brandFor(sponsor.slug);
  const href = hubHref(sponsor);
  const mark = brand.hub
    ? `<img src="${esc(brand.hub)}" alt="">`
    : `<span class="badge">${esc(sponsor.name)}</span>`;
  const prize = sponsor.prize_details ? esc(sponsor.prize_details) : "Prize to be announced";
  const link = href ? `<a class="card-link" href="${esc(href)}">${esc(linkLabel(href))}</a>` : "";
  return `<li class="sponsor-card"><div class="logo-slot">${mark}</div><strong>${esc(sponsor.name)}</strong><small>${prize}</small>${link}</li>`;
}

export function showcaseHtml(sponsors) {
  return `<div class="tiers">${SHOWCASE.map((group) => {
    const items = showcaseRoster(sponsors, group).map((sponsor) => sponsorCard(sponsor)).join("");
    return `<article class="tier"><h3>${esc(group.tier)}</h3><ul>${items}</ul></article>`;
  }).join("")}</div>`;
}
