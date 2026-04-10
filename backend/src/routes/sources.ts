import { Router } from "express";
import { pool } from "../db/pool.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const sourcesRouter = Router();

sourcesRouter.get("/:id", async (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid source id" });
  }
  try {
    const result = await pool.query(
      `
      SELECT
        s.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', i.id, 'title', i.title))
           FROM incident_sources isrc
           JOIN incidents i ON i.id = isrc.incident_id
           WHERE isrc.source_id = s.id),
          '[]'::json
        ) AS linked_incidents
      FROM sources s
      WHERE s.id = $1
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Source not found" });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});
