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
  assert.match(ticker, /Laravel/);
  for (const line of bannerLines()) assert.ok(line.length < 200 && !line.includes("\n"));

  const rules = await fetch(`${base}/rules`);
  const rulesText = await rules.text();
  assert.match(rulesText, /Jason, confirm this before the stream/);
  assert.match(rulesText, /No purchase or donation is necessary/);

  const enter = await fetch(`${base}/enter`);
  const enterText = await enter.text();
  assert.match(enterText, /name="share"/);
  assert.doesNotMatch(enterText, /name="share"[^>]*checked/);
  assert.match(enterText, /New MacBook Pro/);

  const bot = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Bot&email=bot@example.com&company_site=spam&all=yes",
    redirect: "manual",
  });
  assert.equal(bot.status, 303);
  assert.equal(await app.db.get("SELECT COUNT(*) AS n FROM entries").then((row) => Number(row.n)), 0);

  const joined = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Ada Lovelace&email=ada@example.com&prize=laravel&share=yes",
    redirect: "manual",
  });
  assert.equal(joined.status, 303);
  const again = await fetch(`${base}/enter`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: "name=Ada Lovelace&email=ada@example.com&prize=laravel&prize=tighten",
    redirect: "manual",
  });
  assert.equal(again.status, 303);
  assert.equal(await app.db.get("SELECT COUNT(*) AS n FROM entries").then((row) => Number(row.n)), 1);
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
  assert.match(await desk.text(), /Giveaway entries/);

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
