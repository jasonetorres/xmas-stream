import crypto from "node:crypto";
import { brandFor } from "./brands.js";
import { AppError } from "./domain.js";

export function isCashOnly(text) {
  const value = String(text || "").trim();
  return !value || /^cash donation$/i.test(value) || /^\$[\d,]+ cash$/i.test(value);
}

export function prizeCatalog(sponsors) {
  return (sponsors || [])
    .filter((sponsor) => sponsor.prize_details && !isCashOnly(sponsor.prize_details))
    .map((sponsor) => ({
      slug: sponsor.slug,
      sponsor: sponsor.name,
      prize: sponsor.prize_details,
      tier: sponsor.tier,
      url: sponsor.url || brandFor(sponsor.slug).website || "",
      logo: brandFor(sponsor.slug).hub || "",
    }));
}

export function publicName(entry) {
  const handle = String(entry?.handle || "").replace(/^@/, "").trim();
  if (handle) return `@${handle}`;
  const bits = String(entry?.name || "").trim().split(/\s+/).filter(Boolean);
  const first = bits[0] || "Friend";
  if (bits.length < 2) return first;
  return `${first} ${bits[bits.length - 1][0].toUpperCase()}.`;
}

export function entryPrizeSlugs(entry) {
  return String(entry?.prizes || "").split(",").map((slug) => slug.trim()).filter(Boolean);
}

export async function closedPrizeSlugs(db) {
  const rows = await db.all("SELECT DISTINCT prize_slug FROM draws WHERE status = 'winner'");
  return new Set(rows.map((row) => row.prize_slug));
}

export async function entryCounts(db, prizes) {
  const entries = await db.all("SELECT prizes FROM entries");
  const counts = new Map(prizes.map((prize) => [prize.slug, 0]));
  for (const entry of entries) {
    for (const slug of entryPrizeSlugs(entry)) {
      if (counts.has(slug)) counts.set(slug, counts.get(slug) + 1);
    }
  }
  const total = entries.length;
  return { total, counts };
}

function clean(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function saveEntry(db, input, prizes) {
  const trap = clean(input.company_site, 80);
  if (trap) return { ok: true, updated: false, silent: true };
  const name = clean(input.name, 80);
  const email = clean(input.email, 200).toLowerCase();
  const handle = clean(input.handle, 40).replace(/^@/, "");
  if (!name) throw new AppError("Add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("That email doesn’t look right.");
  const open = prizes.filter((prize) => !prize.closed).map((prize) => prize.slug);
  const wantsAll = input.all === "yes" || input.all === "on";
  const picked = wantsAll ? open : [].concat(input.prize || []).map(String).filter((slug) => open.includes(slug));
  if (!picked.length) throw new AppError("Pick at least one open prize, or choose all of them.");
  const share = input.share === "yes" || input.share === "on" ? 1 : 0;
  const now = new Date().toISOString();
  const existing = await db.get("SELECT id FROM entries WHERE email = ?", [email]);
  let id;
  if (existing) {
    id = Number(existing.id);
    await db.run(
      "UPDATE entries SET name = ?, handle = ?, prizes = ?, all_prizes = ?, share_opt_in = ?, updated_at = ? WHERE id = ?",
      [name, handle, picked.join(","), wantsAll ? 1 : 0, share, now, id]
    );
  } else {
    const row = await db.get(
      "INSERT INTO entries (name, email, handle, prizes, all_prizes, share_opt_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      [name, email, handle, picked.join(","), wantsAll ? 1 : 0, share, now, now]
    );
    id = Number(row.id);
  }
  if (share) await shareLeads(db, { id, name, email }, picked, prizes);
  return { ok: true, updated: Boolean(existing), silent: false };
}

async function shareLeads(db, entry, slugs, prizes) {
  const now = new Date().toISOString();
  for (const slug of slugs) {
    const prize = prizes.find((item) => item.slug === slug);
    if (!prize) continue;
    const sponsor = await db.get("SELECT id FROM sponsors WHERE slug = ?", [slug]);
    if (!sponsor) continue;
    const dup = await db.get("SELECT id FROM leads WHERE sponsor_id = ? AND lower(email) = ?", [sponsor.id, entry.email]);
    if (dup) continue;
    await db.run(
      "INSERT INTO leads (sponsor_id, name, email, platform, created_at) VALUES (?, ?, ?, ?, ?)",
      [sponsor.id, entry.name, entry.email, "Giveaway", now]
    );
  }
}

export async function drawWinner(db, slug, prizes) {
  const prize = prizes.find((item) => item.slug === slug);
  if (!prize) throw new AppError("That prize isn’t on the list.");
  const closed = await closedPrizeSlugs(db);
  if (closed.has(slug)) throw new AppError("That prize already has a winner. Re-draw if they don’t answer.");
  const winner = await pick(db, slug);
  if (!winner) throw new AppError("Nobody eligible is left for that prize.");
  const display = publicName(winner);
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO draws (prize_slug, entry_id, status, display_name, drawn_at) VALUES (?, ?, 'winner', ?, ?)",
    [slug, winner.id, display, now]
  );
  return { prize, display, decoys: await decoyNames(db, winner.id) };
}

export async function redrawWinner(db, slug, prizes) {
  const prize = prizes.find((item) => item.slug === slug);
  if (!prize) throw new AppError("That prize isn’t on the list.");
  const current = await db.get(
    "SELECT id FROM draws WHERE prize_slug = ? AND status = 'winner' ORDER BY id DESC LIMIT 1",
    [slug]
  );
  if (!current) throw new AppError("Draw a winner before you re-draw.");
  await db.run("UPDATE draws SET status = 'redrawn' WHERE id = ?", [current.id]);
  const winner = await pick(db, slug);
  if (!winner) throw new AppError("Nobody eligible is left for that prize.");
  const display = publicName(winner);
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO draws (prize_slug, entry_id, status, display_name, drawn_at) VALUES (?, ?, 'winner', ?, ?)",
    [slug, winner.id, display, now]
  );
  return { prize, display, decoys: await decoyNames(db, winner.id) };
}

async function pick(db, slug) {
  const entries = await db.all("SELECT id, name, email, handle, prizes FROM entries");
  const draws = await db.all("SELECT entry_id, prize_slug, status FROM draws");
  const champions = new Set(draws.filter((row) => row.status === "winner").map((row) => Number(row.entry_id)));
  const usedHere = new Set(draws.filter((row) => row.prize_slug === slug).map((row) => Number(row.entry_id)));
  const eligible = entries.filter((entry) => {
    if (champions.has(Number(entry.id)) || usedHere.has(Number(entry.id))) return false;
    return entryPrizeSlugs(entry).includes(slug);
  });
  if (!eligible.length) return null;
  return eligible[crypto.randomInt(eligible.length)];
}

async function decoyNames(db, winnerId) {
  const rows = await db.all("SELECT id, name, handle FROM entries WHERE id != ?", [winnerId]);
  return rows.map(publicName).slice(0, 24);
}

export async function drawLog(db) {
  return db.all(
    "SELECT prize_slug, display_name, status, drawn_at FROM draws ORDER BY id DESC"
  );
}

export function entrantCsv(entries, prizeSlug) {
  const lines = ["prize,name,email,handle,prizes,opted_in,created_at"];
  for (const entry of entries) {
    const slugs = entryPrizeSlugs(entry);
    if (prizeSlug && !slugs.includes(prizeSlug)) continue;
    lines.push([prizeSlug || slugs.join("|"), entry.name, entry.email, entry.handle, slugs.join("|"), entry.share_opt_in ? "yes" : "no", entry.created_at].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
