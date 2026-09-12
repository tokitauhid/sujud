const TAGS = [
  "consistency", "patience", "good-deeds", "prayer", "jamaah",
  "returning-after-difficulty", "time-and-prayer", "hope", "general",
  "not-relevant", "needs-context", "possible-duplicate", "translation-review",
];

const state = { candidates: [], query: "", filter: "all" };
const reviewerKey = "sujud-reviewer-id";
const reviewerId = localStorage.getItem(reviewerKey) || crypto.randomUUID();
localStorage.setItem(reviewerKey, reviewerId);
const list = document.querySelector("#candidateList");
const message = document.querySelector("#message");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
const reviewFor = (candidate) => ({ relevant: candidate.myRelevant, tags: parseTags(candidate.myTags), note: candidate.myNote || "" });
const parseTags = (value) => { try { return Array.isArray(value) ? value : JSON.parse(value || "[]"); } catch { return []; } };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
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
    const matchesQuery = !state.query || text.includes(state.query);
    const reviewed = candidate.myRelevant !== null && candidate.myRelevant !== undefined;
    const matchesFilter = state.filter === "all" || (state.filter === "unreviewed" && !reviewed) || (state.filter === "relevant" && candidate.myRelevant === 1) || (state.filter === "not-relevant" && candidate.myRelevant === 0);
    return matchesQuery && matchesFilter;
  });
}

function render() {
  const candidates = filteredCandidates();
  document.querySelector("#reviewCount").textContent = `${state.candidates.filter((candidate) => candidate.myRelevant !== null && candidate.myRelevant !== undefined).length} reviewed`;
  if (!candidates.length) { list.innerHTML = '<div class="empty">No candidates match the current filter.</div>'; return; }
  list.innerHTML = candidates.map((candidate) => {
    const review = reviewFor(candidate);
    const reviewedClass = review.relevant !== null && review.relevant !== undefined ? "reviewed" : "";
    return `<article class="card ${reviewedClass}" data-id="${escapeHtml(candidate.id)}">
      <div class="card-head"><div>
        <h2><span>${escapeHtml(candidate.id)}</span><small>${escapeHtml(candidate.collection)} · ${escapeHtml(candidate.reference)}</small></h2>
        <blockquote>${escapeHtml(candidate.translatedText)}</blockquote>
        <div class="source-line"><span>${escapeHtml(candidate.grading)}</span> · <a href="${escapeHtml(candidate.sourceUrl)}" target="_blank" rel="noopener">Open source</a> · <span>${candidate.relevantCount || 0} relevant / ${candidate.notRelevantCount || 0} not relevant</span></div>
      </div></div>
      <div class="relevance" role="group" aria-label="Relevance for ${escapeHtml(candidate.id)}">
        <button data-action="relevance" data-value="true" class="${review.relevant === 1 ? "active-yes" : ""}">Relevant</button>
        <button data-action="relevance" data-value="false" class="${review.relevant === 0 ? "active-no" : ""}">Not relevant</button>
      </div>
      <div class="details">
        <label>Choose tags <span class="tag-grid">${TAGS.map((tag) => `<label class="tag-option"><input type="checkbox" data-action="tag" value="${tag}" ${review.tags.includes(tag) ? "checked" : ""} /><span>${tag}</span></label>`).join("")}</span></label>
        <label>Review note <textarea data-action="note" placeholder="Add context for moderators or the scholarly reviewer">${escapeHtml(review.note)}</textarea></label>
      </div>
      <details class="report"><summary>Report a source, translation, duplicate, or context problem</summary><div class="report-form"><label>Issue <select data-action="report-type"><option value="incorrect-source">Incorrect source</option><option value="translation">Translation problem</option><option value="duplicate">Possible duplicate</option><option value="context">Needs context</option><option value="other">Other</option></select></label><textarea data-action="report-note" placeholder="What should the review team check?"></textarea><button class="button secondary" data-action="report">Submit report</button></div></details>
    </article>`;
  }).join("");
}

async function saveReview(card) {
  const candidate = state.candidates.find((item) => item.id === card.dataset.id);
  const relevantButton = card.querySelector("button.active-yes, button.active-no");
  const tags = [...card.querySelectorAll('input[data-action="tag"]:checked')].map((input) => input.value);
  const note = card.querySelector('[data-action="note"]').value;
  if (!relevantButton) return;
  await api("/api/reviews", { method: "POST", body: JSON.stringify({ candidateId: candidate.id, reviewerId, relevant: relevantButton.dataset.value === "true", tags, note }) });
  candidate.myRelevant = relevantButton.dataset.value === "true" ? 1 : 0;
  candidate.myTags = JSON.stringify(tags);
  candidate.myNote = note;
  showMessage("Review saved.");
  render();
}

async function load() {
  try {
    const data = await api("/api/candidates");
    state.candidates = data.candidates || [];
    document.querySelector("#reviewerStatus").textContent = "Your private browser review session is active";
    showMessage(state.candidates.length ? "" : "No candidates have been seeded yet. Ask an administrator to import them into D1.");
    render();
  } catch (error) { showMessage(error.message, true); list.innerHTML = ""; }
}

list.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".card");
  if (button.dataset.action === "relevance") {
    card.querySelectorAll('button[data-action="relevance"]').forEach((item) => item.classList.remove("active-yes", "active-no"));
    button.classList.add(button.dataset.value === "true" ? "active-yes" : "active-no");
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
  try { await saveReview(card); } catch (error) { showMessage(error.message, true); }
});

list.addEventListener("blur", async (event) => {
  if (!event.target.matches('textarea[data-action="note"]')) return;
  const card = event.target.closest(".card");
  try { await saveReview(card); } catch (error) { showMessage(error.message, true); }
}, true);

document.querySelector("#search").addEventListener("input", (event) => { state.query = event.target.value.toLowerCase(); render(); });
document.querySelector("#filter").addEventListener("change", (event) => { state.filter = event.target.value; render(); });
document.querySelector("#refresh").addEventListener("click", load);
load();
