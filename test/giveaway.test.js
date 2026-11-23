import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import test from "node:test";
import { createApp } from "../server/app.js";
import { bannerLines, tickerText } from "../server/ticker.js";
import { listSponsors } from "../server/domain.js";

test("ticker, rules, entry, and draw stay inside the stream rules", async (t) => {
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

  const sponsors = await listSponsors(app.db, "test-secret-test-secret");
  const ticker = tickerText(sponsors);
  assert.ok(ticker.length <= 1000, ticker.length);
  assert.equal(ticker.includes("\n"), false);
  assert.match(ticker, /tilt\.fyi\/9va4uz7GEn/);
  assert.match(ticker, /No donation needed to enter/);
  assert.match(ticker, /Open to US residents only/);
  assert.match(ticker, /Laravel/);
  for (const line of bannerLines()) assert.ok(line.length < 200 && !line.includes("\n"));
  assert.equal(bannerLines().some((line) => /Platinum books an hour/i.test(line)), false);
  assert.match(bannerLines().join("\n"), /\/guests/);
  assert.match(bannerLines().join("\n"), /Open to US residents only/);

  const rules = await fetch(`${base}/rules`);
  const rulesText = await rules.text();
  assert.match(rulesText, /Jason, confirm this before the stream/);
  assert.match(rulesText, /No purchase or donation is necessary/);
  assert.match(rulesText, /Legal residents of the United States/);
  assert.match(rulesText, /minimum age still needs your sign-off/);
  assert.match(rulesText, /72 hours/);
  assert.match(rulesText, /jason\.torres@jetbrains\.com/);
  assert.match(rulesText, /New MacBook Pro/);
  assert.match(rulesText, /not affiliated with or endorsed by any platform/);

  const enter = await fetch(`${base}/enter`);
  const enterText = await enter.text();
  assert.match(enterText, /Open to US residents only/);
  assert.match(enterText, /name="us"/);
  assert.match(enterText, /I live in the United States/);
  assert.match(enterText, /name="share"/);
  assert.doesNotMatch(enterText, /name="share"[^>]*checked/);
  assert.match(enterText, /New MacBook Pro/);
  assert.match(enterText, /input\[type="checkbox"\][\s\S]*width:22px/);
  assert.match(enterText, /label\.prize[\s\S]*text-align:left/);

  const bot = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Bot&email=bot@example.com&company_site=spam&all=yes",
    redirect: "manual",
  });
  assert.equal(bot.status, 303);
  assert.equal(await app.db.get("SELECT COUNT(*) AS n FROM entries").then((row) => Number(row.n)), 0);

  const missingUs = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Ada Lovelace&email=ada@example.com&prize=laravel",
    redirect: "manual",
  });
  assert.equal(missingUs.status, 303);
  assert.match(decodeURIComponent(missingUs.headers.get("location")), /United States/);
  assert.equal(await app.db.get("SELECT COUNT(*) AS n FROM entries").then((row) => Number(row.n)), 0);

  const joined = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Ada Lovelace&email=ada@example.com&prize=laravel&share=yes&us=yes",
    redirect: "manual",
  });
  assert.equal(joined.status, 303);
  const again = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Ada Lovelace&email=ada@example.com&prize=laravel&prize=tighten&us=yes",
    redirect: "manual",
  });
  assert.equal(again.status, 303);
  assert.equal(await app.db.get("SELECT COUNT(*) AS n FROM entries").then((row) => Number(row.n)), 1);
  const grace = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Grace Hopper&email=grace@example.com&prize=tighten&us=yes",
    redirect: "manual",
  });
  assert.equal(grace.status, 303);
  const lead = await app.db.get("SELECT email, platform FROM leads WHERE email = ?", ["ada@example.com"]);
  assert.equal(lead.platform, "Giveaway");

  const locked = await fetch(`${base}/draw`);
  assert.match(await locked.text(), /Jason/);
  const login = await fetch(`${base}/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "code=admin-test-code",
    redirect: "manual",
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const drawn = await fetch(`${base}/draw`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base, cookie },
    body: "prize=laravel",
  });
  const reveal = await drawn.text();
  assert.match(reveal, /Ada L\./);
  assert.doesNotMatch(reveal, /ada@example.com/);
  const desk = await fetch(`${base}/admin`, { headers: { cookie } });
  const deskText = await desk.text();
  assert.match(deskText, /Giveaway entries/);
  assert.match(deskText, /New MacBook Pro: 0 in the pool/);
  assert.match(deskText, /Nintendo Switch 2: 1 in the pool/);
  const next = await fetch(`${base}/draw`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base, cookie },
    body: "prize=tighten",
  });
  const second = await next.text();
  assert.match(second, /data-winner="Grace H\."/);
  assert.doesNotMatch(second, /data-winner="Ada/);

  const goal = await fetch(`${base}/api/live/goal`);
  const goalBody = await goal.json();
  assert.equal(goalBody.source, "fallback");
  assert.equal(JSON.stringify(goalBody).includes("TILTIFY"), false);
  const green = await fetch(`${base}/live/goal?mode=green`);
  assert.match(await green.text(), /body class="green"/);
  const up = await fetch(`${base}/live/up-next`);
  assert.match(await up.text(), /Starting soon|Christmasaire|Thanks for watching/);

  const dir = new URL("../public/overlays/", import.meta.url);
  const frame = fs.readFileSync(new URL("frame.png", dir));
  assert.equal(frame.readUInt32BE(16), 1280);
  assert.equal(frame.readUInt32BE(20), 720);
  const gif = fs.statSync(new URL("starting-soon.gif", dir));
  assert.ok(gif.size < 3 * 1024 * 1024);
});
