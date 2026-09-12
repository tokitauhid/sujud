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

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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

async function listCandidates(request: Request, env: Env) {
  const reviewerId = request.headers.get("x-reviewer-id") || "";
  const result = await env.DB.prepare(
    `SELECT c.id, c.translated_text AS translatedText, c.arabic_text AS arabicText,
      c.collection, c.reference, c.grading, c.source_url AS sourceUrl, c.status,
      COALESCE(SUM(CASE WHEN r.relevant = 1 THEN 1 ELSE 0 END), 0) AS relevantCount,
      COALESCE(SUM(CASE WHEN r.relevant = 0 THEN 1 ELSE 0 END), 0) AS notRelevantCount,
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
  const payload = await readJson<ReportPayload>();
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

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/api/tags" && request.method === "GET") return json({ tags: TAGS });
  if (url.pathname === "/api/candidates" && request.method === "GET") return listCandidates(request, env);
  if (url.pathname === "/api/reviews" && request.method === "POST") return saveReview(request, env);
  if (url.pathname === "/api/reports" && request.method === "POST") return saveReport(request, env);
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
