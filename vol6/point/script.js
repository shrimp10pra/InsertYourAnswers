/* =====================================================
   得点表 — 4チーム対抗戦
   ---------------------------------------------------
   企画1: 獲得点がそのまま持ち点 (2回)
   企画2: 順位ポイント 25/20/15/10 (2回)
   企画3: 順位ポイント 25/20/15/10 (1回)
   企画4: 順位ポイント 25/20/15/10 (2回)
   企画5: 獲得点がそのまま持ち点 (1回)
===================================================== */

const STORAGE_KEY = "scoreboard-4teams-v1";
const RANK_POINTS = [25, 20, 15, 10];

const TEAM_COLORS = ["var(--t1)", "var(--t2)", "var(--t3)", "var(--t4)"];

const DEFAULT_TEAMS = [
  { id: "t1", name: "チーム1" },
  { id: "t2", name: "チーム2" },
  { id: "t3", name: "チーム3" },
  { id: "t4", name: "チーム4" },
];

const EVENTS = [
  { id: "e1", label: "企画1", type: "raw",  rounds: 2, rule: "獲得点がそのまま持ち点になります" },
  { id: "e2", label: "企画2", type: "rank", rounds: 2, rule: "順位に応じて 1位25pt・2位20pt・3位15pt・4位10pt を獲得します" },
  { id: "e3", label: "企画3", type: "rank", rounds: 1, rule: "順位に応じて 1位25pt・2位20pt・3位15pt・4位10pt を獲得します" },
  { id: "e4", label: "企画4", type: "rank", rounds: 2, rule: "順位に応じて 1位25pt・2位20pt・3位15pt・4位10pt を獲得します" },
  { id: "e5", label: "企画5", type: "raw",  rounds: 1, rule: "獲得点がそのまま持ち点になります" },
];

let state = {
  teams: DEFAULT_TEAMS.map((t) => ({ ...t })),
  // scores[eventId][roundIndex][teamId] = number | null
  scores: {},
};

/* ---------------- persistence ---------------- */

function initScores() {
  EVENTS.forEach((ev) => {
    if (!state.scores[ev.id]) state.scores[ev.id] = [];
    for (let r = 0; r < ev.rounds; r++) {
      if (!state.scores[ev.id][r]) state.scores[ev.id][r] = {};
      state.teams.forEach((team) => {
        if (state.scores[ev.id][r][team.id] === undefined) {
          state.scores[ev.id][r][team.id] = null;
        }
      });
    }
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.teams) state.teams = saved.teams;
    if (saved.scores) state.scores = saved.scores;
  } catch (e) {
    console.warn("保存データの読み込みに失敗しました", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("保存に失敗しました", e);
  }
}

/* ---------------- scoring logic ---------------- */

// Returns { teamId: pointsEarnedThisRound }
function calcRoundPoints(event, roundIndex) {
  const roundScores = state.scores[event.id][roundIndex];
  const result = {};

  if (event.type === "raw") {
    state.teams.forEach((team) => {
      result[team.id] = Number(roundScores[team.id]) || 0;
    });
    return result;
  }

  // type === "rank": sort by raw score desc, tie => all tied teams get the
  // best (highest) rank's point value; the next team after the tied group
  // continues from its own sorted position (e.g. 2 teams tied for 1st both
  // get 25pt, and the next team is treated as 3rd and gets 15pt).
  const anyEntered = state.teams.some(
    (team) => roundScores[team.id] !== null && roundScores[team.id] !== undefined
  );
  if (!anyEntered) {
    state.teams.forEach((team) => {
      result[team.id] = 0;
    });
    return result;
  }

  const entries = state.teams.map((team) => ({
    teamId: team.id,
    score: Number(roundScores[team.id]) || 0,
  }));
  entries.sort((a, b) => b.score - a.score);

  let i = 0;
  while (i < entries.length) {
    let j = i;
    while (j + 1 < entries.length && entries[j + 1].score === entries[i].score) {
      j++;
    }
    // 同点の場合は、その順位帯の中で最も良い順位のポイントを全員に付与する
    const topPoint = RANK_POINTS[i];
    for (let k = i; k <= j; k++) {
      result[entries[k].teamId] = topPoint;
    }
    i = j + 1;
  }
  return result;
}

function calcTeamTotal(teamId) {
  let total = 0;
  EVENTS.forEach((ev) => {
    for (let r = 0; r < ev.rounds; r++) {
      total += calcRoundPoints(ev, r)[teamId] || 0;
    }
  });
  return total;
}

function formatPt(n) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/* ---------------- rendering: static structure ---------------- */

function buildNamesGrid() {
  const grid = document.getElementById("namesGrid");
  grid.innerHTML = "";
  state.teams.forEach((team, idx) => {
    const field = document.createElement("div");
    field.className = "name-field";
    field.style.setProperty("--team-color", TEAM_COLORS[idx]);

    const dot = document.createElement("span");
    dot.className = "name-dot";
    field.appendChild(dot);

    const input = document.createElement("input");
    input.type = "text";
    input.value = team.name;
    input.setAttribute("aria-label", `チーム${idx + 1}の名前`);
    input.maxLength = 20;
    input.addEventListener("input", () => {
      state.teams[idx].name = input.value || DEFAULT_TEAMS[idx].name;
      document
        .querySelectorAll(`[data-team-name="${team.id}"]`)
        .forEach((el) => {
          el.textContent = state.teams[idx].name;
        });
      saveState();
      renderStandings();
      renderBars();
      renderBreakdown();
    });
    field.appendChild(input);
    grid.appendChild(field);
  });
}

function buildEventsSection() {
  const container = document.getElementById("eventsContainer");
  container.innerHTML = "";

  EVENTS.forEach((ev) => {
    const card = document.createElement("div");
    card.className = "event-card";

    const head = document.createElement("div");
    head.className = "event-head";
    const h3 = document.createElement("h3");
    h3.textContent = `${ev.label}（${ev.rounds}回）`;
    head.appendChild(h3);
    card.appendChild(head);

    const rule = document.createElement("p");
    rule.className = "event-rule";
    rule.textContent = ev.rule;
    card.appendChild(rule);

    const rounds = document.createElement("div");
    rounds.className = "rounds";

    for (let r = 0; r < ev.rounds; r++) {
      const roundWrap = document.createElement("div");

      const label = document.createElement("p");
      label.className = "round-label";
      label.textContent = ev.rounds > 1 ? `${r + 1}回目` : "得点入力";
      roundWrap.appendChild(label);

      const table = document.createElement("table");
      table.className = "round-table";
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr><th>チーム</th><th>獲得点</th><th style="text-align:right">${
        ev.type === "rank" ? "順位ポイント" : "持ち点"
      }</th></tr>`;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      state.teams.forEach((team, idx) => {
        const tr = document.createElement("tr");

        const tdTeam = document.createElement("td");
        const tag = document.createElement("div");
        tag.className = "team-tag";
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.setProperty("--team-color", TEAM_COLORS[idx]);
        tag.appendChild(dot);
        const nameSpan = document.createElement("span");
        nameSpan.textContent = team.name;
        nameSpan.setAttribute("data-team-name", team.id);
        tag.appendChild(nameSpan);
        tdTeam.appendChild(tag);
        tr.appendChild(tdTeam);

        const tdInput = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.className = "score-input";
        input.setAttribute("inputmode", "numeric");
        input.placeholder = "0";
        input.value = state.scores[ev.id][r][team.id] ?? "";
        input.addEventListener("input", () => {
          const v = input.value;
          state.scores[ev.id][r][team.id] = v === "" ? null : Number(v);
          saveState();
          refreshComputedValues();
        });
        tdInput.appendChild(input);
        tr.appendChild(tdInput);

        const tdBadge = document.createElement("td");
        tdBadge.style.textAlign = "right";
        const badge = document.createElement("span");
        badge.className = "point-badge";
        badge.setAttribute("data-badge", `${ev.id}-${r}-${team.id}`);
        badge.textContent = "0";
        tdBadge.appendChild(badge);
        tr.appendChild(tdBadge);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      roundWrap.appendChild(table);
      rounds.appendChild(roundWrap);
    }

    card.appendChild(rounds);
    container.appendChild(card);
  });
}

/* ---------------- rendering: computed / dynamic values ---------------- */

function renderStandings() {
  const totals = state.teams.map((team, idx) => ({
    ...team,
    idx,
    total: calcTeamTotal(team.id),
  }));
  totals.sort((a, b) => b.total - a.total);

  const grid = document.getElementById("standingsGrid");
  grid.innerHTML = "";

  let rank = 0;
  let prevTotal = null;
  totals.forEach((team, i) => {
    if (team.total !== prevTotal) rank = i + 1;
    prevTotal = team.total;

    const card = document.createElement("div");
    card.className = "standing-card";
    card.style.setProperty("--team-color", TEAM_COLORS[team.idx]);

    const rankEl = document.createElement("p");
    rankEl.className = "standing-rank" + (rank === 1 ? " is-first" : "");
    rankEl.textContent = `${rank}位`;
    card.appendChild(rankEl);

    const nameEl = document.createElement("p");
    nameEl.className = "standing-name";
    nameEl.textContent = team.name;
    nameEl.setAttribute("data-team-name", team.id);
    card.appendChild(nameEl);

    const totalEl = document.createElement("p");
    totalEl.className = "standing-total";
    totalEl.innerHTML = `${formatPt(team.total)}<span class="unit">pt</span>`;
    card.appendChild(totalEl);

    grid.appendChild(card);
  });
}

function renderBars() {
  const totals = state.teams.map((team, idx) => ({
    ...team,
    idx,
    total: calcTeamTotal(team.id),
  }));
  const max = Math.max(1, ...totals.map((t) => t.total));

  const list = document.getElementById("barsList");
  list.innerHTML = "";

  totals.forEach((team) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const nameEl = document.createElement("span");
    nameEl.className = "bar-team";
    nameEl.textContent = team.name;
    nameEl.setAttribute("data-team-name", team.id);
    row.appendChild(nameEl);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.setProperty("--team-color", TEAM_COLORS[team.idx]);
    fill.style.width = `${(team.total / max) * 100}%`;
    track.appendChild(fill);
    row.appendChild(track);

    const valueEl = document.createElement("span");
    valueEl.className = "bar-value";
    valueEl.textContent = `${formatPt(team.total)}pt`;
    row.appendChild(valueEl);

    list.appendChild(row);
  });
}

function renderBreakdown() {
  const table = document.getElementById("breakdownTable");
  table.innerHTML = "";

  // build column list: one column per round, labelled e.g. 企画1-1
  const columns = [];
  EVENTS.forEach((ev) => {
    for (let r = 0; r < ev.rounds; r++) {
      columns.push({
        eventId: ev.id,
        round: r,
        label: ev.rounds > 1 ? `${ev.label}-${r + 1}` : ev.label,
      });
    }
  });

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML =
    `<th>チーム</th>` +
    columns.map((c) => `<th>${c.label}</th>`).join("") +
    `<th>合計</th>`;
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  state.teams.forEach((team, idx) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "team-cell";
    tdName.style.setProperty("--team-color", TEAM_COLORS[idx]);
    const dot = document.createElement("span");
    dot.className = "dot";
    tdName.appendChild(dot);
    const nameSpan = document.createElement("span");
    nameSpan.textContent = team.name;
    nameSpan.setAttribute("data-team-name", team.id);
    tdName.appendChild(nameSpan);
    tr.appendChild(tdName);

    let total = 0;
    columns.forEach((c) => {
      const ev = EVENTS.find((e) => e.id === c.eventId);
      const pts = calcRoundPoints(ev, c.round)[team.id] || 0;
      total += pts;
      const td = document.createElement("td");
      td.textContent = formatPt(pts);
      tr.appendChild(td);
    });

    const tdTotal = document.createElement("td");
    tdTotal.textContent = formatPt(total);
    tr.appendChild(tdTotal);

    tbody.appendChild(tr);
  });

  const totalRow = document.createElement("tr");
  totalRow.className = "total-row";
  totalRow.innerHTML =
    `<td>合計</td>` +
    columns
      .map((c) => {
        const ev = EVENTS.find((e) => e.id === c.eventId);
        const sum = state.teams.reduce(
          (s, team) => s + (calcRoundPoints(ev, c.round)[team.id] || 0),
          0
        );
        return `<td>${formatPt(sum)}</td>`;
      })
      .join("") +
    `<td>${formatPt(
      state.teams.reduce((s, team) => s + calcTeamTotal(team.id), 0)
    )}</td>`;
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
}

function refreshComputedValues() {
  // update per-round point badges without rebuilding the input DOM
  EVENTS.forEach((ev) => {
    for (let r = 0; r < ev.rounds; r++) {
      const pts = calcRoundPoints(ev, r);
      const topScore = Math.max(...Object.values(pts));
      state.teams.forEach((team) => {
        const badge = document.querySelector(
          `[data-badge="${ev.id}-${r}-${team.id}"]`
        );
        if (!badge) return;
        const val = pts[team.id] || 0;
        badge.textContent = formatPt(val);
        badge.classList.toggle(
          "is-lead",
          val === topScore && topScore > 0
        );
      });
    }
  });

  renderStandings();
  renderBars();
  renderBreakdown();
}

/* ---------------- reset ---------------- */

function resetAll() {
  const ok = confirm(
    "すべての得点とチーム名をリセットします。よろしいですか？"
  );
  if (!ok) return;
  state = { teams: DEFAULT_TEAMS.map((t) => ({ ...t })), scores: {} };
  initScores();
  saveState();
  buildNamesGrid();
  buildEventsSection();
  refreshComputedValues();
}

/* ---------------- init ---------------- */

function init() {
  loadState();
  initScores();
  buildNamesGrid();
  buildEventsSection();
  refreshComputedValues();
  document.getElementById("resetBtn").addEventListener("click", resetAll);
}

document.addEventListener("DOMContentLoaded", init);