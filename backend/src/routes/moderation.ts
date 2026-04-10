import { randomUUID } from "node:crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const queueQuerySchema = z.object({
  status: z.enum(["pending", "verified", "rejected"]).optional().default("pending"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursorOccurredAt: z.string().datetime().optional(),
  cursorId: z.string().uuid().optional()
});

const decisionBodySchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional()
});

const mergeBodySchema = z.object({
  sourceIncidentId: z.string().uuid(),
  targetIncidentId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000).optional()
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireAdmin(req: Request, res: Response): boolean {
  const role = req.user?.role;
  if (role !== "admin" && role !== "moderator") {
    res.status(403).json({ error: "Forbidden. Moderator or admin role required." });
    return false;
  }
  return true;
}

function requireModeratorId(req: Request, res: Response): string | null {
  const moderatorId = req.user?.id;
  if (!moderatorId) {
    res.status(400).json({ error: "x-user-id header is required for moderation actions" });
    return null;
  }
  return moderatorId;
}

export const moderationRouter = Router();

moderationRouter.get("/queue", async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsed = queueQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
    }

    const { status, limit, cursorOccurredAt, cursorId } = parsed.data;
    if ((cursorOccurredAt && !cursorId) || (!cursorOccurredAt && cursorId)) {
      return res.status(400).json({
        error: "cursorOccurredAt and cursorId must be provided together"
      });
    }

    const values: Array<string | number> = [status];
    const where = ["i.verification_status = $1"];

    if (cursorOccurredAt && cursorId) {
      values.push(cursorOccurredAt);
      values.push(cursorId);
      where.push(`(i.occurred_at, i.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
    }

    values.push(limit + 1);

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.title,
        i.occurred_at,
        i.country_code,
        i.country_name,
        i.incident_category,
        i.confidence_level,
        i.verification_status,
        i.created_at,
        COUNT(isrc.source_id)::int AS source_count
      FROM incidents i
      LEFT JOIN incident_sources isrc ON isrc.incident_id = i.id
      WHERE ${where.join(" AND ")}
      GROUP BY i.id
      ORDER BY i.occurred_at DESC, i.id DESC
      LIMIT $${values.length}
      `,
      values
    );

    const hasMore = result.rows.length > limit;
    const data = hasMore ? result.rows.slice(0, limit) : result.rows;
    const lastItem = data[data.length - 1] as { id: string; occurred_at: string } | undefined;

    return res.json({
      data,
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore && lastItem ? { cursorOccurredAt: lastItem.occurred_at, cursorId: lastItem.id } : null
      }
    });
  } catch (error) {
    return next(error);
  }
});

moderationRouter.post("/incidents/:id/verify", async (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid incident id" });
  }
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsedBody = decisionBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsedBody.error.flatten() });
    }

    const moderatorId = requireModeratorId(req, res);
    if (!moderatorId) {
      return;
    }
    const { reason } = parsedBody.data;

    const current = await pool.query(
      "SELECT verification_status FROM incidents WHERE id = $1",
      [req.params.id]
    );
    if (current.rowCount === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const previousStatus = (current.rows[0] as { verification_status: string }).verification_status;
    if (previousStatus === "verified") {
      return res.status(409).json({ error: "Incident is already verified" });
    }

    const update = await pool.query(
      `
      UPDATE incidents
      SET verification_status = 'verified', updated_at = now()
      WHERE id = $1
      RETURNING id, verification_status, updated_at
      `,
      [req.params.id]
    );

    await pool.query(
      `
      INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action_type, reason, metadata)
      VALUES ($1, $2, 'incident', $3, 'verify', $4, $5::jsonb)
      `,
      [
        randomUUID(),
        moderatorId,
        req.params.id,
        reason ?? null,
        JSON.stringify({ previous_status: previousStatus, new_status: "verified" })
      ]
    );

    return res.json({ data: update.rows[0] });
  } catch (error) {
    return next(error);
  }
});

moderationRouter.post("/incidents/:id/reject", async (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid incident id" });
  }
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsedBody = decisionBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsedBody.error.flatten() });
    }

    const moderatorId = requireModeratorId(req, res);
    if (!moderatorId) {
      return;
    }
    const { reason } = parsedBody.data;

    const current = await pool.query(
      "SELECT verification_status FROM incidents WHERE id = $1",
      [req.params.id]
    );
    if (current.rowCount === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const previousStatus = (current.rows[0] as { verification_status: string }).verification_status;
    if (previousStatus === "rejected") {
      return res.status(409).json({ error: "Incident is already rejected" });
    }

    const update = await pool.query(
      `
      UPDATE incidents
      SET verification_status = 'rejected', updated_at = now()
      WHERE id = $1
      RETURNING id, verification_status, updated_at
      `,
      [req.params.id]
    );

    await pool.query(
      `
      INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action_type, reason, metadata)
      VALUES ($1, $2, 'incident', $3, 'reject', $4, $5::jsonb)
      `,
      [
        randomUUID(),
        moderatorId,
        req.params.id,
        reason ?? null,
        JSON.stringify({ previous_status: previousStatus, new_status: "rejected" })
      ]
    );

    return res.json({ data: update.rows[0] });
  } catch (error) {
    return next(error);
  }
});

moderationRouter.post("/incidents/merge", async (req, res, next) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsedBody = mergeBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsedBody.error.flatten() });
    }

    const moderatorId = requireModeratorId(req, res);
    if (!moderatorId) {
      return;
    }

    const { sourceIncidentId, targetIncidentId, reason } = parsedBody.data;

    if (sourceIncidentId === targetIncidentId) {
      return res.status(400).json({ error: "sourceIncidentId and targetIncidentId must be different" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const targetExists = await client.query("SELECT id FROM incidents WHERE id = $1", [targetIncidentId]);
    if (targetExists.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Target incident not found" });
    }

    const sourceExists = await client.query("SELECT id FROM incidents WHERE id = $1", [sourceIncidentId]);
    if (sourceExists.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Source incident not found" });
    }

    await client.query(
      `
      INSERT INTO incident_sources (incident_id, source_id, relevance_score, extraction_model, extraction_version)
      SELECT $1, source_id, relevance_score, extraction_model, extraction_version
      FROM incident_sources
      WHERE incident_id = $2
      ON CONFLICT (incident_id, source_id)
      DO NOTHING
      `,
      [targetIncidentId, sourceIncidentId]
    );

    await client.query("DELETE FROM incident_sources WHERE incident_id = $1", [sourceIncidentId]);
    await client.query("DELETE FROM incidents WHERE id = $1", [sourceIncidentId]);

    await client.query(
      `
      INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action_type, reason, metadata)
      VALUES ($1, $2, 'incident', $3, 'merge', $4, $5::jsonb)
      `,
      [
        randomUUID(),
        moderatorId,
        targetIncidentId,
        reason ?? null,
        JSON.stringify({ merged_from: sourceIncidentId, merged_into: targetIncidentId })
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({ data: { mergedFrom: sourceIncidentId, mergedInto: targetIncidentId } });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    return next(error);
  } finally {
    client.release();
  }
});
