import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import test from "node:test";
import { createApp } from "../server/app.js";
import { confirmKunal, confirmLuke, confirmRenderAtl, confirmResend, confirmUnkey, ensureAccessCodes, ensureWebsites } from "../server/domain.js";
import { formatRange } from "../server/time.js";

function assertSponsorCards(html) {
  const cards = [...html.matchAll(/<li class="sponsor-card">([\s\S]*?)<\/li>/g)];
  assert.ok(cards.length >= 11, `expected a card per sponsor, got ${cards.length}`);
  for (const [, body] of cards) {
    const logo = body.search(/class="logo-slot(?: ink)?"/);
    const name = body.indexOf("<strong>");
    const prize = body.indexOf("<small>");
    const link = body.indexOf('class="card-link"');
    assert.ok(logo >= 0 && name > logo && prize > name && link > prize, body);
    assert.match(body, /<img |class="badge"/);
    assert.match(body, /<a class="card-link" href="https:\/\/[^"]+">/);
    assert.doesNotMatch(body, /Guest:|Lucas Casarez|stock compensation|mark-clear/);
  }
}

test("admin code keeps symbols, quotes, and spaces, and health hides the values", async (t) => {
  const app = await createApp({
    SESSION_SECRET: "test-secret-test-secret",
    ADMIN_CODE: "  'J@s0n-Admin!'  ",
    SPONSOR_CODE: "",
    SQLITE_PATH: ":memory:",
  });
  const server = http.createServer((req, res) => app.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  t.after(async () => {
    server.close();
    await app.close();
  });
  const health = await fetch(`${base}/health`);
  const body = await health.json();
  assert.deepEqual(body, { ok: true, adminCodeSet: true, sponsorCodeSet: false, tiltifyTokenSet: false });
  const missing = await fetch(`${base}/portal/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "code=anything",
    redirect: "manual",
  });
  assert.match(decodeURIComponent(missing.headers.get("location")), /Pick your name first/);
  const locked = await fetch(`${base}/admin/api/sponsor-codes`);
  assert.equal(locked.status, 401);
  const wrong = await fetch(`${base}/admin/api/sponsor-codes`, { headers: { "x-admin-code": "nope" } });
  assert.equal(wrong.status, 401);
  await app.db.run("UPDATE sponsors SET code_hash = ?, code_enc = ? WHERE slug = ?", ["00", "old-dashed-code", "renderatl"]);
  await ensureAccessCodes(app.db, "test-secret-test-secret", "J@s0n-Admin!");
  const codesRes = await fetch(`${base}/admin/api/sponsor-codes`, { headers: { "x-admin-code": "J@s0n-Admin!" } });
  assert.equal(codesRes.status, 200);
  const codesBody = await codesRes.json();
  assert.equal(codesBody.sponsors.length, 12);
  for (const sponsor of codesBody.sponsors) {
    assert.match(sponsor.code, /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  }
  assert.equal(JSON.stringify(codesBody).includes("J@s0n-Admin!"), false);
  await app.db.run("UPDATE sponsors SET url = ? WHERE slug = ?", ["https://example.com/kept", "coder"]);
  await ensureWebsites(app.db);
  const kept = await app.db.get("SELECT url FROM sponsors WHERE slug = ?", ["coder"]);
  const laravelUrl = await app.db.get("SELECT url FROM sponsors WHERE slug = ?", ["laravel"]);
  const lukeUrl = await app.db.get("SELECT url FROM sponsors WHERE slug = ?", ["luke"]);
  assert.equal(kept.url, "https://example.com/kept");
  assert.equal(laravelUrl.url, "https://laravel.com");
  assert.equal(lukeUrl.url, "https://www.levelupfinancialplanning.com/");
  await app.db.run(
    "UPDATE sponsors SET name = ?, url = ?, contact_name = ?, prize_details = ?, talking_points = ? WHERE slug = ?",
    ["Luke", "", "Luke", "$500+ prize, details TBD", "", "luke"]
  );
  await confirmLuke(app.db);
  const levelUp = await app.db.get("SELECT slug, name, url, contact_name, x_handle, prize_details, talking_points FROM sponsors WHERE slug = ?", ["luke"]);
  assert.equal(levelUp.slug, "luke");
  assert.equal(levelUp.name, "Level Up Financial Planning");
  assert.equal(levelUp.url, "https://www.levelupfinancialplanning.com/");
  assert.match(levelUp.contact_name, /Lucas Casarez, CFP®/);
  assert.equal(levelUp.x_handle, "LukeCFPLevelUp");
  assert.equal(levelUp.prize_details, "Apple Watch Series 12 (GPS + Cellular) 42mm");
  assert.match(levelUp.talking_points, /stock compensation/);
  await app.db.run("UPDATE sponsors SET name = ?, url = ? WHERE slug = ?", ["Kunal", "", "kunal"]);
  await confirmKunal(app.db);
  const wemakedevs = await app.db.get("SELECT slug, name, url, contact_name, x_handle, prize_details FROM sponsors WHERE slug = ?", ["kunal"]);
  assert.equal(wemakedevs.slug, "kunal");
  assert.equal(wemakedevs.name, "WeMakeDevs");
  assert.equal(wemakedevs.url, "https://www.wemakedevs.org/");
  assert.equal(wemakedevs.contact_name, "Kunal");
  assert.equal(wemakedevs.x_handle, "kunalstwt");
  assert.equal(wemakedevs.prize_details, "5 Keychron keyboards");
  await app.db.run("UPDATE sponsors SET prize_details = ? WHERE slug = ?", ["$3,000 cash + NuPhy Air75 V3", "unkey"]);
  await confirmUnkey(app.db);
  const unkeyPrize = await app.db.get("SELECT prize_details FROM sponsors WHERE slug = ?", ["unkey"]);
  assert.equal(unkeyPrize.prize_details, "$3,000 cash");
  await app.db.run("UPDATE sponsors SET name = ?, url = ? WHERE slug = ?", ["Custom Org", "https://example.com/kept-kunal", "kunal"]);
  await confirmKunal(app.db);
  const keptKunal = await app.db.get("SELECT name, url FROM sponsors WHERE slug = ?", ["kunal"]);
  assert.equal(keptKunal.name, "Custom Org");
  assert.equal(keptKunal.url, "https://example.com/kept-kunal");
  await app.db.run("UPDATE sponsors SET name = ?, url = ? WHERE slug = ?", ["WeMakeDevs", "https://www.wemakedevs.org/", "kunal"]);
  await app.db.run("UPDATE sponsors SET tier = ?, prize_details = ? WHERE slug = ?", ["prize", "RenderATL VIP ticket. Travel TBD.", "renderatl"]);
  await confirmRenderAtl(app.db);
  const confirmed = await app.db.get("SELECT tier, prize_details FROM sponsors WHERE slug = ?", ["renderatl"]);
  assert.equal(confirmed.tier, "silver");
  assert.equal(confirmed.prize_details, "All-access RenderATL ticket");
  await app.db.run("UPDATE sponsors SET tier = ?, prize_details = ? WHERE slug = ?", ["gold", "Custom prize", "renderatl"]);
  await confirmRenderAtl(app.db);
  const keptTier = await app.db.get("SELECT tier, prize_details FROM sponsors WHERE slug = ?", ["renderatl"]);
  assert.equal(keptTier.tier, "gold");
  assert.equal(keptTier.prize_details, "Custom prize");
  const typed = await fetch(`${base}/admin/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "jetdemo-xmas-stream-jetbrain.unkey.app",
    },
    body: "code=J%40s0n-Admin%21",
    redirect: "manual",
  });
  assert.equal(typed.headers.get("location"), "/admin");
  assert.match(typed.headers.get("set-cookie"), /Secure/);
  const cookie = typed.headers.getSetCookie()[0].split(";")[0];
  const desk = await fetch(`${base}/admin`, { headers: { cookie } });
  const deskText = await desk.text();
  assert.match(deskText, /Every/);
  assert.match(deskText, /Copy code/);
  assert.match(deskText, /Copy invite message/);
  assert.doesNotMatch(deskText, /Admin code/);
  const cookieOnly = await fetch(`${base}/admin/api/sponsor-codes`, { headers: { cookie } });
  assert.equal(cookieOnly.status, 401);
  const laravelCode = codesBody.sponsors.find((sponsor) => sponsor.slug === "laravel").code;
  const signedIn = await fetch(`${base}/portal/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `code=${laravelCode}&s=laravel`,
    redirect: "manual",
  });
  assert.equal(signedIn.headers.get("location"), "/portal?s=laravel");
  const other = codesBody.sponsors.find((sponsor) => sponsor.slug === "unkey").code;
  const crossed = await fetch(`${base}/portal/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `code=${other}&s=laravel`,
    redirect: "manual",
  });
  assert.match(decodeURIComponent(crossed.headers.get("location")), /doesn/);
});

test("form posts accept localhost aliases and reject other sites", async (t) => {
  const app = await createApp({
    SESSION_SECRET: "test-secret-test-secret",
    ADMIN_CODE: "admin-test-code",
    SPONSOR_CODE: "sponsor-test-code",
    SQLITE_PATH: ":memory:",
  });
  const server = http.createServer((req, res) => app.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  t.after(async () => {
    server.close();
    await app.close();
  });
  const login = await fetch(`http://127.0.0.1:${port}/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: `http://localhost:${port}` },
    body: "code=admin-test-code",
    redirect: "manual",
  });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get("location"), "/admin");
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  const foreign = await fetch(`http://127.0.0.1:${port}/admin/sponsors`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://evil.example", cookie },
    body: "name=Nope&tier=community",
    redirect: "manual",
  });
  assert.match(decodeURIComponent(foreign.headers.get("location")), /somewhere else/);
});

test("clock labels stay in 12-hour Eastern Time", () => {
  assert.equal(formatRange(14 * 60, 15 * 60), "2:00–3:00 PM ET");
  assert.equal(formatRange(14 * 60 + 30, 15 * 60), "2:30–3:00 PM ET");
  assert.equal(formatRange(11 * 60 + 30, 12 * 60 + 30), "11:30 AM–12:30 PM ET");
  assert.equal(formatRange(12 * 60, 12 * 60 + 30), "12:00–12:30 PM ET");
  assert.doesNotMatch(formatRange(19 * 60 + 30, 20 * 60), /\b(1[3-9]|2[0-3]):/);
});

test("sponsor portal flow", async (t) => {
  const app = await createApp({
    SESSION_SECRET: "test-secret-test-secret",
    ADMIN_CODE: "admin-test-code",
    SPONSOR_CODE: "sponsor-test-code",
    SQLITE_PATH: ":memory:",
  });
  const server = http.createServer((req, res) => app.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.close();
    await app.close();
  });

  function client() {
    let cookie = "";
    return {
      async fetch(path, opts = {}) {
        const headers = new Headers(opts.headers || {});
        if (cookie) headers.set("cookie", cookie);
        const target = path.startsWith("http") ? path : base + path;
        const res = await fetch(target, { ...opts, headers, redirect: "manual" });
        const set = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
        for (const line of set) {
          const pair = line.split(";")[0];
          cookie = pair.endsWith("=") ? "" : pair;
        }
        return { status: res.status, headers: res.headers, text: await res.text() };
      },
    };
  }

  async function loginAdmin() {
    const c = client();
    const res = await c.fetch("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "code=admin-test-code",
    });
    assert.equal(res.status, 303, res.text);
    assert.equal(res.headers.get("location"), "/admin");
    return c;
  }

  const codes = {};

  async function enterPortal(slug) {
    const c = client();
    const res = await c.fetch("/portal/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: codes[slug], s: slug }).toString(),
    });
    assert.equal(res.status, 303, res.text);
    assert.equal(res.headers.get("location"), `/portal?s=${slug}`);
    return c;
  }

  async function follow(c, res) {
    return c.fetch(res.headers.get("location"));
  }

  const home = await client().fetch("/");
  assert.equal(home.status, 200);
  assert.match(home.text, /Friday, December 18, 2026/);
  assert.match(home.text, /2:00–8:00 PM ET/);
  assert.match(home.text, /Multistream/);
  assert.match(home.text, /raised for charity/);
  assert.doesNotMatch(home.text, /free\s*code\s*camp|\bfcc\b/i);
  assert.match(home.text, /\$10,000/);
  assert.match(home.text, /\$0<\/b> of <span id="raised-goal">\$10,000<\/span> raised/);
  assert.match(home.text, /src="\/raise\.js"/);
  assert.doesNotMatch(home.text, /\$6,000<\/b>/);
  assert.match(home.text, /href="https:\/\/tilt\.fyi\/9va4uz7GEn"/);
  assert.match(home.text, />Donate</);
  assert.match(home.text, /Platinum[\s\S]*Laravel[\s\S]*Unkey[\s\S]*src="\/logos\/mux-wordmark-black\.svg"[\s\S]*Mux[\s\S]*Streaming gear bundle \(details TBA\)/);
  assert.doesNotMatch(home.text, /@LukeCFPLevelUp/);
  assert.match(home.text, /Coder/);
  assert.match(home.text, /WeMakeDevs/);
  assert.match(home.text, /Tighten/);
  assert.match(home.text, /CodeRabbit/);
  assert.match(home.text, /Torc/);
  assert.match(home.text, /The Price Is Merry/);
  assert.match(home.text, /Holiday Family Feud/);
  assert.match(home.text, /Wheel of Winter/);
  assert.match(home.text, /Deal or No Sleigh/);
  assert.match(home.text, /North Pole Password/);
  assert.match(home.text, /Christmas Millionaire/);
  assert.match(home.text, /Level Up Financial Planning/);
  assert.match(home.text, /href="https:\/\/findsanta\.vercel\.app"/);
  assert.doesNotMatch(home.text, /chrisstmass\.vercel\.app|christmasmillionaire\.vercel\.app|\/react|\/hostjt|\/games\/|class="watch"|Coming soon|ET ET/);
  assert.match(home.text, /The Price Is Merry[\s\S]*Holiday Family Feud[\s\S]*Wheel of Winter[\s\S]*Deal or No Sleigh[\s\S]*North Pole Password[\s\S]*Christmas Millionaire/);
  assert.match(home.text, /https:\/\/x\.com\/TasonJorres/);
  assert.match(home.text, /https:\/\/www\.linkedin\.com\/in\/thejasontorres/);
  assert.match(home.text, /href="\/sponsor">Sponsor the stream/);
  assert.match(home.text, /href="\/portal">Sponsor login/);
  assert.match(home.text, /src="\/logos\/laravel-wordmark\.png"/);
  assert.match(home.text, /src="\/logos\/unkey\.svg"/);
  assert.match(home.text, /src="\/logos\/coder\.png"/);
  assert.match(home.text, /src="\/logos\/tighten-mark\.png"/);
  assert.match(home.text, /src="\/logos\/coderabbit\.png"/);
  assert.match(home.text, /src="\/logos\/randstad\.png"/);
  assert.match(home.text, /href="https:\/\/laravel\.com"/);
  assert.match(home.text, /href="https:\/\/unkey\.com"/);
  assert.match(home.text, /href="https:\/\/coder\.com"/);
  assert.match(home.text, /href="https:\/\/tighten\.com"/);
  assert.match(home.text, /href="https:\/\/coderabbit\.ai"/);
  assert.match(home.text, /href="https:\/\/torc\.dev"/);
  assert.match(home.text, /src="\/logos\/levelup-dark\.png"/);
  assert.doesNotMatch(home.text, /class="badge">Level Up Financial Planning|levelup-white/);
  assert.match(home.text, /href="https:\/\/www\.levelupfinancialplanning\.com\/"/);
  assert.match(home.text, /Apple Watch Series 12 \(GPS \+ Cellular\) 42mm/);
  assert.match(home.text, /New MacBook Pro/);
  assert.match(home.text, /src="\/logos\/wemakedevs-wordmark-dark\.svg"/);
  assert.match(home.text, /href="https:\/\/www\.wemakedevs\.org\/"/);
  assert.match(home.text, /5 Keychron keyboards/);
  assert.doesNotMatch(home.text, /class="badge">Kunal</);
  assert.doesNotMatch(home.text, /kunalstwt|wemakedevs-wordmark-light|davekiss|_christinacodes|mux-wordmark-white|mux-wordmark-medium|resend-wordmark-white|temporal-wordmark-light/);
  assert.match(home.text, /src="\/logos\/mux-wordmark-black\.svg"/);
  assert.match(home.text, /<strong>Unkey<\/strong><small>\$3,000 cash<\/small>/);
  assert.doesNotMatch(home.text, /NuPhy|mark-clear/);
  assert.match(home.text, /href="https:\/\/mux\.com"/);
  assert.match(home.text, /<h3>Silver<\/h3>[\s\S]*src="\/logos\/resend-wordmark-black\.svg"[\s\S]*Resend[\s\S]*\$500 cash/);
  assert.match(home.text, /<h3>Gold<\/h3>[\s\S]*src="\/logos\/temporal-wordmark-dark\.svg"[\s\S]*Temporal[\s\S]*\$1,500 cash[\s\S]*href="https:\/\/temporal\.io"/);
  assert.match(home.text, /href="https:\/\/resend\.com"/);
  assert.doesNotMatch(home.text, /Lucas Casarez|stock compensation|Guest:/);
  assertSponsorCards(home.text);
  assert.match(home.text, /<h3>Gold<\/h3>[\s\S]*src="\/logos\/levelup-dark\.png"[\s\S]*Level Up Financial Planning[\s\S]*Apple Watch Series 12/);
  assert.match(home.text, /JetBrains\+Mono/);
  assert.doesNotMatch(home.text, /Fraunces|Oswald/);
  assert.doesNotMatch(home.text, /hostjt|\/displayurl/);
  assert.doesNotMatch(home.text, /href="\/admin/);
  assert.match(home.text, /<h3>Silver<\/h3>[\s\S]*src="\/logos\/renderatl-mark-dark\.svg"[\s\S]*All-access RenderATL ticket/);
  assert.doesNotMatch(home.text, /renderatl-mark-light|renderatl-wordmark-light/);

  const pitch = await client().fetch("/sponsor");
  assert.equal(pitch.status, 200);
  assert.match(pitch.text, /Interested\? Email jason\.torres@jetbrains\.com/);
  assert.match(pitch.text, /mailto:jason\.torres@jetbrains\.com/);
  assert.match(pitch.text, /Friday, December 18, 2026/);
  assert.match(pitch.text, /2:00–8:00 PM ET/);
  assert.match(pitch.text, /Multistream/);
  assert.match(pitch.text, /for charity/);
  assert.doesNotMatch(pitch.text, /free\s*code\s*camp|\bfcc\b/i);
  assert.match(pitch.text, /\$10,000/);
  assert.match(pitch.text, /\$0<\/b> of <span id="raised-goal">\$10,000<\/span> raised/);
  assert.doesNotMatch(pitch.text, /\$6,000<\/b>/);
  assert.match(pitch.text, /href="https:\/\/tilt\.fyi\/9va4uz7GEn"/);
  assert.match(pitch.text, /JetBrains\+Mono/);
  assert.match(pitch.text, /23K\+/);
  assert.match(pitch.text, /opt-in/);
  assert.match(pitch.text, /recap/i);
  assert.match(pitch.text, /Nov 13/);
  assert.match(pitch.text, /Nov 20/);
  assert.match(pitch.text, /Nov 30/);
  assert.match(pitch.text, /Dec 22/);
  assert.match(pitch.text, /id="tier-platinum"[\s\S]*Open · 1-hour block[\s\S]*Laravel[\s\S]*src="\/logos\/mux-wordmark-black\.svg"[\s\S]*<strong>Mux<\/strong><small>Streaming gear bundle \(details TBA\)<\/small>[\s\S]*href="https:\/\/mux\.com"[\s\S]*Unkey[\s\S]*\$3,000 cash/);
  assert.match(pitch.text, /id="tier-gold"[\s\S]*Open · 30-minute block[\s\S]*Coder[\s\S]*src="\/logos\/levelup-dark\.png"[\s\S]*Level Up Financial Planning[\s\S]*Apple Watch Series 12[\s\S]*Tighten[\s\S]*src="\/logos\/wemakedevs-wordmark-dark\.svg"[\s\S]*WeMakeDevs[\s\S]*5 Keychron keyboards/);
  assert.doesNotMatch(pitch.text, /NuPhy|mark-clear/);
  assert.doesNotMatch(pitch.text, /Full ·|sold out|\d+ of \d+|spot is still open|spots are still open/i);
  assert.doesNotMatch(pitch.text, /kunalstwt|class="badge">Kunal</);
  assert.doesNotMatch(pitch.text, /Lucas Casarez|stock compensation|Guest:/);
  assertSponsorCards(pitch.text);
  assert.match(pitch.text, /id="tier-silver"[\s\S]*Open · No timed block[\s\S]*CodeRabbit[\s\S]*src="\/logos\/renderatl-mark-dark\.svg"[\s\S]*All-access RenderATL ticket[\s\S]*src="\/logos\/resend-wordmark-black\.svg"[\s\S]*\$500 cash[\s\S]*Torc/);
  assert.match(pitch.text, /id="tier-gold"[\s\S]*Open · 30-minute block[\s\S]*src="\/logos\/temporal-wordmark-dark\.svg"[\s\S]*\$1,500 cash/);
  assert.doesNotMatch(pitch.text, /davekiss|_christinacodes|Dave Kiss|Christina/);
  assert.match(pitch.text, /id="tier-community"[\s\S]*Open · No timed block/);
  assert.match(pitch.text, /MacBook Pro/);
  assert.doesNotMatch(pitch.text, /Fraunces|__YOUTUBE__|__TIERS__|href="\/admin/);

  const health = await client().fetch("/health");
  assert.equal(health.status, 200);
  const healthBody = JSON.parse(health.text);
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.adminCodeSet, true);
  assert.equal(healthBody.sponsorCodeSet, true);
  assert.equal(health.text.includes("admin-test-code"), false);
  assert.equal(health.text.includes("sponsor-test-code"), false);

  const door = await client().fetch("/portal");
  assert.match(door.text, /href="\/portal\?s=laravel"/);
  assert.match(door.text, /Level Up Financial Planning/);
  assert.match(door.text, /href="\/portal\?s=luke"/);
  assert.match(door.text, /RenderATL/);
  assert.doesNotMatch(door.text, /New MacBook Pro/);
  assert.doesNotMatch(door.text, /name="code"/);

  const bad = await client().fetch("/portal/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "code=not-a-real-code&s=laravel",
  });
  assert.equal(bad.status, 303);
  assert.match(bad.headers.get("location"), /doesn/);

  const sneaky = await client().fetch("/%2e%2e/package.json");
  assert.equal(sneaky.status, 404);
  assert.doesNotMatch(sneaky.text, /xmas-stream/);

  const sponsorOnAdmin = await client().fetch("/admin/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "code=sponsor-test-code",
  });
  assert.match(sponsorOnAdmin.headers.get("location"), /doesn/);
  const adminOnPortal = await client().fetch("/portal/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "code=admin-test-code&s=laravel",
  });
  assert.match(adminOnPortal.headers.get("location"), /doesn/);

  const admin = await loginAdmin();
  const desk = await admin.fetch("/admin");
  assert.equal(desk.status, 200);
  assert.match(desk.text, /Platinum and Gold are open/);
  assert.doesNotMatch(desk.text, /is full|sold out|Full ·|spot is still open|spots are still open/i);
  assert.match(desk.text, /RenderATL/);
  assert.match(desk.text, /Prize sponsor/);
  assert.match(desk.text, /Gold books 30 minutes/);
  assert.match(desk.text, /Temporary storage/);
  assert.match(desk.text, /Tiltify donations: <b id="raised-amount">\$0<\/b> of <span id="raised-goal">\$10,000<\/span>/);
  assert.match(desk.text, /Sponsor cash is not included/);
  assert.match(desk.text, /id="game-night"[\s\S]*href="https:\/\/chrisstmass\.vercel\.app\/stream"/);
  assert.match(desk.text, /href="https:\/\/chrisstmass\.vercel\.app\/stream\/display"/);
  assert.match(desk.text, /href="https:\/\/chrisstmass\.vercel\.app\/games\/price"/);
  assert.match(desk.text, /href="https:\/\/chrisstmass\.vercel\.app\/games\/feud"/);
  assert.match(desk.text, /href="https:\/\/chrisstmass\.vercel\.app\/games\/wheel"/);
  assert.match(desk.text, /href="https:\/\/chrisstmass\.vercel\.app\/games\/deal"/);
  assert.match(desk.text, /href="https:\/\/chrisstmass\.vercel\.app\/games\/password"/);
  assert.match(desk.text, /href="https:\/\/chrisstmass\.vercel\.app\/hostjt"/);
  assert.doesNotMatch(desk.text, /\/react|\/vote/);
  assert.match(desk.text, /New MacBook Pro/);
  assert.match(desk.text, /id="sponsor-unkey"[\s\S]*\$3,000 cash/);
  assert.doesNotMatch(desk.text, /NuPhy/);
  assert.match(desk.text, /Nintendo Switch 2/);
  assert.match(desk.text, /Work Louder keyboard/);
  assert.match(desk.text, /Amazon gift cards/);
  assert.match(desk.text, /id="sponsor-tighten"[\s\S]*\/portal\/logos\//);
  assert.match(desk.text, /\/portal\?s=laravel/);
  assert.match(desk.text, /\/portal\?s=luke/);
  assert.match(desk.text, /\/portal\?s=coderabbit/);
  assert.match(desk.text, /Copy code/);
  assert.match(desk.text, /Copy invite message/);
  assert.match(desk.text, /Access code: /);
  assert.match(desk.text, /Logo: present · public\/logos\/laravel-wordmark\.png/);
  assert.doesNotMatch(desk.text, /Logo: missing/);
  assert.match(desk.text, /id="sponsor-renderatl"[\s\S]*tier">Silver[\s\S]*Confirmed Silver[\s\S]*All-access RenderATL ticket[\s\S]*renderatl-mark-dark\.svg/);
  assert.match(desk.text, /server\/seed-logos\/tighten-wordmark\.png/);
  assert.match(desk.text, /2 in the database/);
  assert.match(desk.text, /Website: <a href="https:\/\/laravel\.com"/);
  assert.match(desk.text, /id="sponsor-luke"[\s\S]*Level Up Financial Planning[\s\S]*Lucas Casarez, CFP®[\s\S]*Apple Watch Series 12[\s\S]*stock compensation[\s\S]*Logo: present · public\/logos\/levelup-white\.png[\s\S]*levelupfinancialplanning\.com/);
  assert.match(desk.text, /id="sponsor-torc"[\s\S]*randstad\.png/);
  assert.match(desk.text, /id="sponsor-kunal"[\s\S]*WeMakeDevs[\s\S]*@kunalstwt[\s\S]*5 Keychron keyboards[\s\S]*wemakedevs-wordmark-light\.svg[\s\S]*https:\/\/www\.wemakedevs\.org\//);
  assert.match(desk.text, /id="sponsor-mux"[\s\S]*Mux[\s\S]*@davekiss[\s\S]*Dave Kiss[\s\S]*Streaming gear bundle \(details TBA\)[\s\S]*mux-wordmark-white\.svg[\s\S]*https:\/\/mux\.com/);
  assert.match(desk.text, /id="sponsor-resend"[\s\S]*Resend[\s\S]*@_christinacodes[\s\S]*Confirmed Silver, \$500 cash[\s\S]*Christina[\s\S]*resend-wordmark-white\.svg[\s\S]*https:\/\/resend\.com/);
  assert.match(desk.text, /id="sponsor-temporal"[\s\S]*Temporal[\s\S]*No block booked[\s\S]*\$1,500 cash[\s\S]*temporal-wordmark-light\.svg[\s\S]*https:\/\/temporal\.io/);
  const codeFile = await client().fetch("/admin/api/sponsor-codes", { headers: { "x-admin-code": "admin-test-code" } });
  assert.equal(codeFile.status, 200);
  for (const sponsor of JSON.parse(codeFile.text).sponsors) codes[sponsor.slug] = sponsor.code;
  assert.match(codes.laravel, /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  assert.match(codes.mux, /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  assert.match(codes.resend, /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  assert.notEqual(codes.mux, codes.resend);
  assert.notEqual(codes.mux, codes.laravel);
  const sessionOnly = await admin.fetch("/admin/api/sponsor-codes");
  assert.equal(sessionOnly.status, 401);

  const added = await admin.fetch("/admin/sponsors", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "Extra Platinum", tier: "platinum" }).toString(),
  });
  assert.equal(added.status, 303, added.text);
  assert.match(added.headers.get("location") || "", /saved=added/);
  const filled = await admin.fetch("/sponsor");
  assert.match(filled.text, /id="tier-platinum"[\s\S]*Open · 1-hour block[\s\S]*Extra Platinum[\s\S]*Mux/);
  assert.doesNotMatch(filled.text, /Full ·|sold out|\d+ of \d+/i);
  const filledDesk = await admin.fetch("/admin");
  const extraId = /id="sponsor-extra-platinum"[\s\S]*?name="sponsor_id" value="(\d+)"/.exec(filledDesk.text)[1];
  const removed = await admin.fetch("/admin/sponsor/delete", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ sponsor_id: extraId, confirm: "yes" }).toString(),
  });
  assert.equal(removed.status, 303, removed.text);
  const stillOpen = await admin.fetch("/sponsor");
  assert.match(stillOpen.text, /Open · 1-hour block/);
  assert.doesNotMatch(stillOpen.text, /Extra Platinum|Full ·|\d+ of \d+/);
  const muxDoor = await client().fetch("/portal?s=mux");
  const resendDoor = await client().fetch("/portal?s=resend");
  assert.equal(muxDoor.status, 200);
  assert.equal(resendDoor.status, 200);
  assert.match(muxDoor.text, /<h1>Mux</);
  assert.match(resendDoor.text, /<h1>Resend</);
  assert.doesNotMatch(muxDoor.text, /davekiss|Streaming gear/);
  assert.doesNotMatch(resendDoor.text, /christinacodes|Cash donation/);
  await app.db.run("UPDATE sponsors SET prize_details = ? WHERE slug = ?", ["Cash donation", "resend"]);
  await confirmResend(app.db);
  const resendPrize = await app.db.get("SELECT prize_details FROM sponsors WHERE slug = ?", ["resend"]);
  assert.equal(resendPrize.prize_details, "$500 cash");

  const direct = client();
  const directLogin = await direct.fetch("/portal/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "code=sponsor-test-code&s=laravel",
  });
  assert.equal(directLogin.status, 303);
  const directPage = await direct.fetch("/portal");
  assert.match(directPage.text, /<h1>Laravel</);
  assert.doesNotMatch(directPage.text, /Who’s/);
  assert.doesNotMatch(directPage.text, /NuPhy/);
  await direct.fetch("/portal/logout", { method: "POST" });

  const crossed = await client().fetch("/portal/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: codes.unkey, s: "laravel" }).toString(),
  });
  assert.match(crossed.headers.get("location"), /doesn/);

  const laravel = await enterPortal("laravel");
  const laravelHome = await laravel.fetch("/portal");
  assert.match(laravelHome.text, /Website/);
  assert.match(laravelHome.text, /value="https:\/\/laravel\.com"/);
  const peek = await laravel.fetch("/portal?s=unkey");
  assert.match(peek.text, /Enter the access code Jason sent Unkey/);
  assert.doesNotMatch(peek.text, /Book 1 hour/);
  assert.doesNotMatch(peek.text, /NuPhy/);
  assert.match(laravelHome.text, /Book 1 hour/);
  assert.match(laravelHome.text, /JetBrains\+Mono/);
  assert.doesNotMatch(laravelHome.text, /All leads CSV|NuPhy/);
  assert.match(laravelHome.text, /Gift Drop/);

  const booked = await laravel.fetch("/portal/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "book", start: String(14 * 60), gift_drop: "on", guest_name: "Amina" }).toString(),
  });
  assert.equal(booked.status, 303);
  const laravelBooked = await follow(laravel, booked);
  assert.match(laravelBooked.text, /2:00–3:00 PM ET/);
  assert.match(laravelBooked.text, /Amina/);
  assert.match(laravelBooked.text, /Gift Drop/);

  const unkey = await enterPortal("unkey");
  const overlap = await unkey.fetch("/portal/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "book", start: String(14 * 60 + 30) }).toString(),
  });
  const overlapPage = await follow(unkey, overlap);
  assert.match(overlapPage.text, /already taken/);
  assert.match(overlapPage.text, />Taken</);
  assert.doesNotMatch(overlapPage.text, /Laravel/);
  assert.doesNotMatch(overlapPage.text, /Amina/);
  assert.doesNotMatch(overlapPage.text, /You’re on 2:30/);

  const unkeyBooked = await unkey.fetch("/portal/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "book", start: String(16 * 60) }).toString(),
  });
  assert.match((await follow(unkey, unkeyBooked)).text, /4:00–5:00 PM ET/);

  const coder = await enterPortal("coder");
  const coderPage = await coder.fetch("/portal");
  assert.match(coderPage.text, /Book 30 minutes/);
  const coderBooked = await coder.fetch("/portal/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "book", start: String(15 * 60) }).toString(),
  });
  assert.match((await follow(coder, coderBooked)).text, /3:00–3:30 PM ET/);

  const rabbit = await enterPortal("coderabbit");
  const rabbitTry = await rabbit.fetch("/portal/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "book", start: String(18 * 60) }).toString(),
  });
  assert.match((await follow(rabbit, rabbitTry)).text, /no stream block to book/);
  const rabbitHome = await rabbit.fetch("/portal");
  assert.match(rabbitHome.text, /Cash gift/);
  assert.match(rabbitHome.text, /for charity/);
  assert.doesNotMatch(rabbitHome.text, /free\s*code\s*camp|\bfcc\b/i);
  assert.doesNotMatch(rabbitHome.text, /name="prize_details"/);
  assert.doesNotMatch(rabbitHome.text, /name="shipping"/);

  const lukeEdited = await admin.fetch("/admin/sponsor", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      sponsor_id: /id="sponsor-luke"[\s\S]*?name="sponsor_id" value="(\d+)"/.exec(desk.text)[1],
      name: "Level Up Financial Planning",
      tier: "gold",
      contact_name: "Lucas Casarez, CFP®, Founder of Level Up Financial Planning",
      x_handle: "LukeCFPLevelUp",
      prize_details: "Apple Watch Series 12 (GPS + Cellular) 42mm",
      url: "https://www.levelupfinancialplanning.com/",
      not_before: String(15 * 60),
    }).toString(),
  });
  assert.equal(lukeEdited.status, 303);
  const luke = await enterPortal("luke");
  const tooEarly = await luke.fetch("/portal/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "book", start: String(14 * 60) }).toString(),
  });
  assert.match((await follow(luke, tooEarly)).text, /earliest start is 3:00 PM ET/);
  const lukeBooked = await luke.fetch("/portal/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "book", start: String(17 * 60) }).toString(),
  });
  assert.match((await follow(luke, lukeBooked)).text, /5:00–5:30 PM ET/);

  const logo = fs.readFileSync(new URL("../server/seed-logos/tighten-mark.png", import.meta.url));
  const form = new FormData();
  form.set("url", "https://laravel.com");
  form.set("talking_points", "We build the PHP framework people actually enjoy.");
  form.set("prize_details", "New MacBook Pro");
  form.set("shipping", "Cash and hardware handled by Laravel. Nothing for Jason to ship.");
  form.set("x_handle", "laravel");
  form.set("credit", "Laravel");
  form.set("logo", new Blob([logo], { type: "image/png" }), "mark.png");
  const saved = await laravel.fetch("/portal/assets", { method: "POST", body: form });
  const savedPage = await follow(laravel, saved);
  assert.match(savedPage.text, /Complete/);
  assert.match(savedPage.text, /laravel\.com/);

  const logoPath = /\/portal\/logos\/\d+/.exec(savedPage.text)[0];
  const logoRes = await laravel.fetch(logoPath);
  assert.equal(logoRes.status, 200);
  assert.match(logoRes.headers.get("content-type"), /image\/png/);
  const stranger = await client().fetch(logoPath);
  assert.equal(stranger.status, 401);

  const denied = await laravel.fetch("/admin");
  assert.equal(denied.status, 403);
  assert.doesNotMatch(denied.text, /Private link|All leads CSV|Gold is full/);
  const blocked = await laravel.fetch("/admin/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "sponsor_id=2&start=840&force=yes",
  });
  assert.match(decodeURIComponent(blocked.headers.get("location") || ""), /Jason/);
  const leads = await laravel.fetch("/admin/leads.csv");
  assert.equal(leads.status, 401);
  const adminLeads = await admin.fetch("/admin/leads.csv");
  assert.equal(adminLeads.status, 200);
  assert.match(adminLeads.text, /^sponsor,name,email,platform,opted_in_at/);

  const freshDesk = await admin.fetch("/admin");
  const kunalId = /id="sponsor-kunal"[\s\S]*?name="sponsor_id" value="(\d+)"/.exec(freshDesk.text)[1];
  const forced = await admin.fetch("/admin/booking", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ sponsor_id: kunalId, start: String(14 * 60), force: "yes" }).toString(),
  });
  const after = await follow(admin, forced);
  const laravelCard = after.text.slice(after.text.indexOf('id="sponsor-laravel"'), after.text.indexOf('id="sponsor-unkey"'));
  const kunalCard = after.text.slice(after.text.indexOf('id="sponsor-kunal"'), after.text.indexOf('id="sponsor-coderabbit"'));
  assert.match(laravelCard, /No block booked/);
  assert.match(laravelCard, /Complete/);
  assert.match(kunalCard, /Booked · 2:00–2:30 PM ET/);
  assert.match(kunalCard, /5 Keychron keyboards/);
});
