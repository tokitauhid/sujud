const TAGS = [
  "consistency",
  "patience",
  "good-deeds",
  "prayer",
  "jamaah",
  "returning-after-difficulty",
  "time-and-prayer",
  "hope",
  "general",
  "not-relevant",
  "needs-context",
  "possible-duplicate",
  "translation-review",
] as const;

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  MODERATOR_TOKEN?: string;
};

type ReviewPayload = {
  candidateId?: unknown;
  reviewerId?: unknown;
  relevant?: unknown;
  tags?: unknown;
  note?: unknown;
};

type ReportPayload = {
  candidateId?: unknown;
  reviewerId?: unknown;
  reportType?: unknown;
  note?: unknown;
};

type StatusPayload = {
  status?: unknown;
};

type BulkStatusPayload = {
  candidateIds?: unknown;
  status?: unknown;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });

const readJson = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
};

const isSafeText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string =>
    typeof tag === "string" && (TAGS as readonly string[]).includes(tag),
  ))];
};

const moderatorAuthorized = (request: Request, env: Env): boolean => {
  const configuredToken = env.MODERATOR_TOKEN;
  if (!configuredToken) return false;
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : request.headers.get("x-moderator-token") || "";
  return suppliedToken === configuredToken;
};

const moderatorGuard = (request: Request, env: Env): Response | null => {
  if (!env.MODERATOR_TOKEN) return json({ error: "Moderator access is not configured" }, 503);
  if (!moderatorAuthorized(request, env)) return json({ error: "Moderator authentication required" }, 401);
  return null;
};

async function listCandidates(request: Request, env: Env) {
  const reviewerId = request.headers.get("x-reviewer-id") || "";
  const result = await env.DB.prepare(
    `SELECT c.id, c.translated_text AS translatedText, c.arabic_text AS arabicText,
      c.collection, c.reference, c.grading, c.source_url AS sourceUrl, c.status,
      COALESCE(SUM(CASE WHEN r.relevant = 1 THEN 1 ELSE 0 END), 0) AS relevantCount,
      COALESCE(SUM(CASE WHEN r.relevant = 0 THEN 1 ELSE 0 END), 0) AS notRelevantCount,
      CASE WHEN COUNT(r.candidate_id) > 0 THEN 1 ELSE 0 END AS communityReviewed,
      ur.relevant AS myRelevant, ur.tags_json AS myTags, ur.note AS myNote
    FROM candidates c
    LEFT JOIN reviews r ON r.candidate_id = c.id
    LEFT JOIN reviews ur ON ur.candidate_id = c.id AND ur.reviewer_id = ?
    WHERE c.status IN ('community-review', 'needs-moderation', 'approved')
    GROUP BY c.id
    ORDER BY c.created_at DESC, c.id ASC`,
  ).bind(reviewerId).all();

  return json({ tags: TAGS, candidates: result.results });
}

async function saveReview(request: Request, env: Env) {
  const payload = await readJson<ReviewPayload>(request);
  const candidateId = payload.candidateId;
  const reviewerId = payload.reviewerId;
  const relevant = payload.relevant;
  const tags = normalizeTags(payload.tags);
  const note = typeof payload.note === "string" ? payload.note.trim() : "";

  if (!isSafeText(candidateId, 160) || !isSafeText(reviewerId, 160)) {
    return json({ error: "candidateId and reviewerId are required" }, 400);
  }
  if (typeof relevant !== "boolean") return json({ error: "relevant must be boolean" }, 400);
  if (note.length > 2000) return json({ error: "note is too long" }, 400);

  const candidate = await env.DB.prepare("SELECT id FROM candidates WHERE id = ?")
    .bind(candidateId).first();
  if (!candidate) return json({ error: "Candidate not found" }, 404);

  await env.DB.prepare(
    `INSERT INTO reviews (candidate_id, reviewer_id, relevant, tags_json, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(candidate_id, reviewer_id) DO UPDATE SET
       relevant = excluded.relevant,
       tags_json = excluded.tags_json,
       note = excluded.note,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(candidateId, reviewerId, relevant ? 1 : 0, JSON.stringify(tags), note).run();

  return json({ ok: true });
}

async function saveReport(request: Request, env: Env) {
  const payload = await readJson<ReportPayload>(request);
  const candidateId = payload.candidateId;
  const reviewerId = payload.reviewerId;
  const reportType = payload.reportType;
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  const allowedReports = ["incorrect-source", "translation", "duplicate", "context", "other"];

  if (!isSafeText(candidateId, 160) || !isSafeText(reviewerId, 160)) {
    return json({ error: "candidateId and reviewerId are required" }, 400);
  }
  if (typeof reportType !== "string" || !allowedReports.includes(reportType)) {
    return json({ error: "Invalid report type" }, 400);
  }
  if (note.length > 2000) return json({ error: "note is too long" }, 400);

  await env.DB.prepare(
    `INSERT INTO reports (candidate_id, reviewer_id, report_type, note) VALUES (?, ?, ?, ?)`,
  ).bind(candidateId, reviewerId, reportType, note).run();

  return json({ ok: true });
}

async function listModeratorCandidates(request: Request, env: Env) {
  const denied = moderatorGuard(request, env);
  if (denied) return denied;

  const candidates = await env.DB.prepare(
    `SELECT id, translated_text AS translatedText, arabic_text AS arabicText,
      collection, reference, grading, source_url AS sourceUrl, status,
      created_at AS createdAt, updated_at AS updatedAt
     FROM candidates ORDER BY created_at DESC, id ASC`,
  ).all();
  const reviews = await env.DB.prepare(
    `SELECT candidate_id AS candidateId, reviewer_id AS reviewerId,
      relevant, tags_json AS tagsJson, note, created_at AS createdAt, updated_at AS updatedAt
     FROM reviews ORDER BY updated_at DESC`,
  ).all();
  const reports = await env.DB.prepare(
    `SELECT candidate_id AS candidateId, report_type AS reportType, note,
      created_at AS createdAt, resolved_at AS resolvedAt
     FROM reports ORDER BY created_at DESC`,
  ).all();

  const reviewsByCandidate = new Map<string, unknown[]>();
  for (const review of reviews.results) {
    const item = review as { candidateId: string };
    const current = reviewsByCandidate.get(item.candidateId) || [];
    current.push({ ...review, tags: parseStoredTags((review as { tagsJson?: string }).tagsJson) });
    reviewsByCandidate.set(item.candidateId, current);
  }
  const reportsByCandidate = new Map<string, unknown[]>();
  for (const report of reports.results) {
    const item = report as { candidateId: string };
    const current = reportsByCandidate.get(item.candidateId) || [];
    current.push(report);
    reportsByCandidate.set(item.candidateId, current);
  }

  return json({
    candidates: candidates.results.map((candidate) => {
      const item = candidate as { id: string };
      return {
        ...candidate,
        reviews: reviewsByCandidate.get(item.id) || [],
        reports: reportsByCandidate.get(item.id) || [],
      };
    }),
  });
}

const parseStoredTags = (value: unknown): string[] => {
  try {
    const parsed = JSON.parse(typeof value === "string" ? value : "[]");
    return normalizeTags(parsed);
  } catch {
    return [];
  }
};

async function updateCandidateStatus(request: Request, env: Env, candidateId: string) {
  const denied = moderatorGuard(request, env);
  if (denied) return denied;
  const payload = await readJson<StatusPayload>(request);
  const allowedStatuses = ["community-review", "needs-moderation", "approved", "rejected"];
  if (typeof payload.status !== "string" || !allowedStatuses.includes(payload.status)) {
    return json({ error: "Invalid candidate status" }, 400);
  }
  const result = await env.DB.prepare(
    "UPDATE candidates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).bind(payload.status, candidateId).run();
  if (!result.meta.changes) return json({ error: "Candidate not found" }, 404);
  return json({ ok: true, status: payload.status });
}

async function updateCandidateStatuses(request: Request, env: Env) {
  const denied = moderatorGuard(request, env);
  if (denied) return denied;
  const payload = await readJson<BulkStatusPayload>(request);
  const allowedStatuses = ["community-review", "needs-moderation", "approved", "rejected"];
  const candidateIds = Array.isArray(payload.candidateIds)
    ? [...new Set(payload.candidateIds.filter((id): id is string => isSafeText(id, 160)))]
    : [];
  if (!candidateIds.length || typeof payload.status !== "string" || !allowedStatuses.includes(payload.status)) {
    return json({ error: "candidateIds and a valid status are required" }, 400);
  }

  const statements = candidateIds.map((candidateId) =>
    env.DB.prepare(
      "UPDATE candidates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(payload.status, candidateId),
  );
  const results = await env.DB.batch(statements);
  const updated = results.reduce((total, result) => total + (result.meta.changes || 0), 0);
  return json({ ok: true, requested: candidateIds.length, updated, status: payload.status });
}

async function exportApprovedCandidates(request: Request, env: Env) {
  const denied = moderatorGuard(request, env);
  if (denied) return denied;
  const candidates = await env.DB.prepare(
    `SELECT id, translated_text AS translatedText, arabic_text AS arabicText,
      collection, reference, grading, source_url AS sourceUrl, status
     FROM candidates WHERE status = 'approved' ORDER BY id ASC`,
  ).all();
  const reviews = await env.DB.prepare(
    "SELECT candidate_id AS candidateId, tags_json AS tagsJson, note FROM reviews",
  ).all();
  const reviewData = new Map<string, { tags: Set<string>; notes: string[] }>();
  for (const review of reviews.results) {
    const item = review as { candidateId: string; tagsJson?: string; note?: string };
    const current = reviewData.get(item.candidateId) || { tags: new Set<string>(), notes: [] };
    parseStoredTags(item.tagsJson).forEach((tag) => current.tags.add(tag));
    if (item.note) current.notes.push(item.note);
    reviewData.set(item.candidateId, current);
  }
  return json(candidates.results.map((candidate) => {
    const item = candidate as { id: string };
    const data = reviewData.get(item.id) || { tags: new Set<string>(), notes: [] };
    return {
      ...candidate,
      type: "hadith",
      language: "en",
      tags: [...data.tags],
      reviewed: true,
      licenseNote: "Moderator must verify translation redistribution permission before production use.",
      reviewNotes: data.notes,
    };
  }));
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/api/tags" && request.method === "GET") return json({ tags: TAGS });
  if (url.pathname === "/api/candidates" && request.method === "GET") return listCandidates(request, env);
  if (url.pathname === "/api/reviews" && request.method === "POST") return saveReview(request, env);
  if (url.pathname === "/api/reports" && request.method === "POST") return saveReport(request, env);
  if (url.pathname === "/api/moderator/candidates" && request.method === "GET") return listModeratorCandidates(request, env);
  if (url.pathname === "/api/moderator/candidates/bulk-status" && request.method === "PATCH") return updateCandidateStatuses(request, env);
  if (url.pathname === "/api/moderator/export" && request.method === "GET") return exportApprovedCandidates(request, env);
  if (url.pathname.startsWith("/api/moderator/candidates/") && request.method === "PATCH") {
    return updateCandidateStatus(request, env, decodeURIComponent(url.pathname.split("/").pop() || ""));
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env);
      } catch (error) {
        console.error(error);
        return json({ error: error instanceof Error ? error.message : "Request failed" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
