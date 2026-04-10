import { createHash, randomUUID } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { pool } from "../db/pool.js";

type FeedItem = {
  title: string;
  link: string;
  publishedAt: Date;
  description: string;
  latitude: number | null;
  longitude: number | null;
};

type FeedIngestResult = {
  feedUrl: string;
  fetched: number;
  insertedSources: number;
  linkedIncidents: number;
};

const COUNTRY_HINTS: Array<{ code: string; name: string; keywords: string[]; center: [number, number] }> = [
  // Africa
  { code: "NG", name: "Nigeria", keywords: ["nigeria", "maiduguri", "borno", "abuja", "lagos", "kano", "zamfara"], center: [8.6753, 9.082] },
  { code: "SO", name: "Somalia", keywords: ["somalia", "mogadishu", "al-shabaab", "al shabaab", "puntland", "jubbaland"], center: [46.1996, 5.1521] },
  { code: "SD", name: "Sudan", keywords: ["sudan", "khartoum", "darfur", "rsf", "rapid support forces", "el fasher"], center: [30.2176, 12.8628] },
  { code: "SS", name: "South Sudan", keywords: ["south sudan", "juba", "bentiu", "malakal"], center: [31.307, 6.877] },
  { code: "ET", name: "Ethiopia", keywords: ["ethiopia", "tigray", "addis ababa", "amhara", "oromia", "afar", "tplf"], center: [40.489, 9.145] },
  { code: "ML", name: "Mali", keywords: ["mali", "bamako", "timbuktu", "gao", "mopti", "kidal"], center: [-3.996, 17.570] },
  { code: "BF", name: "Burkina Faso", keywords: ["burkina faso", "ouagadougou", "burkina", "jnim"], center: [-1.561, 12.364] },
  { code: "NE", name: "Niger", keywords: ["niger", "niamey", "diffa", "agadez"], center: [8.082, 17.607] },
  { code: "CM", name: "Cameroon", keywords: ["cameroon", "yaounde", "douala", "anglophone cameroon", "ambazonia"], center: [12.354, 5.396] },
  { code: "CF", name: "Central African Republic", keywords: ["central african republic", "bangui", "car rebels", "seleka"], center: [20.940, 6.612] },
  { code: "CD", name: "DR Congo", keywords: ["congo", "democratic republic of congo", "drc", "goma", "kinshasa", "kivu", "m23", "ituri"], center: [21.7587, -4.0383] },
  { code: "LY", name: "Libya", keywords: ["libya", "tripoli", "benghazi", "sirte", "misrata"], center: [17.228, 26.335] },
  { code: "EG", name: "Egypt", keywords: ["egypt", "cairo", "sinai", "alexandria", "north sinai"], center: [30.802, 26.820] },
  { code: "MZ", name: "Mozambique", keywords: ["mozambique", "cabo delgado", "mocimboa", "pemba", "ansar al-sunna"], center: [35.730, -17.269] },
  { code: "KE", name: "Kenya", keywords: ["kenya", "nairobi", "mombasa", "garissa", "lamu"], center: [37.906, 0.023] },
  { code: "ZW", name: "Zimbabwe", keywords: ["zimbabwe", "harare", "bulawayo"], center: [29.919, -20.013] },
  // Middle East
  { code: "IQ", name: "Iraq", keywords: ["iraq", "baghdad", "mosul", "basra", "kirkuk", "anbar", "isis iraq"], center: [43.6793, 33.2232] },
  { code: "SY", name: "Syria", keywords: ["syria", "aleppo", "damascus", "idlib", "deir ez-zor", "hama", "homs"], center: [38.9968, 34.8021] },
  { code: "YE", name: "Yemen", keywords: ["yemen", "sanaa", "aden", "hodeidah", "houthi", "taiz", "marib"], center: [47.586, 15.553] },
  { code: "PS", name: "Palestine", keywords: ["gaza", "west bank", "palestine", "ramallah", "rafah", "khan younis", "hamas", "jenin"], center: [35.234, 31.952] },
  { code: "LB", name: "Lebanon", keywords: ["lebanon", "beirut", "hezbollah", "south lebanon", "tripoli lebanon"], center: [35.862, 33.854] },
  { code: "IR", name: "Iran", keywords: ["iran", "tehran", "irgc", "revolutionary guard", "isfahan", "mashhad"], center: [53.688, 32.427] },
  // South/Central Asia
  { code: "AF", name: "Afghanistan", keywords: ["afghanistan", "kabul", "kandahar", "taliban", "helmand", "nangarhar", "kunduz"], center: [67.7099, 33.9391] },
  { code: "PK", name: "Pakistan", keywords: ["pakistan", "karachi", "lahore", "islamabad", "peshawar", "balochistan", "khyber", "ttp"], center: [69.345, 30.376] },
  // East Asia / Southeast Asia
  { code: "MM", name: "Myanmar", keywords: ["myanmar", "burma", "yangon", "mandalay", "rakhine", "shan state", "chin state", "pdf myanmar"], center: [95.956, 21.914] },
  { code: "PH", name: "Philippines", keywords: ["philippines", "mindanao", "manila", "marawi", "maguindanao", "abu sayyaf"], center: [121.774, 12.880] },
  // Europe / Eurasia
  { code: "UA", name: "Ukraine", keywords: ["ukraine", "kyiv", "kharkiv", "odesa", "zaporizhzhia", "kherson", "donbas", "mariupol"], center: [31.1656, 48.3794] },
  { code: "RU", name: "Russia", keywords: ["russia", "moscow", "chechnya", "dagestan", "north caucasus", "belgorod"], center: [105.319, 61.524] },
  { code: "TR", name: "Turkey", keywords: ["turkey", "ankara", "istanbul", "pkk", "kurdish turkey", "diyarbakir"], center: [35.243, 38.964] },
  // Latin America
  { code: "MX", name: "Mexico", keywords: ["mexico", "sinaloa", "jalisco", "cartel", "guerrero", "michoacan", "tamaulipas", "culiacan"], center: [-102.553, 23.635] },
  { code: "CO", name: "Colombia", keywords: ["colombia", "bogota", "medellin", "farc", "eln", "cali", "antioquia"], center: [-74.297, 4.571] },
  { code: "HT", name: "Haiti", keywords: ["haiti", "port-au-prince", "gang haiti", "cite soleil", "g9 gang"], center: [-72.285, 18.972] },
  { code: "VE", name: "Venezuela", keywords: ["venezuela", "caracas", "maduro", "aragua"], center: [-66.590, 6.424] }
];

const CATEGORY_KEYWORDS: Array<{ category: string; attackType: string; targetType: string; keywords: string[] }> = [
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

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "#text" in value) {
    const text = (value as { "#text"?: unknown })["#text"];
    return typeof text === "string" ? text : "";
  }
  return "";
}

function parseDate(input: string | undefined): Date {
  if (!input) {
    return new Date();
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseCoordinates(item: Record<string, unknown>): { latitude: number | null; longitude: number | null } {
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

function classifyIncident(text: string): { category: string; attackType: string; targetType: string } {
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

function inferCountry(text: string): { code: string; name: string; center: [number, number] } {
  const normalized = text.toLowerCase();
  for (const hint of COUNTRY_HINTS) {
    if (hint.keywords.some((keyword) => normalized.includes(keyword))) {
      return { code: hint.code, name: hint.name, center: hint.center };
    }
  }

  return { code: "UN", name: "Unknown", center: [0, 0] };
}

async function parseFeed(feedUrl: string): Promise<FeedItem[]> {
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

  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: unknown } }; feed?: { entry?: unknown } };

  const rssItems = toArray(parsed.rss?.channel?.item as Record<string, unknown> | Array<Record<string, unknown>> | undefined).map(
    (raw) => {
      const title = extractText(raw.title);
      const link = extractText(raw.link);
      const description = extractText(raw.description) || extractText(raw["content:encoded"]) || "";
      const publishedAt = parseDate(extractText(raw.pubDate) || extractText(raw.published) || extractText(raw.updated));
      const { latitude, longitude } = parseCoordinates(raw);
      return { title, link, publishedAt, description, latitude, longitude };
    }
  );

  const atomItems = toArray(parsed.feed?.entry as Record<string, unknown> | Array<Record<string, unknown>> | undefined).map(
    (raw) => {
      const title = extractText(raw.title);
      const linkObj = raw.link as { "@_href"?: string } | Array<{ "@_href"?: string }> | undefined;
      const links = toArray(linkObj);
      const link = links.find((l) => typeof l?.["@_href"] === "string")?.["@_href"] ?? "";
      const description = extractText(raw.summary) || extractText(raw.content) || "";
      const publishedAt = parseDate(extractText(raw.published) || extractText(raw.updated));
      const { latitude, longitude } = parseCoordinates(raw);
      return { title, link, publishedAt, description, latitude, longitude };
    }
  );

  return [...rssItems, ...atomItems].filter((item) => item.title && item.link);
}

async function upsertSource(feedUrl: string, item: FeedItem): Promise<{ sourceId: string; inserted: boolean }> {
  const contentHash = createHash("sha256")
    .update(`${item.title}|${item.link}|${item.publishedAt.toISOString()}`)
    .digest("hex");

  const sourceId = randomUUID();
  const provider = new URL(feedUrl).hostname;

  const result = await pool.query(
    `
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
    `,
    [
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
    ]
  );

  return {
    sourceId: String(result.rows[0].id),
    inserted: Boolean(result.rows[0].inserted)
  };
}

async function findCandidateIncident(title: string, occurredAt: Date, countryCode: string): Promise<string | null> {
  const result = await pool.query(
    `
    SELECT id
    FROM incidents
    WHERE country_code = $1
      AND occurred_at BETWEEN $2::timestamptz - interval '12 hours' AND $2::timestamptz + interval '12 hours'
      AND lower(title) = lower($3)
    ORDER BY occurred_at DESC
    LIMIT 1
    `,
    [countryCode, occurredAt.toISOString(), title]
  );

  return result.rowCount && result.rowCount > 0 ? String(result.rows[0].id) : null;
}

async function ensureIncidentAndLink(sourceId: string, item: FeedItem): Promise<boolean> {
  const combinedText = `${item.title} ${item.description}`;
  const country = inferCountry(combinedText);
  const incidentClass = classifyIncident(combinedText);

  const latitude = item.latitude ?? country.center[1];
  const longitude = item.longitude ?? country.center[0];

  let incidentId = await findCandidateIncident(item.title, item.publishedAt, country.code);

  if (!incidentId) {
    incidentId = randomUUID();
    await pool.query(
      `
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
      `,
      [
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
      ]
    );
  }

  await pool.query(
    `
    INSERT INTO incident_sources (incident_id, source_id, relevance_score, extraction_model, extraction_version)
    VALUES ($1, $2, 0.7, 'rss-normalizer', 'v1')
    ON CONFLICT (incident_id, source_id)
    DO NOTHING
    `,
    [incidentId, sourceId]
  );

  return true;
}

export async function ingestFeed(feedUrl: string): Promise<FeedIngestResult> {
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
