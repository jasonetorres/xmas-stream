import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../server/app.js";
import { SEGMENTS } from "../server/schedule.js";
import { gamePack } from "../server/games.js";

test("the six hours run Santa to Christmasaire, and host controls move the display", async (t) => {
  assert.deepEqual(SEGMENTS.map((segment) => segment.id), ["santa", "movie", "price", "feud", "sweater", "christmasaire"]);
  assert.equal(SEGMENTS[0].href, "https://findsanta.vercel.app");
  assert.equal(SEGMENTS[5].href, "https://christmasmillionaire.vercel.app");
  assert.equal(SEGMENTS[5].soon, true);
  for (const slug of ["movie", "price", "feud", "sweater"]) {
    assert.ok(gamePack(slug).rounds?.length >= 15 || gamePack(slug).dares?.length >= 6);
  }
  assert.equal(gamePack("price").rounds.at(-1).showcase, true);
  assert.ok(gamePack("feud").rounds.every((round) => round.answers.length >= 4 && round.answers.length <= 8));

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
  const origin = { "content-type": "application/x-www-form-urlencoded", origin: base };

  const index = await fetch(`${base}/games`);
  assert.equal(index.status, 200);
  const indexText = await index.text();
  assert.match(indexText, /Call Santa/);
  assert.match(indexText, /2:00–3:00 PM ET/);
  assert.doesNotMatch(indexText, /ET ET/);
  assert.match(indexText, /Coming soon/);
  assert.match(indexText, /href="\/games\/price\/display"/);

  const locked = await fetch(`${base}/games/movie/host`);
  assert.match(await locked.text(), /Jason’s code is required/);
  const blocked = await fetch(`${base}/games/movie/host`, { method: "POST", headers: origin, body: "action=point", redirect: "manual" });
  assert.equal(blocked.status, 200);
  const before = await (await fetch(`${base}/games/movie/display`)).text();
  assert.match(before, /Score 0/);
  assert.doesNotMatch(before, /Home Alone/);

  const login = await fetch(`${base}/admin/login`, { method: "POST", headers: origin, body: "code=admin-test-code", redirect: "manual" });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const auth = { ...origin, cookie };

  const point = await fetch(`${base}/games/movie/host`, { method: "POST", headers: auth, body: "action=point", redirect: "manual" });
  assert.equal(point.status, 303);
  const reveal = await fetch(`${base}/games/movie/host`, { method: "POST", headers: auth, body: "action=reveal", redirect: "manual" });
  assert.equal(reveal.status, 303);
  const movie = await (await fetch(`${base}/games/movie/display`)).text();
  assert.match(movie, /Score 1/);
  assert.match(movie, /Home Alone/);
  const green = await (await fetch(`${base}/games/movie/display?mode=green`)).text();
  assert.match(green, /class="green"/);

  await fetch(`${base}/games/price/host`, { method: "POST", headers: auth, body: "action=guess&name=Ada&amount=10", redirect: "manual" });
  await fetch(`${base}/games/price/host`, { method: "POST", headers: auth, body: "action=guess&name=Grace&amount=40", redirect: "manual" });
  await fetch(`${base}/games/price/host`, { method: "POST", headers: auth, body: "action=reveal", redirect: "manual" });
  const price = await (await fetch(`${base}/games/price/display`)).text();
  assert.match(price, /\$15/);
  assert.match(price, /Ada/);
  assert.match(price, /closest/);

  await fetch(`${base}/games/feud/host`, { method: "POST", headers: auth, body: "action=reveal&index=0", redirect: "manual" });
  await fetch(`${base}/games/feud/host`, { method: "POST", headers: auth, body: "action=strike", redirect: "manual" });
  const feud = await (await fetch(`${base}/games/feud/display`)).text();
  assert.match(feud, /Lights/);
  assert.match(feud, />32</);
  assert.match(feud, /Team One/);
  assert.match(feud, />32</);

  await fetch(`${base}/games/sweater/host`, { method: "POST", headers: auth, body: "action=add&name=Ada&votes=4", redirect: "manual" });
  await fetch(`${base}/games/sweater/host`, { method: "POST", headers: auth, body: "action=dare&id=carol&status=unlocked", redirect: "manual" });
  await fetch(`${base}/games/sweater/host`, { method: "POST", headers: auth, body: "action=winner", redirect: "manual" });
  const sweater = await (await fetch(`${base}/games/sweater/display`)).text();
  assert.match(sweater, /Ada/);
  assert.match(sweater, /unlocked/);
  assert.match(sweater, /Donation dares/);
});
