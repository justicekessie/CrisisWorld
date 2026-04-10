import { createHash, randomUUID } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { pool } from "../db/pool.js";
const COUNTRY_HINTS = [
    { code: "NG", name: "Nigeria", keywords: ["nigeria", "maiduguri", "borno", "abuja", "lagos"], center: [8.6753, 9.082] },
    { code: "IQ", name: "Iraq", keywords: ["iraq", "baghdad", "mosul", "basra"], center: [43.6793, 33.2232] },
    { code: "SO", name: "Somalia", keywords: ["somalia", "mogadishu"], center: [46.1996, 5.1521] },
    { code: "SY", name: "Syria", keywords: ["syria", "aleppo", "damascus", "idlib"], center: [38.9968, 34.8021] },
    { code: "AF", name: "Afghanistan", keywords: ["afghanistan", "kabul", "kandahar"], center: [67.7099, 33.9391] },
    { code: "UA", name: "Ukraine", keywords: ["ukraine", "kyiv", "kharkiv", "odesa"], center: [31.1656, 48.3794] },
    { code: "SD", name: "Sudan", keywords: ["sudan", "khartoum", "darfur"], center: [30.2176, 12.8628] },
    { code: "CD", name: "DR Congo", keywords: ["congo", "goma", "kinshasa", "kivu"], center: [21.7587, -4.0383] }
];
const CATEGORY_KEYWORDS = [
    {
        category: "bombing",
        attackType: "ied",
        targetType: "civilians",
        keywords: ["bomb", "blast", "explosion", "ied"]
    },
    {
        category: "armed_clash",
        attackType: "small_arms",
        targetType: "security_forces",
        keywords: ["clash", "gunfire", "firefight", "armed"]
    },
    {
        category: "terror_attack",
        attackType: "complex_attack",
        targetType: "mixed",
        keywords: ["attack", "assault", "militant", "insurgent", "extremist"]
    },
    {
        category: "kidnapping",
        attackType: "abduction",
        targetType: "civilians",
        keywords: ["kidnap", "abduct", "hostage"]
    }
];
function toArray(value) {
    if (!value) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}
function extractText(value) {
    if (typeof value === "string") {
        return value;
    }
    if (value && typeof value === "object" && "#text" in value) {
        const text = value["#text"];
        return typeof text === "string" ? text : "";
    }
    return "";
}
function parseDate(input) {
    if (!input) {
        return new Date();
    }
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? new Date() : d;
}
function parseCoordinates(item) {
    const georssPoint = extractText(item["georss:point"]);
    if (georssPoint) {
        const [latRaw, lonRaw] = georssPoint.trim().split(/\s+/);
        const latitude = Number(latRaw);
        const longitude = Number(lonRaw);
        if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
            return { latitude, longitude };
        }
    }
    const lat = Number(extractText(item["geo:lat"]));
    const lon = Number(extractText(item["geo:long"]) || extractText(item["geo:lon"]));
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        return { latitude: lat, longitude: lon };
    }
    return { latitude: null, longitude: null };
}
function classifyIncident(text) {
    const normalized = text.toLowerCase();
    for (const rule of CATEGORY_KEYWORDS) {
        if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
            return {
                category: rule.category,
                attackType: rule.attackType,
                targetType: rule.targetType
            };
        }
    }
    return {
        category: "political_violence",
        attackType: "unknown",
        targetType: "unknown"
    };
}
function inferCountry(text) {
    const normalized = text.toLowerCase();
    for (const hint of COUNTRY_HINTS) {
        if (hint.keywords.some((keyword) => normalized.includes(keyword))) {
            return { code: hint.code, name: hint.name, center: hint.center };
        }
    }
    return { code: "UN", name: "Unknown", center: [0, 0] };
}
async function parseFeed(feedUrl) {
    const response = await fetch(feedUrl, {
        signal: AbortSignal.timeout(15000),
        headers: {
            "User-Agent": "CrisisWorldIngestion/0.1"
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch feed ${feedUrl}. HTTP ${response.status}`);
    }
    const xml = await response.text();
    const parser = new XMLParser({
        ignoreAttributes: false,
        textNodeName: "#text",
        parseTagValue: false,
        trimValues: true
    });
    const parsed = parser.parse(xml);
    const rssItems = toArray(parsed.rss?.channel?.item).map((raw) => {
        const title = extractText(raw.title);
        const link = extractText(raw.link);
        const description = extractText(raw.description) || extractText(raw["content:encoded"]) || "";
        const publishedAt = parseDate(extractText(raw.pubDate) || extractText(raw.published) || extractText(raw.updated));
        const { latitude, longitude } = parseCoordinates(raw);
        return { title, link, publishedAt, description, latitude, longitude };
    });
    const atomItems = toArray(parsed.feed?.entry).map((raw) => {
        const title = extractText(raw.title);
        const linkObj = raw.link;
        const links = toArray(linkObj);
        const link = links.find((l) => typeof l?.["@_href"] === "string")?.["@_href"] ?? "";
        const description = extractText(raw.summary) || extractText(raw.content) || "";
        const publishedAt = parseDate(extractText(raw.published) || extractText(raw.updated));
        const { latitude, longitude } = parseCoordinates(raw);
        return { title, link, publishedAt, description, latitude, longitude };
    });
    return [...rssItems, ...atomItems].filter((item) => item.title && item.link);
}
async function upsertSource(feedUrl, item) {
    const contentHash = createHash("sha256")
        .update(`${item.title}|${item.link}|${item.publishedAt.toISOString()}`)
        .digest("hex");
    const sourceId = randomUUID();
    const provider = new URL(feedUrl).hostname;
    const result = await pool.query(`
    INSERT INTO sources (
      id,
      provider,
      source_type,
      title,
      url,
      published_at,
      raw_payload,
      content_hash,
      credibility_score
    )
    VALUES ($1, $2, 'media', $3, $4, $5, $6::jsonb, $7, 0.50)
    ON CONFLICT (content_hash)
    DO UPDATE SET
      title = EXCLUDED.title,
      published_at = EXCLUDED.published_at
    RETURNING id, xmax = 0 AS inserted
    `, [
        sourceId,
        provider,
        item.title,
        item.link,
        item.publishedAt.toISOString(),
        JSON.stringify({
            feed_url: feedUrl,
            title: item.title,
            link: item.link,
            description: item.description
        }),
        contentHash
    ]);
    return {
        sourceId: String(result.rows[0].id),
        inserted: Boolean(result.rows[0].inserted)
    };
}
async function findCandidateIncident(title, occurredAt, countryCode) {
    const result = await pool.query(`
    SELECT id
    FROM incidents
    WHERE country_code = $1
      AND occurred_at BETWEEN $2::timestamptz - interval '12 hours' AND $2::timestamptz + interval '12 hours'
      AND lower(title) = lower($3)
    ORDER BY occurred_at DESC
    LIMIT 1
    `, [countryCode, occurredAt.toISOString(), title]);
    return result.rowCount && result.rowCount > 0 ? String(result.rows[0].id) : null;
}
async function ensureIncidentAndLink(sourceId, item) {
    const combinedText = `${item.title} ${item.description}`;
    const country = inferCountry(combinedText);
    const incidentClass = classifyIncident(combinedText);
    const latitude = item.latitude ?? country.center[1];
    const longitude = item.longitude ?? country.center[0];
    let incidentId = await findCandidateIncident(item.title, item.publishedAt, country.code);
    if (!incidentId) {
        incidentId = randomUUID();
        await pool.query(`
      INSERT INTO incidents (
        id,
        title,
        description,
        occurred_at,
        country_code,
        country_name,
        location,
        incident_category,
        attack_type,
        target_type,
        confidence_level,
        verification_status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
        $9,
        $10,
        $11,
        2,
        'pending'
      )
      `, [
            incidentId,
            item.title,
            item.description.slice(0, 6000),
            item.publishedAt.toISOString(),
            country.code,
            country.name,
            longitude,
            latitude,
            incidentClass.category,
            incidentClass.attackType,
            incidentClass.targetType
        ]);
    }
    await pool.query(`
    INSERT INTO incident_sources (incident_id, source_id, relevance_score, extraction_model, extraction_version)
    VALUES ($1, $2, 0.7, 'rss-normalizer', 'v1')
    ON CONFLICT (incident_id, source_id)
    DO NOTHING
    `, [incidentId, sourceId]);
    return true;
}
export async function ingestFeed(feedUrl) {
    const items = await parseFeed(feedUrl);
    let insertedSources = 0;
    let linkedIncidents = 0;
    for (const item of items) {
        const source = await upsertSource(feedUrl, item);
        if (source.inserted) {
            insertedSources += 1;
        }
        const linked = await ensureIncidentAndLink(source.sourceId, item);
        if (linked) {
            linkedIncidents += 1;
        }
    }
    return {
        feedUrl,
        fetched: items.length,
        insertedSources,
        linkedIncidents
    };
}
