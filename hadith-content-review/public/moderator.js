const tokenKey = "sujud-moderator-token";
const state = { candidates: [], query: "", status: "all", selected: new Set() };
const elements = {
  authForm: document.querySelector("#authForm"), token: document.querySelector("#token"), dashboard: document.querySelector("#dashboard"),
  message: document.querySelector("#message"), search: document.querySelector("#search"), status: document.querySelector("#statusFilter"),
  list: document.querySelector("#candidateList"), stats: document.querySelector("#stats"), selectAll: document.querySelector("#selectAll"), bulkStatus: document.querySelector("#bulkStatus"), bulkSave: document.querySelector("#bulkSave"),
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
const savedToken = sessionStorage.getItem(tokenKey);
if (savedToken) elements.token.value = savedToken;

function showMessage(text, error = false) { elements.message.hidden = !text; elements.message.textContent = text; elements.message.style.color = error ? "var(--danger)" : "var(--warning)"; }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "content-type": "application/json", authorization: `Bearer ${sessionStorage.getItem(tokenKey) || elements.token.value}`, ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
function visibleCandidates() {
  return state.candidates.filter((candidate) => {
    const haystack = [candidate.id, candidate.collection, candidate.reference, candidate.translatedText].join(" ").toLowerCase();
    const hasCommunityReviews = candidate.reviews.length > 0;
    const matchesStatus = state.status === "all" ||
      (state.status === "community-reviewed" ? hasCommunityReviews : candidate.status === state.status);
    return (!state.query || haystack.includes(state.query)) && matchesStatus;
  });
}
function render() {
  const visible = visibleCandidates();
  const counts = state.candidates.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
  const communityReviewedCount = state.candidates.filter((candidate) => candidate.reviews.length > 0).length;
  elements.stats.innerHTML = `<span>Total: <strong>${state.candidates.length}</strong></span><span>Community reviewed: <strong>${communityReviewedCount}</strong></span><span>Workflow: community review <strong>${counts["community-review"] || 0}</strong></span><span>Needs moderation: <strong>${counts["needs-moderation"] || 0}</strong></span><span>Approved: <strong>${counts.approved || 0}</strong></span><span>Rejected: <strong>${counts.rejected || 0}</strong></span>`;
  if (!visible.length) { elements.list.innerHTML = '<div class="moderator-empty">No candidates match the current filters.</div>'; return; }
  elements.list.innerHTML = visible.map((candidate) => {
    const relevant = candidate.reviews.filter((review) => review.relevant === 1).length;
    const notRelevant = candidate.reviews.filter((review) => review.relevant === 0).length;
    const tags = [...new Set(candidate.reviews.flatMap((review) => review.tags || []))];
    return `<article class="moderator-card" data-id="${escapeHtml(candidate.id)}"><input class="moderator-select" data-action="select" type="checkbox" ${state.selected.has(candidate.id) ? "checked" : ""} aria-label="Select ${escapeHtml(candidate.id)}" /><h2>${escapeHtml(candidate.id)} · ${escapeHtml(candidate.collection)} · ${escapeHtml(candidate.reference)}</h2><blockquote>${escapeHtml(candidate.translatedText)}</blockquote><div class="moderator-meta"><span>${escapeHtml(candidate.grading)}</span><span>${relevant} relevant / ${notRelevant} not relevant</span><a href="${escapeHtml(candidate.sourceUrl)}" target="_blank" rel="noopener">Open source</a><span>Suggested tags: ${escapeHtml(tags.join(", ") || "none")}</span></div><div class="moderator-actions"><label>Status<select data-action="status"><option value="community-review" ${candidate.status === "community-review" ? "selected" : ""}>Community review</option><option value="needs-moderation" ${candidate.status === "needs-moderation" ? "selected" : ""}>Needs moderation</option><option value="approved" ${candidate.status === "approved" ? "selected" : ""}>Approved</option><option value="rejected" ${candidate.status === "rejected" ? "selected" : ""}>Rejected</option></select></label><button class="button secondary" data-action="save-status" type="button">Save status</button></div><div class="review-list">${candidate.reviews.length ? candidate.reviews.map((review) => `<div class="review-entry"><strong>${review.relevant === 1 ? "Relevant" : "Not relevant"}</strong> · tags: ${escapeHtml((review.tags || []).join(", ") || "none")} ${review.note ? `<br />${escapeHtml(review.note)}` : ""}</div>`).join("") : '<div class="review-entry">No community reviews yet.</div>'}</div>${candidate.reports.length ? `<div class="review-entry" style="margin-top:12px;color:var(--danger)"><strong>Reports: ${candidate.reports.length}</strong> ${escapeHtml(candidate.reports.map((report) => report.reportType).join(", "))}</div>` : ""}</article>`;
  }).join("");
  updateBulkControls(visible);
}
function updateBulkControls(visible = visibleCandidates()) {
  const ids = visible.map((candidate) => candidate.id);
  for (const selectedId of state.selected) {
    if (!state.candidates.some((candidate) => candidate.id === selectedId)) state.selected.delete(selectedId);
  }
  elements.selectAll.checked = ids.length > 0 && ids.every((id) => state.selected.has(id));
  elements.bulkSave.disabled = state.selected.size === 0;
  elements.bulkSave.textContent = state.selected.size ? `Mass save selected (${state.selected.size})` : "Mass save selected";
}
async function load() { try { const data = await api("/api/moderator/candidates"); state.candidates = data.candidates || []; elements.dashboard.hidden = false; showMessage(""); render(); } catch (error) { showMessage(error.message, true); } }

elements.authForm.addEventListener("submit", async (event) => { event.preventDefault(); sessionStorage.setItem(tokenKey, elements.token.value); await load(); });
elements.search.addEventListener("input", (event) => { state.query = event.target.value.toLowerCase(); render(); });
elements.status.addEventListener("change", (event) => { state.status = event.target.value; render(); });
document.querySelector("#refresh").addEventListener("click", load);
document.querySelector("#export").addEventListener("click", async () => { try { const data = await api("/api/moderator/export"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" })); link.download = "islamicContent.approved.json"; link.click(); showMessage("Approved content exported."); } catch (error) { showMessage(error.message, true); } });
elements.list.addEventListener("change", (event) => { if (!event.target.matches('[data-action="select"]')) return; const id = event.target.closest("[data-id]").dataset.id; if (event.target.checked) state.selected.add(id); else state.selected.delete(id); updateBulkControls(); });
elements.list.addEventListener("click", async (event) => { const button = event.target.closest('[data-action="save-status"]'); if (!button) return; const card = button.closest("[data-id]"); const status = card.querySelector('[data-action="status"]').value; try { await api(`/api/moderator/candidates/${encodeURIComponent(card.dataset.id)}`, { method: "PATCH", body: JSON.stringify({ status }) }); state.selected.delete(card.dataset.id); showMessage("Candidate status saved."); await load(); } catch (error) { showMessage(error.message, true); } });
elements.selectAll.addEventListener("change", () => { visibleCandidates().forEach((candidate) => elements.selectAll.checked ? state.selected.add(candidate.id) : state.selected.delete(candidate.id)); render(); });
elements.bulkSave.addEventListener("click", async () => { try { const ids = [...state.selected]; const result = await api("/api/moderator/candidates/bulk-status", { method: "PATCH", body: JSON.stringify({ candidateIds: ids, status: elements.bulkStatus.value }) }); state.selected.clear(); showMessage(`${result.updated} candidates updated.`); await load(); } catch (error) { showMessage(error.message, true); } });
if (savedToken) load();
