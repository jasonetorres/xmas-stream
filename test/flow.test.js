import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import test from "node:test";
import { createApp } from "../server/app.js";
import { formatRange } from "../server/time.js";

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

  async function enterPortal(slug) {
    const c = client();
    const res = await c.fetch("/portal/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "code=sponsor-test-code",
    });
    assert.equal(res.status, 303, res.text);
    assert.equal(res.headers.get("location"), "/portal");
    const pick = await c.fetch("/portal");
    assert.match(pick.text, /name="slug" value="laravel"/);
    assert.match(pick.text, /Luke \/ LevelUp/);
    assert.match(pick.text, /CodeRabbit/);
    assert.match(pick.text, /Torc/);
    assert.match(pick.text, /RenderATL/);
    assert.doesNotMatch(pick.text, /New MacBook Pro/);
    assert.doesNotMatch(pick.text, /Book 1 hour/);
    const claim = await c.fetch("/portal/claim", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ slug }).toString(),
    });
    assert.equal(claim.status, 303, claim.text);
    return c;
  }

  async function follow(c, res) {
    return c.fetch(res.headers.get("location"));
  }

  const home = await client().fetch("/");
  assert.equal(home.status, 200);
  assert.match(home.text, /4 spots/);
  assert.match(home.text, /30-minute block/);
  assert.match(home.text, /1-hour block/);
  assert.match(home.text, /href="\/portal"/);
  assert.match(home.text, /JetBrains\+Mono/);
  assert.doesNotMatch(home.text, /Fraunces|Oswald/);
  assert.match(home.text, /\$4,000<\/b> of \$10,000 raised/);
  assert.match(home.text, /freeCodeCamp/);
  assert.match(home.text, /Sponsor with cash/);
  assert.match(home.text, /href="https:\/\/tilt\.fyi\/9va4uz7GEn"/);
  assert.match(home.text, /MacBook Pro/);
  assert.match(home.text, /RenderATL VIP ticket/);
  assert.match(home.text, /Keychron keyboards/);
  assert.match(home.text, /aria-valuenow="4000"/);
  assert.doesNotMatch(home.text, /\$200\+ prize/);
  assert.doesNotMatch(home.text, /any physical prize/);

  const health = await client().fetch("/health");
  assert.equal(health.status, 200);
  assert.equal(health.text, "ok\n");

  const bad = await client().fetch("/portal/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "code=not-a-real-code",
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
    body: "code=admin-test-code",
  });
  assert.match(adminOnPortal.headers.get("location"), /doesn/);

  const admin = await loginAdmin();
  const desk = await admin.fetch("/admin");
  assert.equal(desk.status, 200);
  assert.match(desk.text, /1 Platinum spot is still open/);
  assert.match(desk.text, /RenderATL/);
  assert.match(desk.text, /Prize sponsor/);
  assert.match(desk.text, /Gold is full \(4 of 4\)/);
  assert.match(desk.text, /Temporary storage/);
  assert.match(desk.text, /New MacBook Pro/);
  assert.match(desk.text, /NuPhy Air75 V3/);
  assert.match(desk.text, /Nintendo Switch 2/);
  assert.match(desk.text, /Work Louder keyboard/);
  assert.match(desk.text, /Amazon gift cards/);
  assert.match(desk.text, /id="sponsor-tighten"[\s\S]*\/portal\/logos\//);
  assert.match(desk.text, /\/portal\?s=laravel/);
  assert.match(desk.text, /\/portal\?s=luke/);
  assert.match(desk.text, /\/portal\?s=coderabbit/);

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

  const laravel = await enterPortal("laravel");
  const laravelHome = await laravel.fetch("/portal");
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
  assert.match(rabbitHome.text, /freeCodeCamp/);
  assert.doesNotMatch(rabbitHome.text, /name="prize_details"/);
  assert.doesNotMatch(rabbitHome.text, /name="shipping"/);

  const lukeEdited = await admin.fetch("/admin/sponsor", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      sponsor_id: /id="sponsor-luke"[\s\S]*?name="sponsor_id" value="(\d+)"/.exec(desk.text)[1],
      name: "Luke",
      tier: "gold",
      contact_name: "Luke",
      x_handle: "LukeCFPLevelUp",
      prize_details: "$500+ prize, details TBD",
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
  const kunalCard = after.text.slice(after.text.indexOf('id="sponsor-kunal"'), after.text.indexOf('id="sponsor-luke"'));
  assert.match(laravelCard, /No block booked/);
  assert.match(laravelCard, /Complete/);
  assert.match(kunalCard, /Booked · 2:00–2:30 PM ET/);
  assert.match(kunalCard, /5 Keychron keyboards/);
});
