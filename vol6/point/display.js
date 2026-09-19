/* =====================================================
   得点表 — スクリーン表示用スクリプト（読み取り専用）
   ---------------------------------------------------
   このファイルは common.js を先に読み込んだ状態で使用します。
   得点の入力や公開トグルなど「更新する側」の操作は一切行わず、
   管理画面（index.html）で保存された内容を表示するだけです。

   同じブラウザ内で index.html を別タブ／別ウィンドウで開いて
   得点を更新すると、この画面は localStorage の "storage" イベントで
   それを検知し、自動的に再描画されます。
   （"storage" イベントは、更新した本人のタブでは発火せず、
    同一オリジンの“他の”タブ・ウィンドウでのみ発火する仕様です）
===================================================== */

function renderAll() {
  loadState();
  initScores();
  initRevealed();
  renderStandings();
  renderBars();
  renderBreakdown();
}

function init() {
  renderAll();

  // 管理画面（別タブ）での更新をリアルタイムに反映
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === STORAGE_KEY) {
      renderAll();
    }
  });

  // 念のためのフォールバック（storageイベントが効かない環境向けの定期更新）
  setInterval(renderAll, 3000);
}

document.addEventListener("DOMContentLoaded", init);