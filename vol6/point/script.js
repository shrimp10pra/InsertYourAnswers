/* =====================================================
   得点表 — 管理画面用スクリプト
   ---------------------------------------------------
   このファイルは common.js を先に読み込んだ状態で使用します。
   得点入力・チーム名編集・企画ごとの公開トグルなど、
   「更新する側」の画面だけが持つ機能をまとめています。

   ここで localStorage に保存した内容は、同じブラウザで開いた
   display.html（スクリーン表示用）側に自動的に反映されます。
===================================================== */

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

function updateRevealUI(eventId) {
  const badge = document.querySelector(`[data-reveal-status="${eventId}"]`);
  if (badge) {
    const revealed = isRevealed(eventId);
    badge.textContent = revealed ? "公開中" : "未公開";
    badge.style.background = revealed ? "#16a34a" : "#e5e7eb";
    badge.style.color = revealed ? "#fff" : "#4b5563";
  }
  const card = badge ? badge.closest(".event-card") : null;
  if (card) {
    card.classList.toggle("is-revealed", isRevealed(eventId));
  }
}

function buildEventsSection() {
  const container = document.getElementById("eventsContainer");
  container.innerHTML = "";

  EVENTS.forEach((ev) => {
    const card = document.createElement("div");
    card.className = "event-card" + (isRevealed(ev.id) ? " is-revealed" : "");

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

    // ---- 公開タイミング切り替え ----
    const revealRow = document.createElement("div");
    revealRow.className = "event-reveal-row";
    revealRow.style.cssText =
      "display:flex;align-items:center;gap:10px;margin:8px 0 4px;";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "reveal-toggle";
    toggleLabel.style.cssText =
      "display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;user-select:none;";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isRevealed(ev.id);
    checkbox.setAttribute("aria-label", `${ev.label}の結果をサイトに反映する`);
    checkbox.addEventListener("change", () => {
      state.revealed[ev.id] = checkbox.checked;
      saveState();
      updateRevealUI(ev.id);
      refreshComputedValues();
    });
    toggleLabel.appendChild(checkbox);

    const toggleText = document.createElement("span");
    toggleText.textContent = "結果をサイトに反映する";
    toggleLabel.appendChild(toggleText);
    revealRow.appendChild(toggleLabel);

    const statusBadge = document.createElement("span");
    statusBadge.className = "reveal-status";
    statusBadge.setAttribute("data-reveal-status", ev.id);
    statusBadge.textContent = isRevealed(ev.id) ? "公開中" : "未公開";
    statusBadge.style.cssText =
      "font-size:0.75rem;font-weight:700;padding:2px 10px;border-radius:999px;" +
      (isRevealed(ev.id)
        ? "background:#16a34a;color:#fff;"
        : "background:#e5e7eb;color:#4b5563;");
    revealRow.appendChild(statusBadge);

    card.appendChild(revealRow);
    // --------------------------------

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

function refreshComputedValues() {
  // update per-round point badges without rebuilding the input DOM
  // 未公開の企画は「？」で隠し、公開後にはじめて実際の点数を表示する
  // （得点の入力欄自体は常に操作できる＝裏側で先に打ち込んでおける）
  EVENTS.forEach((ev) => {
    const revealed = isRevealed(ev.id);
    for (let r = 0; r < ev.rounds; r++) {
      const pts = calcRoundPoints(ev, r);
      const topScore = Math.max(...Object.values(pts));
      state.teams.forEach((team) => {
        const badge = document.querySelector(
          `[data-badge="${ev.id}-${r}-${team.id}"]`
        );
        if (!badge) return;
        if (!revealed) {
          badge.textContent = "？";
          badge.classList.remove("is-lead");
          badge.classList.add("is-pending");
          badge.style.opacity = "0.45";
          return;
        }
        const val = pts[team.id] || 0;
        badge.textContent = formatPt(val);
        badge.classList.remove("is-pending");
        badge.style.opacity = "";
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
  state = {
    teams: DEFAULT_TEAMS.map((t) => ({ ...t })),
    scores: {},
    revealed: {},
  };
  initScores();
  initRevealed();
  saveState();
  buildNamesGrid();
  buildEventsSection();
  refreshComputedValues();
}

/* ---------------- init ---------------- */

function init() {
  loadState();
  initScores();
  initRevealed();
  buildNamesGrid();
  buildEventsSection();
  refreshComputedValues();
  document.getElementById("resetBtn").addEventListener("click", resetAll);
}

document.addEventListener("DOMContentLoaded", init);