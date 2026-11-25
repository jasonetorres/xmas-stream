import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "./domain.js";

const root = path.dirname(fileURLToPath(import.meta.url));
export const GAME_SLUGS = ["movie", "price", "feud", "sweater"];

const packs = Object.fromEntries(GAME_SLUGS.map((slug) => {
  const file = path.join(root, "gamedata", `${slug}.json`);
  return [slug, JSON.parse(fs.readFileSync(file, "utf8"))];
}));

export function gamePack(slug) {
  if (!packs[slug]) throw new AppError("That game isn’t on the schedule.", 404);
  return packs[slug];
}

function fresh(slug) {
  const pack = gamePack(slug);
  if (slug === "movie") return { round: 0, revealed: false, score: 0, deadline: 0 };
  if (slug === "price") return { round: 0, revealed: false, guesses: [] };
  if (slug === "feud") {
    return {
      round: 0,
      revealed: [],
      strikes: 0,
      turn: 0,
      teams: [
        { name: "Team One", score: 0 },
        { name: "Team Two", score: 0 },
      ],
      boards: {},
    };
  }
  return {
    sweaters: [],
    showWinner: false,
    dares: pack.dares.map((dare) => ({ id: dare.id, status: "locked" })),
  };
}

export async function loadGame(db, slug) {
  gamePack(slug);
  const row = await db.get("SELECT value FROM settings WHERE key = ?", [`game:${slug}`]);
  const base = fresh(slug);
  if (!row?.value) return base;
  try {
    const saved = JSON.parse(row.value);
    return { ...base, ...saved, ...mergeLists(slug, base, saved) };
  } catch {
    return base;
  }
}

function mergeLists(slug, base, saved) {
  if (slug === "feud") {
    return {
      teams: Array.isArray(saved.teams) && saved.teams.length === 2 ? saved.teams : base.teams,
      boards: saved.boards && typeof saved.boards === "object" ? saved.boards : {},
    };
  }
  if (slug === "sweater") {
    const known = new Map((saved.dares || []).map((dare) => [dare.id, dare.status]));
    return {
      sweaters: Array.isArray(saved.sweaters) ? saved.sweaters : [],
      dares: base.dares.map((dare) => ({ ...dare, status: known.get(dare.id) || "locked" })),
    };
  }
  if (slug === "price") return { guesses: Array.isArray(saved.guesses) ? saved.guesses : [] };
  return {};
}

async function saveGame(db, slug, state) {
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [`game:${slug}`, JSON.stringify(state)]
  );
  return state;
}

function clean(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function answersFor(pack, state, round) {
  const custom = state.boards?.[String(round)];
  const source = Array.isArray(custom) && custom.length ? custom : pack.rounds[round].answers;
  return source.slice(0, 8);
}

export function publicGame(slug, state, now = Date.now()) {
  const pack = gamePack(slug);
  if (slug === "movie") {
    const round = pack.rounds[state.round];
    const left = state.deadline > now ? Math.ceil((state.deadline - now) / 1000) : 0;
    return {
      slug,
      title: pack.title,
      round: state.round + 1,
      total: pack.rounds.length,
      kind: round.kind,
      clue: round.clue,
      answer: state.revealed ? round.answer : "",
      revealed: Boolean(state.revealed),
      score: Number(state.score) || 0,
      seconds: left,
    };
  }
  if (slug === "price") {
    const round = pack.rounds[state.round];
    const guesses = (state.guesses || []).map((guess) => ({ name: guess.name, amount: Number(guess.amount) || 0 }));
    return {
      slug,
      title: pack.title,
      round: state.round + 1,
      total: pack.rounds.length,
      item: round.item,
      showcase: Boolean(round.showcase),
      price: state.revealed ? round.price : null,
      revealed: Boolean(state.revealed),
      guesses,
      winner: state.revealed ? priceWinner(guesses, round.price) : "",
    };
  }
  if (slug === "feud") {
    const round = pack.rounds[state.round];
    const answers = answersFor(pack, state, state.round);
    const revealed = new Set(state.revealed || []);
    return {
      slug,
      title: pack.title,
      round: state.round + 1,
      total: pack.rounds.length,
      question: round.question,
      strikes: Math.min(3, Number(state.strikes) || 0),
      turn: Number(state.turn) || 0,
      teams: state.teams,
      answers: answers.map((answer, index) => ({
        index,
        text: revealed.has(index) ? answer.text : "",
        points: revealed.has(index) ? Number(answer.points) || 0 : null,
        open: revealed.has(index),
      })),
    };
  }
  const dares = pack.dares.map((dare) => {
    const status = (state.dares || []).find((item) => item.id === dare.id)?.status || "locked";
    return { id: dare.id, text: dare.text, goal: dare.goal, status };
  });
  const sweaters = (state.sweaters || []).map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: item.imageUrl || "",
    votes: Number(item.votes) || 0,
  }));
  const top = sweaters.reduce((best, item) => Math.max(best, item.votes), 0);
  const winners = state.showWinner ? sweaters.filter((item) => item.votes === top && top > 0) : [];
  return { slug, title: pack.title, sweaters, showWinner: Boolean(state.showWinner), winners, dares };
}

function priceWinner(guesses, price) {
  const safe = guesses.filter((guess) => guess.amount <= price);
  if (!safe.length) return "";
  safe.sort((a, b) => b.amount - a.amount);
  return safe[0].name;
}

export async function applyGame(db, slug, fields) {
  const state = await loadGame(db, slug);
  const action = clean(fields.action, 40);
  const pack = gamePack(slug);
  if (slug === "movie") applyMovie(state, action, pack);
  else if (slug === "price") applyPrice(state, action, fields, pack);
  else if (slug === "feud") applyFeud(state, action, fields, pack);
  else applySweater(state, action, fields, pack);
  return saveGame(db, slug, state);
}

function applyMovie(state, action, pack) {
  const last = pack.rounds.length - 1;
  if (action === "next") {
    state.round = Math.min(last, state.round + 1);
    state.revealed = false;
    state.deadline = 0;
  } else if (action === "back") {
    state.round = Math.max(0, state.round - 1);
    state.revealed = false;
    state.deadline = 0;
  } else if (action === "timer") {
    state.revealed = false;
    state.deadline = Date.now() + (pack.seconds || 20) * 1000;
  } else if (action === "reveal") {
    state.revealed = true;
    state.deadline = 0;
  } else if (action === "point") {
    state.score = Math.max(0, (Number(state.score) || 0) + 1);
  } else if (action === "unpoint") {
    state.score = Math.max(0, (Number(state.score) || 0) - 1);
  } else if (action === "reset") {
    Object.assign(state, fresh("movie"));
  } else throw new AppError("That control isn’t on this board.");
}

function applyPrice(state, action, fields, pack) {
  const last = pack.rounds.length - 1;
  if (action === "next") {
    state.round = Math.min(last, state.round + 1);
    state.revealed = false;
    state.guesses = [];
  } else if (action === "back") {
    state.round = Math.max(0, state.round - 1);
    state.revealed = false;
    state.guesses = [];
  } else if (action === "reveal") {
    state.revealed = true;
  } else if (action === "guess") {
    const name = clean(fields.name, 40);
    const amount = Math.round(Number(fields.amount));
    if (!name) throw new AppError("Add the guesser’s name.");
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) throw new AppError("Enter a price in dollars.");
    state.guesses = (state.guesses || []).concat({ name, amount }).slice(-8);
  } else if (action === "clear") {
    state.guesses = [];
    state.revealed = false;
  } else if (action === "reset") {
    Object.assign(state, fresh("price"));
  } else throw new AppError("That control isn’t on this board.");
}

function applyFeud(state, action, fields, pack) {
  const last = pack.rounds.length - 1;
  const answers = answersFor(pack, state, state.round);
  if (action === "next") {
    state.round = Math.min(last, state.round + 1);
    state.revealed = [];
    state.strikes = 0;
  } else if (action === "back") {
    state.round = Math.max(0, state.round - 1);
    state.revealed = [];
    state.strikes = 0;
  } else if (action === "reveal") {
    const index = Number(fields.index);
    if (!Number.isInteger(index) || index < 0 || index >= answers.length) throw new AppError("That answer isn’t on the board.");
    const open = new Set(state.revealed || []);
    if (!open.has(index)) {
      open.add(index);
      const team = state.teams[state.turn] || state.teams[0];
      team.score += Number(answers[index].points) || 0;
    }
    state.revealed = [...open];
  } else if (action === "strike") {
    state.strikes = Math.min(3, (Number(state.strikes) || 0) + 1);
  } else if (action === "turn") {
    state.turn = state.turn === 0 ? 1 : 0;
  } else if (action === "rename") {
    const slot = Number(fields.team) === 1 ? 1 : 0;
    const name = clean(fields.name, 24);
    if (!name) throw new AppError("Give the team a name.");
    state.teams[slot].name = name;
  } else if (action === "paste") {
    state.boards = { ...(state.boards || {}), [String(state.round)]: parseBoard(fields.board) };
    state.revealed = [];
    state.strikes = 0;
  } else if (action === "reset") {
    Object.assign(state, fresh("feud"));
  } else throw new AppError("That control isn’t on this board.");
}

function parseBoard(raw) {
  const lines = String(raw || "").split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
  if (lines.length < 4) throw new AppError("Paste at least four answers.");
  return lines.map((line) => {
    const parts = line.split("|");
    const text = clean(parts[0], 40);
    const points = Math.round(Number(parts[1]));
    if (!text || !Number.isFinite(points) || points < 1 || points > 100) {
      throw new AppError("Each line needs an answer, a bar, and points from 1 to 100.");
    }
    return { text, points };
  });
}

function applySweater(state, action, fields, pack) {
  if (action === "add") {
    const name = clean(fields.name, 40);
    if (!name) throw new AppError("Add the sweater’s name.");
    const imageUrl = clean(fields.image_url, 400);
    if (imageUrl && !/^https:\/\/[\w.-]+/i.test(imageUrl)) throw new AppError("The photo has to be an https link.");
    state.sweaters = (state.sweaters || []).concat({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      imageUrl,
      votes: Math.max(0, Math.round(Number(fields.votes) || 0)),
    }).slice(-24);
  } else if (action === "votes") {
    const sweater = (state.sweaters || []).find((item) => item.id === fields.id);
    if (!sweater) throw new AppError("That sweater isn’t in the queue.");
    const votes = Math.round(Number(fields.votes));
    if (!Number.isFinite(votes) || votes < 0 || votes > 100000) throw new AppError("Enter the vote tally.");
    sweater.votes = votes;
  } else if (action === "remove") {
    state.sweaters = (state.sweaters || []).filter((item) => item.id !== fields.id);
  } else if (action === "winner") {
    state.showWinner = true;
  } else if (action === "hide") {
    state.showWinner = false;
  } else if (action === "dare") {
    const dare = (state.dares || []).find((item) => item.id === fields.id);
    if (!dare || !pack.dares.some((item) => item.id === fields.id)) throw new AppError("That dare isn’t on the board.");
    if (!["locked", "unlocked", "done"].includes(fields.status)) throw new AppError("Pick locked, unlocked, or done.");
    dare.status = fields.status;
  } else if (action === "reset") {
    Object.assign(state, fresh("sweater"));
  } else throw new AppError("That control isn’t on this board.");
}

export function hostAnswers(slug, state) {
  if (slug !== "feud") return [];
  return answersFor(gamePack(slug), state, state.round);
}
