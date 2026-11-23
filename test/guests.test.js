import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../server/app.js";
import { guestLowerHtml } from "../server/overlayhtml.js";

test("guest slots stay private until Jason approves them", async (t) => {
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

  const page = await fetch(`${base}/guests`);
  const html = await page.text();
  assert.match(html, /2:00–2:15 PM ET/);
  assert.match(html, /7:45–8:00 PM ET/);
  assert.doesNotMatch(html, /@example\.com/);

  const posted = await fetch(`${base}/guests`, {
    method: "POST",
    headers: origin,
    body: "start_min=840&name=Ada Lovelace&email=ada-guest@example.com&handle=ada&topic=Holiday debugging&timezone=America/Los_Angeles",
    redirect: "manual",
  });
  assert.equal(posted.status, 303);
  const hidden = await (await fetch(`${base}/guests`)).text();
  assert.doesNotMatch(hidden, /Ada Lovelace|ada-guest@example.com/);

  const login = await fetch(`${base}/admin/login`, {
    method: "POST",
    headers: origin,
    body: "code=admin-test-code",
    redirect: "manual",
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const desk = await (await fetch(`${base}/admin/guests`, { headers: { cookie } })).text();
  assert.match(desk, /Ada Lovelace/);
  assert.match(desk, /ada-guest@example.com/);
  const id = /name="id" value="(\d+)"/.exec(desk)[1];
  const approved = await fetch(`${base}/admin/guests/approve`, {
    method: "POST",
    headers: { ...origin, cookie },
    body: `id=${id}`,
    redirect: "manual",
  });
  assert.equal(approved.status, 303);
  const pub = await (await fetch(`${base}/guests`)).text();
  assert.match(pub, /Ada Lovelace/);
  assert.match(pub, /@ada/);
  assert.doesNotMatch(pub, /ada-guest@example.com/);

  const up = await (await fetch(`${base}/live/up-next`)).text();
  assert.match(up, /Guest: Ada Lovelace, @ada/);

  const token = (await app.db.get("SELECT token FROM guest_requests WHERE id = ?", [id])).token;
  const confirm = await (await fetch(`${base}/guests/c/${token}`)).text();
  assert.match(confirm, /Join 10 minutes early/);
  assert.match(confirm, /headphones/i);
  assert.match(confirm, /PT|Pacific|Los Angeles|8:00|11:00/i);
  const ics = await fetch(`${base}/guests/c/${token}.ics`);
  assert.match(ics.headers.get("content-type"), /calendar/);
  assert.match(await ics.text(), /BEGIN:VCALENDAR/);

  const csv = await fetch(`${base}/admin/guests/run-of-show.csv`, { headers: { cookie } });
  const sheet = await csv.text();
  assert.match(sheet, /Ada Lovelace/);
  assert.match(sheet, /Holiday debugging/);
  assert.match(sheet, /ada-guest@example.com/);

  const moved = await fetch(`${base}/admin/guests/move`, {
    method: "POST",
    headers: { ...origin, cookie },
    body: `id=${id}&start_min=855`,
    redirect: "manual",
  });
  assert.equal(moved.status, 303);
  assert.equal(Number((await app.db.get("SELECT start_min FROM guest_requests WHERE id = ?", [id])).start_min), 855);

  await fetch(`${base}/admin/guests/decline`, {
    method: "POST",
    headers: { ...origin, cookie },
    body: `id=${id}`,
    redirect: "manual",
  });
  const after = await (await fetch(`${base}/guests`)).text();
  assert.doesNotMatch(after, /Ada Lovelace/);

  assert.match(guestLowerHtml({ name: "Ada Lovelace", handle: "ada", time: "2:00–2:15 PM ET" }), /Guest: Ada Lovelace, @ada/);
});
