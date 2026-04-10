import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
const timeseriesSchema = z.object({
    countryCode: z.string().length(2).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional()
});
export const analyticsRouter = Router();
analyticsRouter.get("/timeseries", async (req, res, next) => {
    try {
        const parsed = timeseriesSchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
        }
        const { countryCode, dateFrom, dateTo } = parsed.data;
        const values = [];
        const where = [];
        if (countryCode) {
            values.push(countryCode.toUpperCase());
            where.push(`country_code = $${values.length}`);
        }
        if (dateFrom) {
            values.push(dateFrom);
            where.push(`occurred_at >= $${values.length}`);
        }
        if (dateTo) {
            values.push(dateTo);
            where.push(`occurred_at <= $${values.length}`);
        }
        const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
        const result = await pool.query(`
      SELECT
        date_trunc('day', occurred_at) AS bucket,
        COUNT(*)::int AS incident_count,
        COALESCE(SUM(killed_count), 0)::int AS total_killed,
        COALESCE(SUM(injured_count), 0)::int AS total_injured
      FROM incidents
      ${whereClause}
      GROUP BY 1
      ORDER BY 1 ASC
      `, values);
        return res.json({ data: result.rows });
    }
    catch (error) {
        return next(error);
    }
});
analyticsRouter.get("/top-countries", async (_req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT
        country_code,
        country_name,
        COUNT(*)::int AS incident_count,
        COALESCE(SUM(killed_count), 0)::int AS total_killed,
        COALESCE(SUM(injured_count), 0)::int AS total_injured
      FROM incidents
      GROUP BY country_code, country_name
      ORDER BY incident_count DESC
      LIMIT 20
      `);
        return res.json({ data: result.rows });
    }
    catch (error) {
        return next(error);
    }
});
