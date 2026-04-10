import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const incidentsQuerySchema = z.object({
  countryCode: z.string().length(2).optional(),
  verificationStatus: z.enum(["pending", "verified", "rejected"]).optional(),
  category: z.string().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(100)
});

export const incidentsRouter = Router();

incidentsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = incidentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
    }

    const { countryCode, verificationStatus, category, dateFrom, dateTo, limit } = parsed.data;

    const values: Array<string | number> = [];
    const where: string[] = [];

    if (countryCode) {
      values.push(countryCode.toUpperCase());
      where.push(`country_code = $${values.length}`);
    }

    if (verificationStatus) {
      values.push(verificationStatus);
      where.push(`verification_status = $${values.length}`);
    }

    if (category) {
      values.push(category);
      where.push(`incident_category = $${values.length}`);
    }

    if (dateFrom) {
      values.push(dateFrom);
      where.push(`occurred_at >= $${values.length}`);
    }

    if (dateTo) {
      values.push(dateTo);
      where.push(`occurred_at <= $${values.length}`);
    }

    values.push(limit);
    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        id,
        title,
        occurred_at,
        country_code,
        country_name,
        city_name,
        incident_category,
        killed_count,
        injured_count,
        confidence_level,
        verification_status,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
      FROM incidents
      ${whereClause}
      ORDER BY occurred_at DESC
      LIMIT $${values.length}
    `;

    const result = await pool.query(query, values);
    return res.json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

incidentsRouter.get("/:id", async (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid incident id" });
  }
  try {
    const result = await pool.query(
      `
      SELECT
        i.*,
        ST_Y(i.location::geometry) AS latitude,
        ST_X(i.location::geometry) AS longitude,
        g.name AS suspected_group_name,
        (SELECT COUNT(*)::int FROM incident_sources isrc WHERE isrc.incident_id = i.id) AS source_count
      FROM incidents i
      LEFT JOIN groups g ON g.id = i.suspected_group_id
      WHERE i.id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});
