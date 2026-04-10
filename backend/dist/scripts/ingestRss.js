import "dotenv/config";
import { pool } from "../db/pool.js";
import { ingestFeed } from "../ingestion/rss.js";
function getFeedsFromEnv() {
    const raw = process.env.RSS_FEEDS?.trim();
    if (!raw) {
        return [
            "https://www.aljazeera.com/xml/rss/all.xml",
            "https://feeds.bbci.co.uk/news/world/rss.xml"
        ];
    }
    return raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}
async function run() {
    const feeds = getFeedsFromEnv();
    const results = [];
    for (const feedUrl of feeds) {
        try {
            const result = await ingestFeed(feedUrl);
            results.push(result);
            console.log(`Feed ${feedUrl}: fetched=${result.fetched}, inserted_sources=${result.insertedSources}, linked_incidents=${result.linkedIncidents}`);
        }
        catch (error) {
            console.error(`Feed ${feedUrl} failed:`, error);
        }
    }
    const totals = results.reduce((acc, item) => {
        acc.fetched += item.fetched;
        acc.insertedSources += item.insertedSources;
        acc.linkedIncidents += item.linkedIncidents;
        return acc;
    }, { fetched: 0, insertedSources: 0, linkedIncidents: 0 });
    console.log(`Ingestion finished. feeds=${results.length}, fetched=${totals.fetched}, inserted_sources=${totals.insertedSources}, linked_incidents=${totals.linkedIncidents}`);
}
run()
    .catch((error) => {
    console.error("RSS ingestion failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await pool.end();
});
