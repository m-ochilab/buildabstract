(() => {
  "use strict";

  const RUBRIC_VERSION = "evaluation-v2-11";
  const state = { draftId: "" };
  const nativeFetch = window.fetch.bind(window);

  function apiPath(input) {
    try {
      return new URL(typeof input === "string" ? input : input.url, location.origin).pathname;
    } catch {
      return "";
    }
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const path = apiPath(args[0]);
    const match = path.match(/^\/api\/drafts\/([0-9a-f-]{36})$/i);
    if (match && response.ok) {
      state.draftId = match[1];
    }
    return response;
  };

  async function json(path, options) {
    const response = await nativeFetch(path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || "保存できませんでした。");
    return body;
  }

  function editorValues() {
    const editor = document.querySelector("#abstract-editor");
    const title = editor?.querySelector("input")?.value.trim() || "";
    const abstract = editor?.querySelector("textarea")?.value.trim() || "";
    return { title, abstract };
  }

  async function latestMatchingRun(draftId, title, abstract) {
    const runs = await json(`/api/drafts/${draftId}/runs`);
    for (const run of runs) {
      if (run.status !== "completed" || !["evaluate", "generate"].includes(run.kind)) continue;
      const detail = await json(`/api/drafts/${draftId}/runs/${run.id}`);
      const result = detail.result || {};
      if (result.revised_title !== title || result.revised_abstract !== abstract) continue;
      const keys = new Set((result.evaluation || []).map((item) => item.criterion_key));
      if (result.evaluation?.length === 11 && keys.has("background") && keys.has("logic")) return detail;
    }
    return null;
  }

  async function complete(button, status) {
    if (!state.draftId) throw new Error("原稿を開き直してから完成にしてください。");
    const { title, abstract } = editorValues();
    if (title.length < 3 || abstract.length < 10) throw new Error("タイトルとアブストラクトを入力してください。");
    button.disabled = true;
    status.textContent = "現在の文章と11観点の採点結果を確認しています…";
    try {
      const run = await latestMatchingRun(state.draftId, title, abstract);
      if (!run) throw new Error("現在の文章を「編集した文章を再採点」で11観点評価してから完成にしてください。");
      const saved = await json(`/api/drafts/${state.draftId}/complete`, {
        method: "POST",
        body: JSON.stringify({ final_run_id: run.id })
      });
      button.textContent = "完成済み ✓";
      button.dataset.savedRun = saved.final_run_id;
      status.textContent = `完成版を保存しました（完成ID: ${saved.id.slice(0, 8)}）。初期案と完成版を比較できます。`;
    } finally {
      button.disabled = false;
    }
  }

  function mount() {
    const rescore = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "編集した文章を再採点");
    const row = rescore?.parentElement;
    if (!row || row.querySelector("[data-complete-draft]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.dataset.completeDraft = "true";
    button.textContent = "完成！";
    const status = document.createElement("span");
    status.className = "completion-status";
    status.setAttribute("role", "status");
    status.dataset.rubricVersion = RUBRIC_VERSION;
    button.addEventListener("click", () => complete(button, status).catch((error) => {
      status.textContent = error.message;
    }));
    row.append(button, status);
  }

  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();
