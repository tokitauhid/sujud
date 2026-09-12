const TAGS = [
  "consistency", "patience", "good-deeds", "prayer", "jamaah",
  "returning-after-difficulty", "time-and-prayer", "hope", "general",
  "not-relevant", "needs-context", "possible-duplicate", "translation-review",
];

const savedReviewTab = localStorage.getItem("sujud-review-tab");
const state = { candidates: [], query: "", filter: "all", lengthFilter: "all", reviewTab: savedReviewTab || "unreviewed", deferMoveIds: new Set(), drafts: new Map() };
const reviewerKey = "sujud-reviewer-id";
const reviewerId = localStorage.getItem(reviewerKey) || crypto.randomUUID();
localStorage.setItem(reviewerKey, reviewerId);
const list = document.querySelector("#candidateList");
const message = document.querySelector("#message");
let isLoading = false;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
const reviewFor = (candidate) => ({ relevant: candidate.myRelevant, tags: parseTags(candidate.myTags), note: candidate.myNote || "" });
const parseTags = (value) => { try { return Array.isArray(value) ? value : JSON.parse(value || "[]"); } catch { return []; } };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "content-type": "application/json", "x-reviewer-id": reviewerId, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function showMessage(text, isError = false) {
  message.hidden = !text;
  message.textContent = text;
  message.style.color = isError ? "var(--danger)" : "var(--warning)";
}

function filteredCandidates() {
  return state.candidates.filter((candidate) => {
    const text = [candidate.id, candidate.collection, candidate.reference, candidate.translatedText].join(" ").toLowerCase();
    const textLength = (candidate.translatedText || "").length;
    const matchesQuery = !state.query || text.includes(state.query);
    const reviewed = !state.deferMoveIds.has(candidate.id) && candidate.myRelevant !== null && candidate.myRelevant !== undefined;
    const communityReviewed = Number(candidate.communityReviewed) === 1;
    const matchesReviewTab = state.reviewTab === "all" ||
      (state.reviewTab === "reviewed" && reviewed) ||
      (state.reviewTab === "community-reviewed" && communityReviewed) ||
      (state.reviewTab === "unreviewed" && !reviewed);
    const matchesFilter = state.filter === "all" || (state.filter === "unreviewed" && !reviewed) || (state.filter === "relevant" && candidate.myRelevant === 1) || (state.filter === "not-relevant" && candidate.myRelevant === 0);
    const matchesLength = state.lengthFilter === "all" ||
      (state.lengthFilter === "short" && textLength <= 300) ||
      (state.lengthFilter === "medium" && textLength > 300 && textLength <= 800) ||
      (state.lengthFilter === "long" && textLength > 800);
    return matchesQuery && matchesReviewTab && matchesFilter && matchesLength;
  });
}

function render() {
  const candidates = filteredCandidates();
  document.querySelectorAll("[data-review-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.reviewTab === state.reviewTab));
  const reviewedCount = state.candidates.filter((candidate) => candidate.myRelevant !== null && candidate.myRelevant !== undefined).length;
  document.querySelector("#reviewCount").textContent = `${reviewedCount} reviewed`;
  document.querySelector("#reviewSummary").textContent = `${state.candidates.length} total · ${reviewedCount} reviewed · ${state.candidates.length - reviewedCount} left`;
  document.querySelector("#communitySummary").textContent = `${state.candidates.filter((candidate) => Number(candidate.communityReviewed) === 1).length} community reviewed`;
  if (!candidates.length) { list.innerHTML = '<div class="empty">No candidates match the current filter.</div>'; return; }
  list.innerHTML = candidates.map((candidate) => {
    const review = reviewFor(candidate);
    const draft = state.drafts.get(candidate.id) || {};
    const draftRelevant = draft.relevant ?? (review.relevant === 1 ? true : review.relevant === 0 ? false : null);
    const draftTags = draft.tags ?? review.tags;
    const draftNote = draft.note ?? review.note;
    const reviewedClass = review.relevant !== null && review.relevant !== undefined ? "reviewed" : "";
    return `<article class="card ${reviewedClass}" data-id="${escapeHtml(candidate.id)}">
      <div class="card-head"><div>
        <h2><span>${escapeHtml(candidate.id)}</span><small>${escapeHtml(candidate.collection)} · ${escapeHtml(candidate.reference)}</small></h2>
        <blockquote>${escapeHtml(candidate.translatedText)}</blockquote>
        <div class="source-line"><span>${escapeHtml(candidate.grading)}</span> · <span>${(candidate.translatedText || "").length} characters</span> · <a href="${escapeHtml(candidate.sourceUrl)}" target="_blank" rel="noopener">Open source</a> · <span>${candidate.relevantCount || 0} relevant / ${candidate.notRelevantCount || 0} not relevant</span></div>
      </div></div>
      <div class="relevance" role="group" aria-label="Relevance for ${escapeHtml(candidate.id)}">
        <button data-action="relevance" data-value="true" class="${draftRelevant === true ? "active-yes" : ""}">Relevant</button>
        <button data-action="relevance" data-value="false" class="${draftRelevant === false ? "active-no" : ""}">Not relevant</button>
        <button class="button save-review" data-action="save-review" type="button" ${draftRelevant === null ? "disabled" : ""}>Save review</button>
      </div>
      <div class="details">
        <label>Choose tags <span class="tag-grid">${TAGS.map((tag) => `<label class="tag-option"><input type="checkbox" data-action="tag" value="${tag}" ${draftTags.includes(tag) ? "checked" : ""} /><span>${tag}</span></label>`).join("")}</span></label>
        <label>Review note <textarea data-action="note" placeholder="Add context for moderators or the scholarly reviewer">${escapeHtml(draftNote)}</textarea></label>
      </div>
      <details class="report"><summary>Report a source, translation, duplicate, or context problem</summary><div class="report-form"><label>Issue <select data-action="report-type"><option value="incorrect-source">Incorrect source</option><option value="translation">Translation problem</option><option value="duplicate">Possible duplicate</option><option value="context">Needs context</option><option value="other">Other</option></select></label><textarea data-action="report-note" placeholder="What should the review team check?"></textarea><button class="button secondary" data-action="report">Submit report</button></div></details>
    </article>`;
  }).join("");
}

async function saveReview(card) {
  const candidate = state.candidates.find((item) => item.id === card.dataset.id);
  const draft = state.drafts.get(candidate.id) || {};
  if (typeof draft.relevant !== "boolean") return;
  await api("/api/reviews", { method: "POST", body: JSON.stringify({ candidateId: candidate.id, reviewerId, relevant: draft.relevant, tags: draft.tags || [], note: draft.note || "" }) });
  candidate.myRelevant = draft.relevant ? 1 : 0;
  candidate.myTags = JSON.stringify(draft.tags || []);
  candidate.myNote = draft.note || "";
  state.deferMoveIds.add(candidate.id);
  state.drafts.delete(candidate.id);
  showMessage("Review saved.");
  render();
}

async function load(silent = false) {
  if (isLoading) return;
  isLoading = true;
  try {
    const data = await api("/api/candidates");
    const serverCandidates = data.candidates || [];
    if (silent) {
      const deferred = new Map(state.candidates.filter((candidate) => state.deferMoveIds.has(candidate.id)).map((candidate) => [candidate.id, candidate]));
      state.candidates = serverCandidates.map((candidate) => deferred.get(candidate.id) ? { ...candidate, myRelevant: null, myTags: null, myNote: null } : candidate);
    } else {
      state.candidates = serverCandidates;
      state.deferMoveIds.clear();
      state.drafts.clear();
    }
    const updateTime = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date());
    document.querySelector("#reviewerStatus").textContent = `Auto-sync active · updated ${updateTime}`;
    if (!silent) showMessage(state.candidates.length ? "" : "No candidates have been seeded yet. Ask an administrator to import them into D1.");
    render();
  } catch (error) {
    if (!silent) { showMessage(error.message, true); list.innerHTML = ""; }
  } finally {
    isLoading = false;
  }
}

list.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".card");
  if (button.dataset.action === "relevance") {
    card.querySelectorAll('button[data-action="relevance"]').forEach((item) => item.classList.remove("active-yes", "active-no"));
    button.classList.add(button.dataset.value === "true" ? "active-yes" : "active-no");
    const candidateId = card.dataset.id;
    const draft = state.drafts.get(candidateId) || { tags: [], note: "" };
    draft.relevant = button.dataset.value === "true";
    state.drafts.set(candidateId, draft);
    card.querySelector('[data-action="save-review"]').disabled = false;
  }
  if (button.dataset.action === "save-review") {
    try { await saveReview(card); } catch (error) { showMessage(error.message, true); }
  }
  if (button.dataset.action === "report") {
    try {
      await api("/api/reports", { method: "POST", body: JSON.stringify({ candidateId: card.dataset.id, reviewerId, reportType: card.querySelector('[data-action="report-type"]').value, note: card.querySelector('[data-action="report-note"]').value }) });
      showMessage("Report submitted to the review team.");
    } catch (error) { showMessage(error.message, true); }
  }
});

list.addEventListener("change", async (event) => {
  if (!event.target.matches('input[data-action="tag"]')) return;
  const card = event.target.closest(".card");
  const draft = state.drafts.get(card.dataset.id) || { relevant: null, tags: [], note: "" };
  draft.tags = [...card.querySelectorAll('input[data-action="tag"]:checked')].map((input) => input.value);
  state.drafts.set(card.dataset.id, draft);
});

list.addEventListener("blur", async (event) => {
  if (!event.target.matches('textarea[data-action="note"]')) return;
  const card = event.target.closest(".card");
  const draft = state.drafts.get(card.dataset.id) || { relevant: null, tags: [], note: "" };
  draft.note = event.target.value;
  state.drafts.set(card.dataset.id, draft);
}, true);

document.querySelector("#search").addEventListener("input", (event) => { state.query = event.target.value.toLowerCase(); render(); });
document.querySelector("#filter").addEventListener("change", (event) => { state.filter = event.target.value; render(); });
document.querySelector("#lengthFilter").addEventListener("change", (event) => { state.lengthFilter = event.target.value; render(); });
document.querySelectorAll("[data-review-tab]").forEach((tab) => tab.addEventListener("click", () => {
  state.reviewTab = tab.dataset.reviewTab;
  localStorage.setItem("sujud-review-tab", state.reviewTab);
  render();
}));
document.querySelector("#refresh").addEventListener("click", load);
load();
setInterval(() => load(true), 30000);
