const form = document.getElementById("generation-form");
const submitButton = document.getElementById("submit-button");
const healthStatus = document.getElementById("health-status");
const fixedModel = document.getElementById("fixed-model");
const backendSelect = document.getElementById("backend-select");
const resultEmpty = document.getElementById("result-empty");
const resultProgress = document.getElementById("result-progress");
const resultView = document.getElementById("result-view");
const resultDownload = document.getElementById("result-download");
const progressTitle = document.getElementById("progress-title");
const progressPercent = document.getElementById("progress-percent");
const progressFill = document.getElementById("progress-fill");
const progressStage = document.getElementById("progress-stage");
const progressSteps = Array.from(document.querySelectorAll("#progress-steps li"));
const llmStreamPanel = document.getElementById("llm-stream-panel");
const llmStreamOutput = document.getElementById("llm-stream-output");
const progressQueueWarn = document.getElementById("progress-queue-warn");
const progressQueueText = document.getElementById("progress-queue-text");
const progressTimeoutRow = document.getElementById("progress-timeout-row");
const usagePanel = document.getElementById("usage-panel");
const usageTotal = document.getElementById("usage-total");
const creditsPanel = document.getElementById("credits-panel");
const creditsRemaining = document.getElementById("credits-remaining");
const resultCost = document.getElementById("result-cost");
const applyAllUpdatesButton = document.getElementById("apply-all-updates");
const resultTitleInput = document.getElementById("result-revised-title");
const resultAbstractInput = document.getElementById("result-revised-abstract");
const rescoreResultButton = document.getElementById("rescore-result-button");
const rescoreResultStatus = document.getElementById("rescore-result-status");
const writingClubAction = document.getElementById("writing-club-action");
const writingClubButton = document.getElementById("writing-club-button");
const writingClubStatus = document.getElementById("writing-club-status");
const sectionButtons = Array.from(document.querySelectorAll(".section-generate-btn"));
const studyStartButton = document.getElementById("study-start-button");
const studyCompleteButton = document.getElementById("study-complete-button");
const studyCondition = document.getElementById("study-condition");
const studyStatus = document.getElementById("study-status");
const participantCodeInput = document.getElementById("participant-code");
const researchTypeInput = document.getElementById("research-type");
const researchStageInput = document.getElementById("research-stage");
const SECTION_LABELS = {
  background: "背景",
  problem: "問題",
  objective: "この研究で到達したい状態",
  challenge: "目的達成のために解決すべき課題",
  methods: "方法",
  experiment: "評価・検証と具体的な作業",
  expected_results: "想定される結果",
  discussion: "課題が解決されているかの考察",
  conclusion: "結論",
  contribution: "アイデアの核",
};
const EVALUATION_META = [
  { key: "logic", label: "全体の論理の説得性", short: "論理" },
  { key: "problem", label: "問題の具体性", short: "問題" },
  { key: "objective", label: "目的の具体性", short: "目的" },
  { key: "challenge", label: "課題の具体性", short: "課題" },
  { key: "methods", label: "方法の具体性", short: "方法" },
  { key: "experiment", label: "評価・検証の具体性", short: "検証" },
  { key: "expected_results", label: "結果の定量性", short: "結果" },
  { key: "discussion", label: "考察の具体性", short: "考察" },
  { key: "conclusion", label: "結論の具体性", short: "結論" },
  { key: "contribution", label: "貢献の具体性", short: "貢献" },
];

const NEXT_FIELD_BY_SOURCE = {
  background: { fieldName: "problem", detectedKey: "detected_problem" },
  problem: { fieldName: "objective", detectedKey: "detected_objective" },
  objective: { fieldName: "challenge", detectedKey: "detected_challenge" },
  challenge: { fieldName: "methods", detectedKey: "detected_methods" },
  methods: { fieldName: "experiment", detectedKey: "detected_experiment" },
  experiment: { fieldName: "expected_results", detectedKey: "detected_expected_results" },
  expected_results: { fieldName: "discussion", detectedKey: "detected_discussion" },
  discussion: { fieldName: "conclusion", detectedKey: "detected_conclusion" },
  conclusion: { fieldName: "contribution", detectedKey: "detected_contribution" },
};

let loadingIntervalId = null;
let pollingAbortController = null;
let timeoutSeconds = 300;
let synologyChatConfigured = null; // null = /api/health からの確認がまだ済んでいない
let latestGenerationId = null;
let latestPassAll = false;
let studySession = null;
let availableBackends = {
  openrouter: { configured: false, model: "未設定" },
  ollama: { configured: true, model: "取得中..." },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function logStudyEvent(eventType, details = {}) {
  if (!studySession) return;
  fetch("/api/study/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: studySession.id, event_type: eventType, ...details }),
  }).catch(() => {
    // Logging must never interrupt a participant's work.
  });
}

function applyStudyCondition(code) {
  // A is one-shot generation; B is intentionally item-input-only; C exposes the per-item AI workflow.
  const bulkMode = code === "A";
  const inputOnly = code === "B";
  document.getElementById("bulk-input-section")?.classList.toggle("hidden", !bulkMode);
  document.querySelectorAll(".input-section:not(#bulk-input-section), .phase-heading").forEach((element) => {
    element.classList.toggle("hidden", bulkMode);
  });
  sectionButtons.forEach((button) => {
    button.closest(".section-actions")?.classList.toggle("hidden", inputOnly || bulkMode);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = "Request failed.";
    try {
      const rawText = await response.text();
      if (rawText) {
        try {
          const payload = JSON.parse(rawText);
          detail = payload.detail || JSON.stringify(payload);
        } catch (_parseError) {
          detail = rawText;
        }
      }
    } catch (_error) {
      detail = "Request failed.";
    }
    throw new Error(detail);
  }
  return response.json();
}

function fillList(elementId, items, emptyLabel = "該当なし") {
  const target = document.getElementById(elementId);
  target.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = emptyLabel;
    target.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  }
}

function setWritingClubStatus(message, tone = "") {
  if (!writingClubStatus) {
    return;
  }
  writingClubStatus.textContent = message || "";
  writingClubStatus.className = "writing-club-status";
  if (tone) {
    writingClubStatus.classList.add(`is-${tone}`);
  }
}

function setRescoreStatus(message, tone = "") {
  if (!rescoreResultStatus) {
    return;
  }
  rescoreResultStatus.textContent = message || "";
  rescoreResultStatus.className = "rescore-result-status";
  if (tone) {
    rescoreResultStatus.classList.add(`is-${tone}`);
  }
}

function renderKeywords(items) {
  const target = document.getElementById("result-keywords");
  target.innerHTML = "";
  if (!items || items.length === 0) {
    const span = document.createElement("span");
    span.className = "keyword-pill empty";
    span.textContent = "キーワードなし";
    target.appendChild(span);
    return;
  }
  for (const item of items) {
    const span = document.createElement("span");
    span.className = "keyword-pill";
    span.textContent = item;
    target.appendChild(span);
  }
}

function renderSectionCards(targetId, items, emptyText) {
  const target = document.getElementById(targetId);
  target.innerHTML = "";
  if (!items || items.length === 0) {
    const article = document.createElement("article");
    article.className = "result-surface";
    article.textContent = emptyText;
    target.appendChild(article);
    return;
  }

  for (const item of items) {
    const article = document.createElement("article");
    article.className = "feedback-card";
    article.innerHTML = `
      <div class="feedback-head">
        <strong>${escapeHtml(item.section || "項目")}</strong>
      </div>
      <div class="feedback-body">
        <p><span class="feedback-label">入力文</span>${escapeHtml(item.input_text || "未入力")}</p>
        <p><span class="feedback-label">フィードバック</span>${escapeHtml(item.feedback || "コメントなし")}</p>
        <p><span class="feedback-label">修正候補</span>${escapeHtml(item.revision_candidate || "候補なし")}</p>
      </div>
    `;
    target.appendChild(article);
  }
}

function renderWritingClubAction(passAll) {
  latestPassAll = Boolean(passAll);
  if (!writingClubAction || !writingClubButton) {
    return;
  }

  writingClubAction.classList.remove("is-ready", "is-unavailable");

  if (!latestPassAll) {
    writingClubAction.classList.add("hidden");
    writingClubButton.disabled = true;
    setWritingClubStatus("");
    return;
  }

  writingClubAction.classList.remove("hidden");
  if (synologyChatConfigured === null) {
    writingClubAction.classList.add("is-unavailable");
    writingClubButton.disabled = true;
    setWritingClubStatus("Synology Chat の設定を確認しています...", "muted");
  } else if (synologyChatConfigured && latestGenerationId) {
    writingClubAction.classList.add("is-ready");
    writingClubButton.disabled = false;
    setWritingClubStatus("合格済みのため、この結果を論文執筆会へ投稿できます。", "muted");
  } else if (!latestGenerationId) {
    writingClubAction.classList.add("is-unavailable");
    writingClubButton.disabled = true;
    setWritingClubStatus("投稿対象の生成結果がまだ保存されていません。生成完了後に投稿できます。", "error");
  } else {
    writingClubAction.classList.add("is-unavailable");
    writingClubButton.disabled = true;
    setWritingClubStatus("Synology Chat の webhook が未設定です。設定後に投稿できます。", "error");
  }
}

function renderInlineSectionResult(payload) {
  const target = document.getElementById(`section-result-${payload.field_name}`);
  if (!target) {
    return;
  }
  const textarea = form.elements.namedItem(payload.field_name);
  const originalText = payload.input_text || "";
  const revisedText = payload.revision_candidate || "";
  const candidateId = crypto.randomUUID();
  logStudyEvent("candidate_presented", {
    field_name: payload.field_name,
    candidate_id: candidateId,
    before_text: originalText,
    after_text: revisedText,
  });
  target.classList.remove("hidden");
  target.innerHTML = `
    <article class="feedback-card inline">
      <div class="feedback-head">
        <strong>${escapeHtml(payload.section || "項目")}</strong>
      </div>
      <div class="feedback-body">
        <p><span class="feedback-label">フィードバック</span>${escapeHtml(payload.feedback || "コメントなし")}</p>
      </div>
      <div class="adoption-options">
        <label class="adoption-card">
          <input type="radio" name="adopt-${payload.field_name}" value="original" />
          <span class="adoption-title">元の文を採用</span>
          <span class="adoption-text">${escapeHtml(originalText || "元の文がありません。")}</span>
        </label>
        <label class="adoption-card">
          <input type="radio" name="adopt-${payload.field_name}" value="revised" ${revisedText ? "" : "disabled"} />
          <span class="adoption-title">修正候補を採用</span>
          <span class="adoption-text">${escapeHtml(revisedText || "修正候補なし")}</span>
        </label>
      </div>
      <div class="adoption-actions">
        <button type="button" class="unlock-btn hidden" data-field="${payload.field_name}">採用を解除して再編集</button>
      </div>
    </article>
  `;

  const radios = Array.from(target.querySelectorAll(`input[name="adopt-${payload.field_name}"]`));
  const unlockButton = target.querySelector(".unlock-btn");

  const lockSection = (selectedValue) => {
    if (!textarea || !("value" in textarea)) {
      return;
    }
    textarea.value = selectedValue === "revised" && revisedText ? revisedText : originalText;
    textarea.readOnly = true;
    textarea.classList.add("locked-field");
    const sectionButton = document.querySelector(`.section-generate-btn[data-field="${payload.field_name}"]`);
    if (sectionButton) {
      sectionButton.disabled = true;
    }
    if (unlockButton) {
      unlockButton.classList.remove("hidden");
    }
    logStudyEvent(selectedValue === "revised" ? "candidate_adopted" : "candidate_rejected", {
      field_name: payload.field_name,
      candidate_id: candidateId,
      before_text: originalText,
      after_text: textarea.value,
    });
  };

  radios.forEach((radio) => {
    radio.addEventListener("change", () => lockSection(radio.value));
  });

  if (unlockButton) {
    unlockButton.addEventListener("click", () => {
      if (textarea && "readOnly" in textarea) {
        textarea.readOnly = false;
        textarea.classList.remove("locked-field");
      }
      const sectionButton = document.querySelector(`.section-generate-btn[data-field="${payload.field_name}"]`);
      if (sectionButton) {
        sectionButton.disabled = false;
      }
      radios.forEach((radio) => {
        radio.checked = false;
      });
      unlockButton.classList.add("hidden");
      logStudyEvent("field_unlocked", { field_name: payload.field_name, candidate_id: candidateId, before_text: textarea?.value || "" });
    });
  }

  const next = NEXT_FIELD_BY_SOURCE[payload.field_name];
  if (next && payload[next.detectedKey]) {
    const nextInput = form.elements.namedItem(next.fieldName);
    if (nextInput && "value" in nextInput) {
      nextInput.value = payload[next.detectedKey];
    }
  }
  updateResearchCompass();
}

function unlockMainField(fieldName) {
  const textarea = form.elements.namedItem(fieldName);
  if (textarea && "readOnly" in textarea) {
    textarea.readOnly = false;
    textarea.classList.remove("locked-field");
  }
  const sectionButton = document.querySelector(`.section-generate-btn[data-field="${fieldName}"]`);
  if (sectionButton) {
    sectionButton.disabled = false;
  }
  const radios = document.querySelectorAll(`#section-result-${fieldName} input[name="adopt-${fieldName}"]`);
  radios.forEach((radio) => {
    radio.checked = false;
  });
  const unlockButton = document.querySelector(`#section-result-${fieldName} .unlock-btn`);
  if (unlockButton) {
    unlockButton.classList.add("hidden");
  }
}

function applyUpdateToForm(fieldName, value) {
  const textarea = form.elements.namedItem(fieldName);
  if (!textarea || !("value" in textarea)) {
    return;
  }
  unlockMainField(fieldName);
  textarea.value = value;
  textarea.focus();
  updateResearchCompass();
}

function renderRadarChart(items, passThreshold = 8) {
  const target = document.getElementById("result-score-chart");
  if (!target) {
    return;
  }
  if (!items || items.length === 0) {
    target.innerHTML = '<div class="result-surface">評価データがありません。</div>';
    return;
  }

  const size = 420;
  const center = size / 2;
  const radius = 138;
  const labelRadius = 176;
  const levels = [2, 4, 6, 8, 10];
  const angleStep = (Math.PI * 2) / items.length;
  const startAngle = -Math.PI / 2;

  const pointFor = (index, value, pointRadius = radius) => {
    const ratio = Math.max(0, Math.min(10, value)) / 10;
    const angle = startAngle + angleStep * index;
    return {
      x: center + Math.cos(angle) * pointRadius * ratio,
      y: center + Math.sin(angle) * pointRadius * ratio,
    };
  };

  const polygonPoints = (value) =>
    items.map((_, index) => {
      const point = pointFor(index, value);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(" ");

  const scorePoints = items
    .map((item, index) => {
      const point = pointFor(index, item.score);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");

  const rings = levels
    .map((level) => {
      const ringPoints = items
        .map((_, index) => {
          const point = pointFor(index, level);
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        })
        .join(" ");
      return `<polygon points="${ringPoints}" class="radar-ring" />`;
    })
    .join("");

  const axes = items
    .map((_, index) => {
      const edge = pointFor(index, 10);
      return `<line x1="${center}" y1="${center}" x2="${edge.x.toFixed(1)}" y2="${edge.y.toFixed(1)}" class="radar-axis" />`;
    })
    .join("");

  const labels = items
    .map((item, index) => {
      const point = pointFor(index, 10, labelRadius);
      const anchor = Math.abs(point.x - center) < 14 ? "middle" : point.x < center ? "end" : "start";
      return `
        <text x="${point.x.toFixed(1)}" y="${(point.y - 4).toFixed(1)}" text-anchor="${anchor}" class="radar-label">
          ${escapeHtml(item.short || item.criterion)}
        </text>
        <text x="${point.x.toFixed(1)}" y="${(point.y + 15).toFixed(1)}" text-anchor="${anchor}" class="radar-score">
          ${item.score}/10
        </text>
      `;
    })
    .join("");

  const ringTicks = levels
    .map((level) => {
      const y = center - radius * (level / 10);
      return `<text x="${center + 8}" y="${y.toFixed(1)}" class="radar-tick">${level}</text>`;
    })
    .join("");

  target.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" class="radar-svg" role="img" aria-label="評価レーダーチャート">
      <rect x="0" y="0" width="${size}" height="${size}" rx="24" class="radar-bg" />
      ${rings}
      ${axes}
      <polygon points="${polygonPoints(passThreshold)}" class="radar-threshold" />
      <polygon points="${scorePoints}" class="radar-current" />
      ${items
        .map((item, index) => {
          const point = pointFor(index, item.score);
          return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4.2" class="radar-dot" />`;
        })
        .join("")}
      ${labels}
      ${ringTicks}
    </svg>
  `;
}

function renderEvaluationSummary(items, passThreshold = 8, passAll = false) {
  const status = document.getElementById("result-pass-status");
  const threshold = document.getElementById("result-pass-threshold");
  const description = document.getElementById("result-pass-description");
  if (!status || !threshold || !description) {
    return;
  }

  const reachedCount = (items || []).filter((item) => Number(item.score || 0) >= passThreshold).length;
  const minScore = items && items.length > 0 ? Math.min(...items.map((item) => Number(item.score || 0))) : 0;
  status.textContent = passAll ? "合格" : "改善が必要";
  status.classList.toggle("is-pass", passAll);
  status.classList.toggle("is-fail", !passAll);
  threshold.textContent = `全項目 ${passThreshold} 点以上`;
  description.textContent = passAll
    ? `10 項目すべてが ${passThreshold} 点以上です。アブストラクトとして十分に説得力があります。`
    : `${reachedCount}/10 項目が合格ラインに到達しています。最低点は ${minScore} 点です。更新案を反映して、すべて ${passThreshold} 点以上を目指せます。`;

  renderRadarChart(
    (items || []).map((item, index) => ({
      ...item,
      short: EVALUATION_META[index]?.short || item.criterion,
    })),
    passThreshold,
  );

  const target = document.getElementById("result-evaluation-list");
  target.innerHTML = "";
  if (!items || items.length === 0) {
    const article = document.createElement("article");
    article.className = "result-surface";
    article.textContent = "評価コメントはありません。";
    target.appendChild(article);
    return;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "score-card";
    const isPassing = Number(item.score || 0) >= passThreshold;
    article.innerHTML = `
      <div class="score-card-head">
        <strong>${escapeHtml(item.criterion || "評価項目")}</strong>
        <span class="score-badge ${isPassing ? "pass" : "fail"}">${Number(item.score || 0)}/10</span>
      </div>
      <p>${escapeHtml(item.comment || "コメントなし")}</p>
    `;
    target.appendChild(article);
  });
}

function renderSectionUpdates(items) {
  const target = document.getElementById("result-section-updates");
  if (!target) {
    return;
  }
  target.innerHTML = "";
  if (!items || items.length === 0) {
    const article = document.createElement("article");
    article.className = "result-surface";
    article.textContent = "改善用の更新案はありません。";
    target.appendChild(article);
    return;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "update-card";
    article.innerHTML = `
      <div class="update-card-head">
        <strong>${escapeHtml(item.section || SECTION_LABELS[item.field_name] || "項目")}</strong>
        <button type="button" class="secondary-btn apply-update-btn" data-field="${item.field_name}">入力欄へ反映</button>
      </div>
      <p class="update-note"><span class="feedback-label">補強ポイント</span>${escapeHtml(item.reason || "補足なし")}</p>
      <label>
        <span>更新案</span>
        <textarea class="update-draft-textarea" data-field="${item.field_name}" rows="3">${escapeHtml(
          item.suggested_text || "",
        )}</textarea>
      </label>
    `;
    target.appendChild(article);
  });

  target.querySelectorAll(".apply-update-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const fieldName = button.dataset.field;
      const textarea = target.querySelector(`.update-draft-textarea[data-field="${fieldName}"]`);
      if (textarea) {
        applyUpdateToForm(fieldName, textarea.value);
      }
    });
  });
}

function setLoadingState(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);

  if (loadingIntervalId) {
    clearInterval(loadingIntervalId);
    loadingIntervalId = null;
  }

  if (!isLoading) {
    submitButton.textContent = "研究の指針となるアブストラクトをつくる";
    return;
  }

  const frames = ["生成中", "生成中.", "生成中..", "生成中..."];
  let frameIndex = 0;
  submitButton.textContent = frames[frameIndex];
  loadingIntervalId = window.setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    submitButton.textContent = frames[frameIndex];
  }, 420);
}

function setSectionButtonLoading(button, isLoading) {
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
}

function resetProgressSteps() {
  for (const step of progressSteps) {
    step.classList.remove("active", "done", "error");
  }
}

function updateProgressSteps(progress, status) {
  const thresholds = [5, 25, 55, 72, 88, 100];
  const activeIndex = thresholds.findIndex((value) => progress <= value);
  progressSteps.forEach((step, index) => {
    step.classList.remove("active", "done", "error");
    if (status === "failed") {
      if (index === Math.max(0, activeIndex)) {
        step.classList.add("error");
      } else if (progress > thresholds[index]) {
        step.classList.add("done");
      }
      return;
    }
    if (progress >= thresholds[index]) {
      step.classList.add(progress >= 100 || index < activeIndex ? "done" : "active");
    }
  });
}

function showProgress(job) {
  const progress = Number(job.progress || 0);
  resultEmpty.classList.add("hidden");
  resultView.classList.add("hidden");
  resultProgress.classList.remove("hidden");
  progressTitle.textContent = job.status === "failed" ? "最終生成に失敗しました" : "タイトルとアブストラクトを生成しています";
  progressPercent.textContent = `${progress}%`;
  progressFill.style.width = `${progress}%`;
  progressStage.textContent = job.error_message || job.stage || "処理中...";
  updateProgressSteps(progress, job.status);

  const isQueuing = progress === 65 && job.status === "processing";
  progressQueueWarn.classList.toggle("hidden", !isQueuing);
  if (isQueuing) {
    const poolSize = job.pool_size || 1;
    const available = job.pool_available ?? 0;
    const busy = poolSize - available;
    progressQueueText.textContent = `生成スロットが使用中（${busy}/${poolSize} 件処理中）のため待機しています。前の処理が終わり次第、生成を開始します。`;
  }

  const isLlmRunning = progress === 72 && job.status === "processing";
  if (isLlmRunning) {
    const limit = job.timeout_seconds || timeoutSeconds;
    const startedAt = job.updated_at ? new Date(job.updated_at).getTime() : Date.now();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, limit - elapsed);
    progressTimeoutRow.classList.remove("hidden");
    progressTimeoutRow.textContent = `タイムアウトまで残り約 ${remaining} 秒（上限 ${limit} 秒）`;
  } else {
    progressTimeoutRow.classList.add("hidden");
  }

  const output = job.llm_output || "";
  if (output) {
    llmStreamPanel.classList.remove("hidden");
    llmStreamPanel.open = true;
    llmStreamOutput.textContent = output;
    llmStreamOutput.scrollTop = llmStreamOutput.scrollHeight;
  } else {
    llmStreamPanel.classList.add("hidden");
    llmStreamOutput.textContent = "";
  }
}

function hideProgress() {
  resultProgress.classList.add("hidden");
}

function renderResult(payload) {
  const result = payload.result || {};
  latestGenerationId = payload.id || null;
  hideProgress();
  if (resultTitleInput) {
    resultTitleInput.value = result.revised_title || "";
  }
  if (resultAbstractInput) {
    resultAbstractInput.value = result.revised_abstract || "アブストラクトを生成できませんでした。";
  }
  setRescoreStatus("内容を編集したあと、研究構想の具体性を再確認できます。");
  document.getElementById("result-abstract-feedback").textContent =
    result.abstract_feedback || "コメントはありません。";
  renderEvaluationSummary(result.evaluation || [], result.pass_threshold || 7.5, Boolean(result.pass_all));
  renderWritingClubAction(Boolean(result.pass_all));
  renderSectionUpdates(result.section_updates || []);
  renderSectionCards("result-section-feedback", result.section_feedback || [], "項目別の総括はありません。");
  renderKeywords(result.keywords || []);
  fillList("result-overall-notes", result.overall_notes || []);
  fillList("result-next-steps", result.next_steps || [], "追加提案はありません");
  resultDownload.href = `/api/generations/${payload.id}/markdown`;

  if (payload.cost_usd != null) {
    resultCost.textContent = `この生成のコスト: $${payload.cost_usd.toFixed(6)}`;
    resultCost.classList.remove("hidden");
    loadUsage();
  } else {
    resultCost.classList.add("hidden");
  }

  resultEmpty.classList.add("hidden");
  resultView.classList.remove("hidden");
  logStudyEvent("generation_completed", { payload: { generation_id: payload.id } });
}

async function pollJob(jobId) {
  if (pollingAbortController) {
    pollingAbortController.abort();
  }
  pollingAbortController = new AbortController();

  while (true) {
    const job = await fetchJson(`/api/generations/jobs/${jobId}`, {
      signal: pollingAbortController.signal,
    });
    showProgress(job);

    if (job.status === "completed") {
      renderResult(job.result);
      setLoadingState(false);
      return;
    }

    if (job.status === "failed") {
      setLoadingState(false);
      throw new Error(job.error_message || "生成に失敗しました。");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
}

async function loadHealth() {
  try {
    const payload = await fetchJson("/api/health", { cache: "no-store" });
    synologyChatConfigured = Boolean(payload.synology_chat_configured);
    availableBackends = {
      openrouter: {
        configured: payload.openrouter_configured,
        model: payload.openrouter_model,
      },
      ollama: {
        configured: payload.ollama_model_available,
        model: payload.ollama_model,
      },
    };
    const openrouterText = payload.openrouter_configured
      ? `OpenRouter OK（${payload.openrouter_key_count} キー）`
      : "OpenRouter 未設定";
    const ollamaText = payload.ollama_model_available ? "Ollama 接続 OK" : "Ollama モデル未ロード";
    healthStatus.textContent = `${openrouterText} / ${ollamaText}`;
    updateBackendUi();
    if (payload.timeout_seconds) {
      timeoutSeconds = payload.timeout_seconds;
    }
    renderWritingClubAction(latestPassAll);
    if (payload.openrouter_configured) {
      loadUsage();
    }
  } catch (error) {
    healthStatus.textContent = `接続失敗: ${error.message}`;
    fixedModel.textContent = "取得できませんでした";
  }
}

function updateBackendUi() {
  const selectedBackend = backendSelect.value;
  fixedModel.textContent = availableBackends[selectedBackend]?.model || "取得できませんでした";
  const openrouterOption = backendSelect.querySelector('option[value="openrouter"]');
  if (openrouterOption) {
    openrouterOption.disabled = !availableBackends.openrouter.configured;
  }
  if (selectedBackend === "openrouter" && !availableBackends.openrouter.configured) {
    backendSelect.value = "ollama";
    fixedModel.textContent = availableBackends.ollama.model;
  }
}

async function loadUsage() {
  try {
    const payload = await fetchJson("/api/usage");
    if (payload.backend !== "openrouter") {
      return;
    }
    usageTotal.textContent = `$${payload.total_cost_usd.toFixed(4)}（${payload.generated_count_with_cost} 件分）`;
    usagePanel.classList.remove("hidden");
    if (payload.credits) {
      creditsRemaining.textContent = `$${payload.credits.remaining.toFixed(4)}`;
      creditsPanel.classList.remove("hidden");
    }
  } catch (_error) {
    // usage is best-effort
  }
}

sectionButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const fieldName = button.dataset.field;
    const formData = new FormData(form);
    formData.set("field_name", fieldName);
    const resultTarget = document.getElementById(`section-result-${fieldName}`);
    const originalLabel = button.textContent;
    let elapsedSeconds = 0;
    if (resultTarget) {
      resultTarget.classList.remove("hidden");
      resultTarget.innerHTML = '<p class="section-waiting">Gemini 2.5 Pro が研究内容を分析しています。通常は30秒前後かかります。</p>';
    }
    setSectionButtonLoading(button, true);
    logStudyEvent("revision_requested", { field_name: fieldName, before_text: formData.get(fieldName) || "" });
    const elapsedTimer = window.setInterval(() => {
      elapsedSeconds += 1;
      button.textContent = `分析中 ${elapsedSeconds}秒`;
    }, 1000);
    try {
      const payload = await fetchJson("/api/revise-section", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(70000),
      });
      renderInlineSectionResult(payload);
      // Cost for this call is logged in the background (OpenRouter's cost
      // stats aren't available immediately), so re-check the total a bit later.
      window.setTimeout(loadUsage, 10000);
      window.setTimeout(loadUsage, 26000);
    } catch (error) {
      if (resultTarget) {
        const message = error.name === "TimeoutError"
          ? "70秒以内に応答がありませんでした。もう一度実行してください。"
          : `分析に失敗しました: ${error.message}`;
        resultTarget.innerHTML = `<p class="section-error">${escapeHtml(message)}</p>`;
      }
    } finally {
      window.clearInterval(elapsedTimer);
      setSectionButtonLoading(button, false);
      button.textContent = originalLabel;
    }
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoadingState(true);
  resetProgressSteps();
  resultDownload.href = "#";
  latestGenerationId = null;
  latestPassAll = false;
  renderWritingClubAction(false);
  setRescoreStatus("");

  const formData = new FormData(form);
  logStudyEvent("generation_requested", {
    payload: Object.fromEntries(Array.from(formData.entries()).filter(([key]) => key !== "last_name" && key !== "first_name")),
  });

  try {
    const job = await fetchJson("/api/generations", {
      method: "POST",
      body: formData,
    });
    showProgress(job);
    await pollJob(job.id);
  } catch (error) {
    alert(`最終生成に失敗しました: ${error.message}`);
  } finally {
    setLoadingState(false);
  }
});

Array.from(form.querySelectorAll("textarea")).forEach((textarea) => {
  let initialValue = textarea.value;
  textarea.addEventListener("focus", () => { initialValue = textarea.value; });
  textarea.addEventListener("blur", () => {
    if (textarea.value !== initialValue) {
      logStudyEvent("field_edited", { field_name: textarea.name, before_text: initialValue, after_text: textarea.value });
    }
  });
});

if (studyStartButton) {
  studyStartButton.addEventListener("click", async () => {
    const participantCode = participantCodeInput?.value.trim();
    if (!participantCode) {
      studyStatus.textContent = "匿名参加者IDを入力してください。";
      return;
    }
    studyStartButton.disabled = true;
    try {
      studySession = await fetchJson("/api/study/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_code: participantCode, research_type: researchTypeInput?.value || "", research_stage: researchStageInput?.value || "" }),
      });
      studyCondition.textContent = studySession.condition_label;
      studyStatus.textContent = "このセッションの操作ログを保存しています。終了時に「この条件を終了」を押してください。";
      studyCompleteButton?.classList.remove("hidden");
      applyStudyCondition(studySession.condition_code);
      logStudyEvent("session_started");
    } catch (error) {
      studyStatus.textContent = `開始できませんでした: ${error.message}`;
      studyStartButton.disabled = false;
    }
  });
}

if (studyCompleteButton) {
  studyCompleteButton.addEventListener("click", async () => {
    if (!studySession) return;
    try {
      await fetchJson(`/api/study/sessions/${studySession.id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generation_id: latestGenerationId }),
      });
      studyStatus.textContent = "この条件を終了しました。次回は同じ参加者IDで開始すると次の条件が割り当てられます。";
      studyCompleteButton.classList.add("hidden");
      studyStartButton.disabled = false;
      studySession = null;
      applyStudyCondition("C");
    } catch (error) {
      studyStatus.textContent = `終了処理に失敗しました: ${error.message}`;
    }
  });
}

if (applyAllUpdatesButton) {
  applyAllUpdatesButton.addEventListener("click", () => {
    const drafts = document.querySelectorAll(".update-draft-textarea");
    drafts.forEach((draft) => {
      const fieldName = draft.dataset.field;
      if (fieldName) {
        applyUpdateToForm(fieldName, draft.value);
      }
    });
  });
}

if (writingClubButton) {
  writingClubButton.addEventListener("click", async () => {
    if (!latestGenerationId) {
      setWritingClubStatus("投稿対象の生成結果が見つかりません。", "error");
      return;
    }
    setSectionButtonLoading(writingClubButton, true);
    setWritingClubStatus("論文執筆会へ投稿しています...", "muted");
    try {
      const payload = await fetchJson(`/api/generations/${latestGenerationId}/notify-writing-club`, {
        method: "POST",
      });
      setWritingClubStatus(payload.message || "論文執筆会に確認依頼を投稿しました。", "success");
    } catch (error) {
      setWritingClubStatus(`投稿に失敗しました: ${error.message}`, "error");
    } finally {
      setSectionButtonLoading(writingClubButton, false);
    }
  });
}

if (rescoreResultButton) {
  rescoreResultButton.addEventListener("click", async () => {
    const revisedTitle = resultTitleInput?.value.trim() || "";
    const revisedAbstract = resultAbstractInput?.value.trim() || "";
    if (!revisedTitle || !revisedAbstract) {
      setRescoreStatus("タイトルとアブストラクトの両方を入力してから確認してください。", "error");
      return;
    }

    const formData = new FormData(form);
    if (latestGenerationId) {
      formData.set("generation_id", String(latestGenerationId));
    }
    formData.set("revised_title", revisedTitle);
    formData.set("revised_abstract", revisedAbstract);

    setSectionButtonLoading(rescoreResultButton, true);
    setRescoreStatus("研究構想の具体性を確認しています...");
    try {
      const payload = await fetchJson("/api/evaluate-draft", {
        method: "POST",
        body: formData,
      });
      if (payload.generation_id) {
        latestGenerationId = payload.generation_id;
      }
      renderEvaluationSummary(payload.evaluation || [], payload.pass_threshold || 7.5, Boolean(payload.pass_all));
      renderWritingClubAction(Boolean(payload.pass_all));
      setRescoreStatus("編集後の内容で具体性チェックを更新しました。", "success");
    } catch (error) {
      setRescoreStatus(`具体性の再確認に失敗しました: ${error.message}`, "error");
    } finally {
      setSectionButtonLoading(rescoreResultButton, false);
    }
  });
}

loadHealth();
backendSelect.addEventListener("change", updateBackendUi);

const compassGenerateButton = document.getElementById("compass-generate-button");
const compassStatus = document.getElementById("compass-status");
const DRAFT_STORAGE_KEY = "buildabstract:research-draft:v1";
let compassGenerated = false;

function saveResearchDraft() {
  const draft = {};
  Object.keys(SECTION_LABELS).forEach((fieldName) => {
    draft[fieldName] = form.elements.namedItem(fieldName)?.value || "";
  });
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (_error) {
    // Storage may be unavailable in private browsing or restricted environments.
  }
}

function restoreResearchDraft() {
  try {
    const savedDraft = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    Object.keys(SECTION_LABELS).forEach((fieldName) => {
      const textarea = form.elements.namedItem(fieldName);
      if (textarea && typeof savedDraft[fieldName] === "string") {
        textarea.value = savedDraft[fieldName];
      }
    });
  } catch (_error) {
    // Ignore malformed or inaccessible saved data and keep empty defaults.
  }
}

function updateResearchCompass() {
  const researchFields = Object.keys(SECTION_LABELS);
  const filledCount = researchFields.filter((fieldName) => form.elements.namedItem(fieldName)?.value.trim()).length;
  const count = document.getElementById("compass-count");
  const fill = document.getElementById("compass-fill");
  if (count) count.textContent = `${filledCount} / ${researchFields.length} 項目`;
  if (fill) fill.style.width = `${(filledCount / researchFields.length) * 100}%`;
  if (compassGenerateButton) compassGenerateButton.disabled = filledCount < 3;
  if (compassGenerated && compassStatus) {
    compassStatus.textContent = "入力が変わりました。再生成すると分析を更新できます。";
    compassStatus.className = "compass-status is-stale";
  }
  saveResearchDraft();
  updateSentenceGuides();
}

if (compassGenerateButton) {
  compassGenerateButton.addEventListener("click", async () => {
    const originalLabel = compassGenerateButton.textContent;
    let elapsedSeconds = 0;
    setSectionButtonLoading(compassGenerateButton, true);
    compassStatus.textContent = "Gemini 2.5 Pro が入力全体を分析しています。通常は30秒前後かかります。";
    compassStatus.className = "compass-status";
    const elapsedTimer = window.setInterval(() => {
      elapsedSeconds += 1;
      compassGenerateButton.textContent = `研究構想を分析中 ${elapsedSeconds}秒`;
    }, 1000);
    try {
      const payload = await fetchJson("/api/research-compass", {
        method: "POST",
        body: new FormData(form),
        signal: AbortSignal.timeout(70000),
      });
      document.getElementById("compass-pitch").textContent = payload.research_pitch || "研究ピッチを特定できませんでした。";
      document.getElementById("compass-hypothesis").textContent = payload.core_hypothesis || "核となる仮説を特定できませんでした。";
      document.getElementById("compass-gap").textContent = payload.critical_gap || "未決定事項を特定できませんでした。";
      document.getElementById("compass-action").textContent = payload.next_action || "次の作業を特定できませんでした。";
      compassGenerated = true;
      compassStatus.textContent = "入力全体を分析しました。";
      window.setTimeout(loadUsage, 10000);
    } catch (error) {
      compassStatus.textContent = error.name === "TimeoutError"
        ? "70秒以内に応答がありませんでした。もう一度実行してください。"
        : `分析に失敗しました: ${error.message}`;
      compassStatus.className = "compass-status is-stale";
    } finally {
      window.clearInterval(elapsedTimer);
      setSectionButtonLoading(compassGenerateButton, false);
      compassGenerateButton.textContent = originalLabel;
      const filledCount = Object.keys(SECTION_LABELS).filter(
        (fieldName) => form.elements.namedItem(fieldName)?.value.trim(),
      ).length;
      compassGenerateButton.disabled = filledCount < 3;
    }
  });
}

function sentenceCount(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const endings = text.match(/[。！？!?]+(?=\s|$)|[。！？!?]/g);
  if (!endings) return 1;
  const trailingEnding = /[。！？!?]\s*$/.test(text);
  return endings.length + (trailingEnding ? 0 : 1);
}

function updateSentenceGuides() {
  Object.keys(SECTION_LABELS).forEach((fieldName) => {
    const textarea = form.elements.namedItem(fieldName);
    const guide = document.querySelector(`.sentence-guide[data-field="${fieldName}"]`);
    if (!textarea || !guide) return;
    const count = sentenceCount(textarea.value);
    guide.classList.toggle("is-ready", count === 1);
    guide.classList.toggle("is-warning", count > 1);
    guide.textContent = count === 0 ? "一つの判断を、一文で入力" : count === 1 ? "1文" : `${count}文あります。一文に絞ってください`;
  });
}

document.querySelectorAll(".input-section[data-field]").forEach((section) => {
  const fieldName = section.dataset.field;
  const textarea = form.elements.namedItem(fieldName);
  if (!textarea) return;
  textarea.setAttribute("aria-describedby", `sentence-guide-${fieldName}`);
  const guide = document.createElement("p");
  guide.id = `sentence-guide-${fieldName}`;
  guide.className = "sentence-guide";
  guide.dataset.field = fieldName;
  textarea.insertAdjacentElement("afterend", guide);
});

form.addEventListener("input", updateResearchCompass);
form.addEventListener("change", updateResearchCompass);
restoreResearchDraft();
updateResearchCompass();
