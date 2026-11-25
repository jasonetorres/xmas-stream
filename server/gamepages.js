import { SEGMENTS, segmentRange } from "./schedule.js";
import { GAME_SLUGS, gamePack, hostAnswers, publicGame } from "./games.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const hostCss = `
:root { --ground:#17110d; --line:rgba(245,230,184,.22); --cream:#f5e6b8; --muted:#cdbf98; --gold:#f2b33d; }
* { box-sizing: border-box; }
body { margin:0; background:#17110d; color:var(--cream); font-family:"JetBrains Mono",ui-monospace,monospace; font-size:16px; line-height:1.45; }
a { color:var(--gold); }
.wrap { max-width:880px; margin:0 auto; padding:24px 16px 72px; }
h1 { font-size:clamp(1.6rem,4vw,2.2rem); margin:8px 0; }
.row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
button, .btn { display:inline-flex; align-items:center; min-height:44px; padding:0 14px; border-radius:999px; background:var(--gold); color:#17110d; font:inherit; font-weight:700; border:0; text-decoration:none; cursor:pointer; }
button.ghost { background:transparent; color:var(--cream); border:2px solid var(--line); }
label { display:block; margin:12px 0; }
input, textarea, select { width:100%; min-height:44px; margin-top:4px; padding:8px 10px; border-radius:10px; border:1px solid var(--line); background:#100d0b; color:var(--cream); font:inherit; }
textarea { min-height:120px; }
.banner { padding:12px; border-radius:12px; background:rgba(242,179,61,.12); }
.meta { color:var(--muted); }
.card { margin:12px 0; padding:12px; border:1px solid var(--line); border-radius:12px; }
form.inline { display:inline; }
`;

const displayCss = `
:root { --ground:#17110d; --cream:#f5e6b8; --muted:#cdbf98; --gold:#f2b33d; --red:#c8322b; }
* { box-sizing: border-box; }
html, body { margin:0; width:100%; height:100%; background:#17110d; color:var(--cream); font-family:"JetBrains Mono",ui-monospace,monospace; }
body.green { background:#00b140; }
.stage { min-height:100vh; display:flex; flex-direction:column; justify-content:center; padding:48px 64px; }
body.green .stage { padding:56px 72px; }
.board { width:min(1224px, 100%); display:flex; flex-direction:column; justify-content:center; gap:18px; }
.kicker { color:var(--gold); letter-spacing:.14em; text-transform:uppercase; font-size:clamp(16px, 2vw, 22px); font-weight:700; }
h1 { margin:0; font-size:clamp(40px, 5vw, 68px); line-height:1.05; font-weight:700; }
.clue { font-size:clamp(36px, 5vw, 64px); line-height:1.2; font-weight:700; }
.answer { font-size:clamp(32px, 4vw, 52px); color:var(--gold); font-weight:700; }
.meta { font-size:clamp(20px, 2.4vw, 28px); color:var(--muted); }
.score { font-size:clamp(28px, 3vw, 40px); font-weight:700; }
.guesses, .answers, .sweaters, .dares { display:grid; gap:10px; }
.guess, .slot, .sweater, .dare { display:flex; justify-content:space-between; gap:16px; align-items:center; padding:12px 16px; background:#221a14; border-left:8px solid var(--gold); font-size:clamp(20px, 2.4vw, 32px); }
.slot.open { border-left-color:#f5e6b8; }
.slot b, .guess b { font-size:clamp(22px, 2.6vw, 34px); }
.strikes { letter-spacing:.2em; color:var(--red); font-size:clamp(36px, 5vw, 64px); font-weight:700; }
.teams { display:flex; gap:18px; flex-wrap:wrap; }
.team { padding:12px 16px; border:2px solid rgba(245,230,184,.22); min-width:220px; }
.team.on { border-color:var(--gold); }
.team b { display:block; font-size:clamp(28px, 3vw, 42px); }
.sweater img { width:72px; height:72px; object-fit:cover; border-radius:8px; background:#100d0b; }
.winner { font-size:clamp(36px, 4vw, 56px); color:var(--gold); font-weight:700; }
`;

function page(title, css, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"><style>${css}</style></head><body>${body}</body></html>`;
}

export function renderGameIndex() {
  const rows = SEGMENTS.map((segment) => {
    const when = segmentRange(segment);
    const watch = segment.soon
      ? `<span class="meta">Coming soon</span>`
      : `<a class="btn" href="${esc(segment.href)}"${segment.href.startsWith("http") ? ` target="_blank" rel="noopener noreferrer"` : ""}>${esc(segment.watch || "Watch")}</a>`;
    const host = GAME_SLUGS.includes(segment.id) ? `<a href="/games/${esc(segment.id)}/host">Host</a>` : "";
    return `<article class="card"><h2>${esc(segment.name)}</h2><p class="meta">${esc(when)}</p><p>${esc(segment.note)}</p><div class="row">${watch}${host}</div></article>`;
  }).join("");
  return page("Games", hostCss, `<div class="wrap"><p class="meta">Friday, Dec 18, 2026 · 2:00–8:00 PM ET</p><h1>Games</h1><p>One game an hour. Call Santa opens the show. Christmasaire 2.0 closes it.</p>${rows}</div>`);
}

function button(action, label, extra = "", ghost = false) {
  return `<form class="inline" method="post"><input type="hidden" name="action" value="${esc(action)}">${extra}<button class="${ghost ? "ghost" : ""}" type="submit">${esc(label)}</button></form>`;
}

export function renderHost(slug, state, { error = "", saved = "" } = {}) {
  const view = publicGame(slug, state);
  const flash = error ? `<p class="banner">${esc(error)}</p>` : saved ? `<p class="banner">Saved.</p>` : "";
  let controls = "";
  if (slug === "movie") {
    controls = `<p class="meta">Round ${view.round} of ${view.total} · ${esc(view.kind)} · score ${view.score}${view.seconds ? ` · ${view.seconds}s left` : ""}</p>
      <p class="clue">${esc(view.clue)}</p>
      <p>${view.revealed ? `<b>${esc(view.answer)}</b>` : "Answer hidden"}</p>
      <div class="row">${button("timer", "Start 20s")}${button("reveal", "Reveal")}${button("point", "Award point")}${button("unpoint", "Remove point", "", true)}${button("back", "Back", "", true)}${button("next", "Next round")}${button("reset", "Reset", "", true)}</div>`;
  } else if (slug === "price") {
    const guesses = view.guesses.map((guess) => `<li>${esc(guess.name)} · $${guess.amount}</li>`).join("") || "<li>No guesses yet.</li>";
    controls = `<p class="meta">Round ${view.round} of ${view.total}${view.showcase ? " · Showcase" : ""}</p>
      <p><b>${esc(view.item)}</b></p>
      <p>${view.revealed ? `Actual price $${view.price}. Winner: ${esc(view.winner || "nobody, every guess went over")}` : "Price hidden"}</p>
      <ul>${guesses}</ul>
      <form method="post"><input type="hidden" name="action" value="guess"><label>Name<input name="name" required maxlength="40"></label><label>Guess in dollars<input name="amount" inputmode="numeric" required></label><button type="submit">Add guess</button></form>
      <div class="row">${button("reveal", "Reveal price")}${button("clear", "Clear guesses", "", true)}${button("back", "Back", "", true)}${button("next", "Next round")}${button("reset", "Reset", "", true)}</div>`;
  } else if (slug === "feud") {
    const answers = hostAnswers(slug, state);
    const open = new Set((state.revealed || []).map(Number));
    const list = answers.map((answer, index) => `<div class="row">${button("reveal", open.has(index) ? "Shown" : "Reveal", `<input type="hidden" name="index" value="${index}">`, open.has(index))}<span>${esc(answer.text)} · ${answer.points}</span></div>`).join("");
    const teams = view.teams.map((team, index) => `<form method="post"><input type="hidden" name="action" value="rename"><input type="hidden" name="team" value="${index}"><label>${esc(team.name)} · ${team.score}<input name="name" value="${esc(team.name)}" maxlength="24"></label><button type="submit">Rename</button></form>`).join("");
    controls = `<p class="meta">Round ${view.round} of ${view.total} · ${view.strikes} strike${view.strikes === 1 ? "" : "s"} · ${esc(view.teams[view.turn]?.name || "")} has the board</p>
      <p><b>${esc(view.question)}</b></p>
      ${list}
      <div class="row">${button("strike", "Strike")}${button("turn", "Switch team")}${button("back", "Back", "", true)}${button("next", "Next round")}${button("reset", "Reset", "", true)}</div>
      ${teams}
      <form method="post"><input type="hidden" name="action" value="paste"><label>Paste survey answers<textarea name="board" placeholder="Lights | 32"></textarea></label><p class="meta">${esc(gamePack(slug).pasteHint)}</p><button type="submit">Replace this board</button></form>`;
  } else {
    const sweaters = view.sweaters.map((item) => `<form method="post" class="card"><input type="hidden" name="action" value="votes"><input type="hidden" name="id" value="${esc(item.id)}"><b>${esc(item.name)}</b> · ${item.votes} votes<label>Tally<input name="votes" value="${item.votes}" inputmode="numeric"></label><button type="submit">Save votes</button> ${button("remove", "Remove", `<input type="hidden" name="id" value="${esc(item.id)}">`, true)}</form>`).join("") || "<p>No sweaters yet.</p>";
    const dares = view.dares.map((dare) => `<div class="card"><b>${esc(dare.text)}</b><p class="meta">$${dare.goal} · ${esc(dare.status)}</p><div class="row">${["locked", "unlocked", "done"].map((status) => button("dare", status, `<input type="hidden" name="id" value="${esc(dare.id)}"><input type="hidden" name="status" value="${status}">`, status !== dare.status)).join("")}</div></div>`).join("");
    controls = `<form method="post"><input type="hidden" name="action" value="add"><label>Sweater name<input name="name" required maxlength="40"></label><label>Photo URL, optional<input name="image_url" placeholder="https://"></label><label>Starting votes<input name="votes" value="0" inputmode="numeric"></label><button type="submit">Add sweater</button></form>
      ${sweaters}
      <div class="row">${button("winner", "Reveal winner")}${button("hide", "Hide winner", "", true)}${button("reset", "Reset", "", true)}</div>
      <h2>Donation dares</h2>${dares}`;
  }
  return page(`${view.title} · host`, hostCss, `<div class="wrap"><p class="meta"><a href="/games">All games</a> · <a href="/games/${esc(slug)}/display">Open the display</a></p><h1>${esc(view.title)}</h1>${flash}${controls}</div>`);
}

export function renderBoard(slug, state) {
  const view = publicGame(slug, state);
  if (slug === "movie") {
    return `<p class="kicker">${esc(view.title)} · ${view.round} of ${view.total}</p>
      <div class="clue">${esc(view.clue)}</div>
      ${view.revealed ? `<div class="answer">${esc(view.answer)}</div>` : `<div class="meta">${view.seconds ? `${view.seconds} seconds` : "Listen for the clue"}</div>`}
      <div class="score">Score ${view.score}</div>`;
  }
  if (slug === "price") {
    const guesses = view.guesses.map((guess) => {
      const won = view.revealed && guess.name === view.winner;
      return `<div class="guess"><span>${esc(guess.name)}</span><b>$${guess.amount}${won ? " · closest" : ""}</b></div>`;
    }).join("") || `<div class="meta">Guesses are coming in.</div>`;
    return `<p class="kicker">${esc(view.title)} · ${view.round} of ${view.total}${view.showcase ? " · Showcase" : ""}</p>
      <h1>${esc(view.item)}</h1>
      <div class="guesses">${guesses}</div>
      ${view.revealed ? `<div class="answer">$${view.price}${view.winner ? ` · ${esc(view.winner)}` : " · over"}</div>` : `<div class="meta">Closest without going over</div>`}`;
  }
  if (slug === "feud") {
    const slots = view.answers.map((answer) => `<div class="slot${answer.open ? " open" : ""}"><span>${answer.open ? esc(answer.text) : "····"}</span><b>${answer.open ? answer.points : ""}</b></div>`).join("");
    const teams = view.teams.map((team, index) => `<div class="team${index === view.turn ? " on" : ""}"><span>${esc(team.name)}</span><b>${team.score}</b></div>`).join("");
    const marks = "X".repeat(view.strikes);
    return `<p class="kicker">${esc(view.title)} · ${view.round} of ${view.total}</p>
      <h1>${esc(view.question)}</h1>
      <div class="teams">${teams}</div>
      <div class="answers">${slots}</div>
      <div class="strikes">${marks}</div>`;
  }
  const sweaters = view.sweaters.map((item) => {
    const img = item.imageUrl ? `<img alt="" src="${esc(item.imageUrl)}">` : "";
    return `<div class="sweater">${img}<span>${esc(item.name)}</span><b>${item.votes}</b></div>`;
  }).join("") || `<div class="meta">Sweaters are lining up.</div>`;
  const winners = view.showWinner ? `<div class="winner">${view.winners.length ? view.winners.map((item) => esc(item.name)).join(" · ") : "No votes yet"}</div>` : "";
  const dares = view.dares.map((dare) => `<div class="dare"><span>${esc(dare.text)}</span><b>$${dare.goal} · ${esc(dare.status)}</b></div>`).join("");
  return `<p class="kicker">${esc(view.title)}</p>
    <h1>Ugly sweater votes</h1>
    <div class="sweaters">${sweaters}</div>
    ${winners}
    <p class="kicker">Donation dares</p>
    <div class="dares">${dares}</div>`;
}

export function renderDisplay(slug, state, { mode = "", part = false } = {}) {
  const board = renderBoard(slug, state);
  if (part) return board;
  const green = mode === "green" ? "green" : "";
  const title = publicGame(slug, state).title;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"><style>${displayCss}</style></head>
<body class="${green}"><div class="stage"><div class="board" id="board">${board}</div></div>
<script>
async function pull() {
  try {
    const extra = location.search.includes("mode=green") ? "&mode=green" : "";
    const res = await fetch(location.pathname + "?part=board" + extra);
    if (!res.ok) return;
    const html = await res.text();
    const board = document.getElementById("board");
    if (board) board.innerHTML = html;
  } catch (err) {}
}
setInterval(pull, 1000);
</script></body></html>`;
}
