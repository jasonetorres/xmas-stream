import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCode, clearCookie, codeHash, codesEqual, generateCode, readSession, safeEqualHex, sessionCookie, signSession } from "./auth.js";
import { openDatabase } from "./db.js";
import {
  AppError,
  addLead,
  addSponsor,
  book,
  deleteSponsor,
  ensureAccessCodes,
  ensureWebsites,
  getLogo,
  getSponsor,
  leadsCsv,
  listLeads,
  listSponsors,
  parseStart,
  pickerLabel,
  regenerateInvite,
  releaseBooking,
  removeLogo,
  saveAssets,
  scheduleRows,
  seedIfEmpty,
  updateSponsor,
} from "./domain.js";
import { boundaryFrom, parseMultipart } from "./multipart.js";
import { applyHome } from "./campaign.js";
import { flashFrom, renderAdmin, renderAdminLogin, renderDenied, renderLogin, renderPortalDirectory, renderSponsor } from "./pages.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const failures = [];

export class ConfigError extends Error {}

function header(req, name) {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function positive(value, fallback, label) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 24) throw new ConfigError(`${label} must be a whole number from 1 to 24.`);
  return n;
}

function loadOrCreate(file, create) {
  try {
    return { value: fs.readFileSync(file, "utf8").trim(), created: false };
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const value = create();
  try {
    fs.writeFileSync(file, `${value}\n`, { mode: 0o600, flag: "wx" });
    return { value, created: true };
  } catch (err) {
    if (err.code === "EEXIST") return { value: fs.readFileSync(file, "utf8").trim(), created: false };
    throw err;
  }
}

function resolveCode(env, { key, file, memory, dir }) {
  const provided = env[key];
  let code = provided == null ? "" : canonicalCode(provided);
  let generated = "";
  if (code) {
    return { code, generated };
  }
  if (!memory && provided == null) {
    if (!code) {
      const loaded = loadOrCreate(path.join(dir, file), generateCode);
      code = loaded.value;
      if (loaded.created) generated = loaded.value;
    }
  } else if (provided == null) {
    code = generateCode();
    generated = code;
  }
  return { code: canonicalCode(code), generated };
}

function resolveSecrets(env) {
  const databaseUrl = env.DATABASE_URL || "";
  const memory = env.SQLITE_PATH === ":memory:";
  const dir = env.DATA_DIR || "/tmp/xmas-stream";
  let sessionSecret = env.SESSION_SECRET || "";
  if (databaseUrl) {
    if (!sessionSecret) throw new ConfigError("SESSION_SECRET is required when DATABASE_URL is set. Unkey disk does not survive a restart, so the signing key has to live in the environment.");
  } else if (!memory && !sessionSecret) {
    sessionSecret = loadOrCreate(path.join(dir, "session-secret"), () => generateCode() + generateCode()).value;
  } else if (!sessionSecret) {
    sessionSecret = generateCode() + generateCode();
  }
  if (sessionSecret.length < 16) throw new ConfigError("SESSION_SECRET needs at least 16 characters.");
  const admin = resolveCode(env, { key: "ADMIN_CODE", file: "admin-code", memory, dir });
  const sponsor = resolveCode(env, { key: "SPONSOR_CODE", file: "sponsor-code", memory, dir });
  if (admin.code && sponsor.code && admin.code === sponsor.code) {
    throw new ConfigError("ADMIN_CODE and SPONSOR_CODE have to be different.");
  }
  return {
    sessionSecret,
    adminCode: admin.code,
    sponsorCode: sponsor.code,
    generatedAdminCode: admin.generated,
    generatedSponsorCode: sponsor.generated,
    databaseUrl,
  };
}

export async function createApp(env = {}) {
  const secrets = resolveSecrets(env);
  const sqlitePath = env.SQLITE_PATH || path.join(env.DATA_DIR || "/tmp/xmas-stream", "portal.sqlite");
  const db = await openDatabase({ databaseUrl: secrets.databaseUrl, sqlitePath });
  await db.migrate();
  await seedIfEmpty(db, secrets.sessionSecret, secrets.adminCode);
  await ensureWebsites(db);
  await ensureAccessCodes(db, secrets.sessionSecret, secrets.adminCode);
  const caps = {
    platinum: positive(env.PLATINUM_SPOTS, 3, "PLATINUM_SPOTS"),
    gold: positive(env.GOLD_SPOTS, 4, "GOLD_SPOTS"),
  };
  const publicDir = path.resolve(env.PUBLIC_DIR || path.join(root, "..", "public"));
  const config = {
    ...secrets,
    caps,
    ephemeral: !secrets.databaseUrl,
    appBaseUrl: (env.APP_BASE_URL || "").replace(/\/$/, ""),
    publicDir,
    sqlitePath,
  };

  async function handle(req, res) {
    const url = new URL(req.url || "/", "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, {
          ok: true,
          adminCodeSet: Boolean(config.adminCode),
          sponsorCodeSet: Boolean(config.sponsorCode),
        });
      }
      if (req.method !== "GET" && req.method !== "POST") return text(res, 405, "Method not allowed\n");
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
        await routeAdmin(req, res, url, db, config);
        return;
      }
      if (url.pathname === "/portal" || url.pathname.startsWith("/portal/")) {
        await routePortal(req, res, url, db, config);
        return;
      }
      if (req.method !== "GET") return text(res, 405, "Method not allowed\n");
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const sponsors = await listSponsors(db, config.sessionSecret);
        const raw = await fs.promises.readFile(path.join(publicDir, "index.html"), "utf8");
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "no-cache");
        res.end(applyHome(raw, sponsors));
        return;
      }
      await serveStatic(res, url.pathname, publicDir);
    } catch (err) {
      if (err instanceof AppError || err.status) {
        const message = err instanceof AppError ? err.message : "That didn’t work.";
        if (req.method === "POST") {
          const target = url.pathname === "/admin" || url.pathname.startsWith("/admin/") ? "/admin" : "/portal";
          return redirect(res, `${target}?error=${encodeURIComponent(message)}`);
        }
        const page = url.pathname === "/admin" || url.pathname.startsWith("/admin/") ? renderAdminLogin : renderLogin;
        return html(res, err.status || 400, page({ flash: { saved: "", error: message } }));
      }
      console.error(err);
      html(res, 500, renderLogin({ flash: { saved: "", error: "Something went wrong on the server." } }));
    }
  }

  return {
    handle,
    config,
    db,
    generatedAdminCode: secrets.generatedAdminCode,
    generatedSponsorCode: secrets.generatedSponsorCode,
    async close() {
      await db.close();
    },
  };
}

async function routeAdmin(req, res, url, db, config) {
  if (url.pathname === "/admin/api/sponsor-codes" && req.method === "GET") {
    return sponsorCodesApi(req, res, db, config);
  }
  if (req.method === "POST") assertSameOrigin(req);
  if (url.pathname === "/admin/login" && req.method === "GET") return redirect(res, "/admin");
  if (url.pathname === "/admin/login" && req.method === "POST") {
    const fields = await readForm(req);
    return loginAdmin(req, res, db, config, fields.code || "");
  }
  if (url.pathname === "/admin/logout" && req.method === "POST") return finishLogout(req, res, "/admin");

  const session = await currentSession(req, db, config);
  const leadFile = url.pathname.match(/^\/admin\/leads\/(\d+)\.csv$/);
  if ((url.pathname === "/admin/leads.csv" || leadFile) && req.method === "GET") {
    return sendLeads(res, db, session, leadFile ? Number(leadFile[1]) : null);
  }
  if (url.pathname === "/admin/leads" && req.method === "POST") return postLead(req, res, db, session);
  if (url.pathname === "/admin/sponsors" && req.method === "POST") return postAddSponsor(req, res, db, config, session);
  if (url.pathname === "/admin/booking" && req.method === "POST") return postAdminBooking(req, res, db, session);
  if (url.pathname === "/admin/invite" && req.method === "POST") return postInvite(req, res, db, config, session);
  if (url.pathname === "/admin/sponsor" && req.method === "POST") return postEditSponsor(req, res, db, config, session);
  if (url.pathname === "/admin/sponsor/delete" && req.method === "POST") return postDeleteSponsor(req, res, db, session);
  if (req.method !== "GET") throw new AppError("That page isn’t here.", 404);
  if (url.pathname !== "/admin") throw new AppError("That page isn’t here.", 404);
  if (!session) return html(res, 200, renderAdminLogin({ flash: flashFrom(url) }));
  if (session.role !== "admin") return html(res, 403, renderDenied());
  const sponsors = await listSponsors(db, config.sessionSecret, { withCodes: true });
  return html(
    res,
    200,
    renderAdmin({
      sponsors,
      caps: config.caps,
      flash: flashFrom(url),
      base: baseUrl(req, config),
      ephemeral: config.ephemeral,
    })
  );
}

async function routePortal(req, res, url, db, config) {
  if (url.pathname === "/portal/admin" || url.pathname.startsWith("/portal/admin/")) {
    throw new AppError("That page isn’t here.", 404);
  }
  if (req.method === "POST") assertSameOrigin(req);
  if (/^\/portal\/i\/[A-Za-z0-9-]+$/.test(url.pathname) && req.method === "GET") return redirect(res, "/portal");
  if (url.pathname === "/portal/login" && req.method === "GET") return redirect(res, "/portal");
  if (url.pathname === "/portal/login" && req.method === "POST") {
    const fields = await readForm(req);
    return loginSponsor(req, res, db, config, fields.code || "", fields.s || "");
  }
  if (url.pathname === "/portal/logout" && req.method === "POST") return finishLogout(req, res, "/portal");
  if (url.pathname === "/portal/claim" && req.method === "POST") {
    const session = await currentSession(req, db, config);
    return claimSponsor(req, res, db, config, session);
  }

  const logoMatch = url.pathname.match(/^\/portal\/logos\/(\d+)$/);
  if (logoMatch && req.method === "GET") return sendLogo(req, res, db, config, Number(logoMatch[1]));

  const session = await currentSession(req, db, config);

  if (url.pathname === "/portal/booking" && req.method === "POST") return postBooking(req, res, db, session);
  if (url.pathname === "/portal/assets" && req.method === "POST") return postAssets(req, res, db, session);
  if (url.pathname === "/portal/logos/remove" && req.method === "POST") return postRemoveLogo(req, res, db, session);

  if (req.method !== "GET") throw new AppError("That page isn’t here.", 404);

  if (url.pathname === "/portal") {
    const slug = requestedSlug(url);
    const sponsors = await listSponsors(db, config.sessionSecret);
    const requested = slug ? sponsors.find((item) => item.slug === slug) : null;
    const flash = flashFrom(url);
    if (slug && !requested) {
      return html(res, 200, renderPortalDirectory({ flash: { saved: flash.saved, error: flash.error || "That sponsor link isn’t on the list." }, sponsors }));
    }
    const loggedIn = session?.role === "sponsor" && session.sponsor;
    if (!loggedIn || (requested && session.sponsor.id !== requested.id)) {
      if (!requested) return html(res, 200, renderPortalDirectory({ flash, sponsors }));
      return html(res, 200, renderLogin({ flash, slug: requested.slug, label: pickerLabel(requested) }));
    }
    const sponsor = sponsors.find((item) => item.id === session.sponsor.id);
    if (!sponsor) return html(res, 200, renderPortalDirectory({ flash, sponsors }));
    sponsor.rows = scheduleRows(sponsor, sponsors);
    return html(res, 200, renderSponsor({ sponsor, flash }));
  }

  throw new AppError("That page isn’t here.", 404);
}

function codeMatches(secret, provided, expected) {
  if (!canonicalCode(expected)) return false;
  return codesEqual(secret, provided, expected);
}

function requestedSlug(url) {
  const slug = String(url.searchParams.get("s") || "").trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(slug) ? slug : "";
}

async function loginSponsor(req, res, db, config, code, slug) {
  const clean = requestedSlug({ searchParams: new URLSearchParams(slug ? `s=${slug}` : "") });
  const back = clean ? `&s=${encodeURIComponent(clean)}` : "";
  if (tooMany()) {
    await sleep(250);
    return redirect(res, `/portal?error=${encodeURIComponent("Too many tries. Wait 15 minutes and use the code Jason sent.")}${back}`);
  }
  if (!clean) {
    return redirect(res, `/portal?error=${encodeURIComponent("Pick your name first. Each sponsor has their own access code.")}`);
  }
  const row = await db.get("SELECT id, code_hash FROM sponsors WHERE slug = ?", [clean]);
  if (!row) {
    return redirect(res, `/portal?error=${encodeURIComponent("That sponsor link isn’t on the list.")}`);
  }
  const own = safeEqualHex(codeHash(config.sessionSecret, code), row.code_hash);
  const shared = Boolean(config.sponsorCode) && codeMatches(config.sessionSecret, code, config.sponsorCode);
  const admin = Boolean(config.adminCode) && codeMatches(config.sessionSecret, code, config.adminCode);
  if (admin || !(own || shared)) {
    markFailure();
    await sleep(250);
    return redirect(res, `/portal?error=${encodeURIComponent("That code doesn’t open this sponsor’s page.")}${back}`);
  }
  return startSession(req, res, { v: 1, role: "sponsor", sid: Number(row.id), exp: expiry() }, `/portal?s=${encodeURIComponent(clean)}`, config);
}

async function sponsorCodesApi(req, res, db, config) {
  if (tooMany()) {
    await sleep(250);
    return json(res, 429, { error: "Too many tries. Wait 15 minutes." });
  }
  if (!config.adminCode) return json(res, 503, { error: "ADMIN_CODE is not set." });
  const header = req.headers["x-admin-code"];
  const provided = Array.isArray(header) ? header[0] : header || "";
  if (!codeMatches(config.sessionSecret, provided, config.adminCode)) {
    markFailure();
    await sleep(250);
    return json(res, 401, { error: "Admin code required." });
  }
  const sponsors = await listSponsors(db, config.sessionSecret, { withCodes: true });
  return json(res, 200, {
    sponsors: sponsors.map((sponsor) => ({ slug: sponsor.slug, name: sponsor.name, code: sponsor.inviteCode })),
  });
}

async function loginAdmin(req, res, db, config, code) {
  if (tooMany()) {
    await sleep(250);
    return redirect(res, `/admin?error=${encodeURIComponent("Too many tries. Wait 15 minutes.")}`);
  }
  if (!config.adminCode) {
    return redirect(res, `/admin?error=${encodeURIComponent("ADMIN_CODE is not set on this server. Add it in the Unkey environment and redeploy.")}`);
  }
  const ok = codeMatches(config.sessionSecret, code, config.adminCode);
  const sponsor = codeMatches(config.sessionSecret, code, config.sponsorCode);
  if (!ok || sponsor) {
    markFailure();
    await sleep(250);
    return redirect(res, `/admin?error=${encodeURIComponent("That code doesn’t open the admin desk.")}`);
  }
  return startSession(req, res, { v: 1, role: "admin", exp: expiry() }, "/admin", config);
}

async function claimSponsor(req, res, db, config, session) {
  if (!session || session.role !== "sponsor") throw new AppError("Enter the access code on your sponsor link.", 401);
  throw new AppError("Enter the access code on your sponsor link.");
}

function startSession(req, res, payload, location, config) {
  const token = signSession(config.sessionSecret, payload);
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Set-Cookie", sessionCookie(token, { secure: isHttps(req) }));
  res.end();
}

function finishLogout(req, res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", clearCookie({ secure: isHttps(req) }));
  res.end();
}

async function postBooking(req, res, db, session) {
  if (!session?.sponsor) throw new AppError("Enter the sponsor code and your name first.", 401);
  const fields = await readForm(req);
  const sponsor = session.sponsor;
  if (!sponsor) throw new AppError("That sponsor login is no longer active.", 401);
  if (fields.action === "release") {
    await releaseBooking(db, sponsor.id);
    return redirect(res, "/portal?saved=released");
  }
  const start = parseStart(fields.start);
  if (start == null) throw new AppError("Pick a block first.");
  await book(db, {
    sponsor,
    start,
    giftDrop: fields.gift_drop === "on",
    hotSeat: fields.hot_seat === "on",
    guestName: fields.guest_name,
    force: false,
    actor: "sponsor",
  });
  return redirect(res, "/portal?saved=booked");
}

async function postAssets(req, res, db, session) {
  if (!session?.sponsor) throw new AppError("Enter the sponsor code and your name first.", 401);
  const { fields, files } = await readMultipart(req);
  await saveAssets(db, session.sponsor.id, fields, files);
  return redirect(res, "/portal?saved=assets");
}

async function postRemoveLogo(req, res, db, session) {
  if (!session?.sponsor) throw new AppError("Enter the sponsor code and your name first.", 401);
  const fields = await readForm(req);
  const logoId = Number(fields.logo_id);
  if (!Number.isInteger(logoId)) throw new AppError("Pick a logo to remove.");
  await removeLogo(db, session.sponsor.id, logoId);
  return redirect(res, "/portal?saved=logo");
}

async function postAddSponsor(req, res, db, config, session) {
  requireAdmin(session);
  const fields = await readForm(req);
  await addSponsor(db, fields, config.sessionSecret, config.adminCode, config.caps);
  return redirect(res, "/admin?saved=added");
}

async function postAdminBooking(req, res, db, session) {
  requireAdmin(session);
  const fields = await readForm(req);
  const sponsor = await getSponsor(db, Number(fields.sponsor_id));
  if (!sponsor) throw new AppError("That sponsor is gone.");
  const start = parseStart(fields.start);
  if (start == null) {
    await releaseBooking(db, sponsor.id);
    return redirect(res, "/admin?saved=override");
  }
  await book(db, {
    sponsor,
    start,
    giftDrop: fields.gift_drop === "on",
    hotSeat: fields.hot_seat === "on",
    guestName: fields.guest_name,
    force: fields.force === "yes",
    actor: "admin",
  });
  return redirect(res, "/admin?saved=override");
}

async function postInvite(req, res, db, config, session) {
  requireAdmin(session);
  const fields = await readForm(req);
  await regenerateInvite(db, Number(fields.sponsor_id), config.sessionSecret, config.adminCode);
  return redirect(res, "/admin?saved=invite");
}

async function postEditSponsor(req, res, db, config, session) {
  requireAdmin(session);
  const fields = await readForm(req);
  await updateSponsor(db, Number(fields.sponsor_id), fields, config.caps);
  return redirect(res, "/admin?saved=edited");
}

async function postDeleteSponsor(req, res, db, session) {
  requireAdmin(session);
  const fields = await readForm(req);
  if (fields.confirm !== "yes") throw new AppError("Check the box to remove that sponsor.");
  await deleteSponsor(db, Number(fields.sponsor_id));
  return redirect(res, "/admin?saved=removed");
}

async function sendLogo(req, res, db, config, id) {
  const session = await currentSession(req, db, config);
  if (!session?.sponsor && session?.role !== "admin") return text(res, 401, "Log in first\n");
  const logo = await getLogo(db, id);
  if (!logo) return text(res, 404, "No logo\n");
  if (session.role !== "admin" && Number(logo.sponsor_id) !== session.sponsor.id) return text(res, 404, "No logo\n");
  const bytes = Buffer.from(logo.bytes);
  res.statusCode = 200;
  res.setHeader("Content-Type", logo.mime);
  res.setHeader("Content-Length", bytes.length);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="${logo.filename.replace(/[^a-z0-9.-]/gi, "")}"`);
  res.end(bytes);
}

function requireAdmin(session) {
  if (!session || session.role !== "admin") throw new AppError("Jason’s code is required for that.", 401);
}

async function postLead(req, res, db, session) {
  requireAdmin(session);
  const fields = await readForm(req);
  await addLead(db, Number(fields.sponsor_id), fields);
  return redirect(res, "/admin?saved=edited");
}

async function sendLeads(res, db, session, sponsorId) {
  if (!session || session.role !== "admin") return text(res, 401, "Jason’s code is required for that.\n");
  const rows = await listLeads(db, sponsorId);
  const body = leadsCsv(rows, { includeSponsor: sponsorId == null });
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${sponsorId ? `sponsor-${sponsorId}-leads.csv` : "leads.csv"}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(body);
}

async function currentSession(req, db, config) {
  const token = readCookie(req, "stream_session");
  const session = readSession(config.sessionSecret, token);
  if (!session) return null;
  if (session.role === "admin") return { role: "admin" };
  if (session.role !== "sponsor") return null;
  if (!session.sid) return { role: "sponsor", sponsor: null };
  const sponsor = await getSponsor(db, Number(session.sid));
  if (!sponsor) return { role: "sponsor", sponsor: null };
  return { role: "sponsor", sponsor };
}

function expiry() {
  return Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
}

function tooMany() {
  const now = Date.now();
  while (failures.length && now - failures[0] > 15 * 60 * 1000) failures.shift();
  return failures.length >= 40;
}

function markFailure() {
  failures.push(Date.now());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHttps(req) {
  const proto = header(req, "x-forwarded-proto").split(",")[0].trim();
  if (proto === "https") return true;
  const host = header(req, "x-forwarded-host") || header(req, "host");
  return String(host).endsWith(".unkey.app");
}

function baseUrl(req, config) {
  if (config.appBaseUrl) return config.appBaseUrl;
  const host = (header(req, "x-forwarded-host") || header(req, "host")).split(",")[0].trim();
  return `${isHttps(req) ? "https" : "http"}://${host}`;
}

function splitHost(value) {
  const trimmed = String(value || "").trim().replace(/^\[|\]$/g, "");
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return { name: trimmed.slice(1, end).toLowerCase(), port: trimmed.slice(end + 2) };
  }
  const idx = trimmed.lastIndexOf(":");
  if (idx > -1 && /^\d+$/.test(trimmed.slice(idx + 1))) {
    return { name: trimmed.slice(0, idx).toLowerCase(), port: trimmed.slice(idx + 1) };
  }
  return { name: trimmed.toLowerCase(), port: "" };
}

function sameSiteHost(originHost, headerValue) {
  if (!headerValue) return false;
  const left = splitHost(originHost);
  const right = splitHost(headerValue.split(",")[0]);
  const alias = { localhost: "127.0.0.1", "127.0.0.1": "localhost" };
  const namesMatch = left.name === right.name || alias[left.name] === right.name;
  if (!namesMatch) return false;
  if (left.port && right.port && left.port !== right.port) return false;
  return true;
}

function assertSameOrigin(req) {
  const origin = header(req, "origin");
  if (!origin || origin === "null") return;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("That request came from somewhere else.", 403);
  }
  const candidates = [header(req, "host"), header(req, "x-forwarded-host")].filter(Boolean);
  if (candidates.some((value) => sameSiteHost(originHost, value))) return;
  console.error(`Rejected cross-origin form post from ${origin}`);
  throw new AppError("That request came from somewhere else.", 403);
}

function readCookie(req, name) {
  for (const part of header(req, "cookie").split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const err = new Error("That upload is too big.");
        err.status = 413;
        req.destroy();
        fail(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", fail);
  });
}

async function readForm(req) {
  const type = header(req, "content-type");
  if (!type.includes("application/x-www-form-urlencoded")) throw new AppError("Send the form again.");
  const body = await readBody(req, 100 * 1024);
  const params = new URLSearchParams(body.toString("utf8"));
  const fields = {};
  for (const [key, value] of params) fields[key] = value;
  return fields;
}

async function readMultipart(req) {
  const type = header(req, "content-type");
  const boundary = boundaryFrom(type);
  if (!boundary) throw new AppError("Upload the form again.");
  const body = await readBody(req, 4 * 1024 * 1024);
  const parts = parseMultipart(body, boundary);
  const fields = {};
  const files = [];
  for (const part of parts) {
    if (part.filename) {
      if (part.data.length) files.push({ filename: part.filename, bytes: part.data });
    } else if (part.name) fields[part.name] = part.data.toString("utf8");
  }
  return { fields, files };
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end();
}

function html(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.end(body);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function text(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

async function serveStatic(res, pathname, publicDir) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return text(res, 400, "Bad path\n");
  }
  if (decoded.includes("\0")) return text(res, 400, "Bad path\n");
  const file = decoded === "/" ? path.join(publicDir, "index.html") : path.resolve(publicDir, `.${decoded}`);
  const root = publicDir.endsWith(path.sep) ? publicDir : publicDir + path.sep;
  if (file !== path.join(publicDir, "index.html") && !file.startsWith(root)) return text(res, 404, "Not found\n");
  let stat;
  try {
    stat = await fs.promises.stat(file);
  } catch {
    return text(res, 404, "Not found\n");
  }
  if (!stat.isFile()) return text(res, 404, "Not found\n");
  const ext = path.extname(file).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  res.statusCode = 200;
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=3600");
  const body = await fs.promises.readFile(file);
  if (path.basename(file) === "index.html") return res.end(applyHome(body.toString("utf8")));
  res.end(body);
}
