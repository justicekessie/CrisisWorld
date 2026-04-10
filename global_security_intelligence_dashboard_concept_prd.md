# Global Security Intelligence Dashboard

## Vision

Build a modern global intelligence platform that visualizes terrorism, political violence, extremist incidents, and conflict activity across the world in real time.

The experience should feel like a premium Bloomberg Terminal for global security intelligence:
- Massive interactive world map
- Real-time incident feed
- Historical and live terrorism trends
- AI-generated summaries and hotspot detection
- Public reporting and image uploads
- Government-grade filtering and analysis tools

---

# Product Positioning

This should not feel like a sensationalist “terrorism website.”

The platform should be framed as:
- Global security intelligence platform
- Crisis monitoring dashboard
- Conflict and threat visualization system
- Public safety and humanitarian awareness tool

Target users:
- Journalists
- Researchers
- NGOs
- Security analysts
- Governments
- Universities
- Travelers
- Humanitarian organizations

---

# Core Homepage Experience

## Hero Experience

The homepage opens directly to a full-screen white-mode world map.

Features:
- Clustered incident points
- Heatmap layer
- Timeline playback slider
- Animated spread over time
- Country hover cards
- Severity color coding
- Incident count summaries
- Sidebar with filters and analytics

## Main Filters

Users can filter by:
- Country
- Region
- Terror group
- Ideology
- Weapon type
- Casualty count
- Target type
- Date range
- Verified vs unverified reports
- Source credibility
- Incident category

---

# Main Dashboard Sections

## 1. Interactive Global Map

Map layers:
- Terrorism incidents
- Conflict zones
- Kidnappings
- Bombings
- Armed clashes
- Attacks on civilians
- Infrastructure attacks
- Political violence
- Extremist activity

Map interactions:
- Click incident to open detail drawer
- Hover for quick summary
- Zoom into city-level detail
- View photos/videos
- Open source articles
- See nearby related incidents

## 2. Incident Detail Drawer

Each incident should contain:
- Title
- Date/time
- Country and city
- Exact coordinates
- Suspected group
- Actors involved
- Number injured
- Number killed
- Type of attack
- Description
- Source links
- Uploaded media
- Verification status
- Related incidents nearby

## 3. Trend Analytics Panel

Visualizations:
- Incidents over time
- Fatalities over time
- Top countries affected
- Top active groups
- Most common attack methods
- Most targeted sectors
- Emerging hotspots
- Year-over-year change
- Heat intensity by region

## 4. Live News Feed

Feed sources:
- RSS feeds
- Government alerts
- News APIs
- NGO reports
- Local media
- International media

Each news card should include:
- Headline
- Source
- Country
- Date/time
- AI summary
- Related incident match

## 5. Public Submission Portal

Users can submit:
- Photos
- Videos
- Incident reports
- Locations
- Eyewitness notes

Submission flow:
1. User uploads evidence
2. User chooses map location
3. User enters description
4. AI extracts entities and possible classifications
5. Moderators review submission
6. Incident becomes verified or remains pending

---

# AI Features

## AI Entity Extraction

From news articles and public submissions, AI should automatically extract:
- Location
- Country
- Terror group
- Casualties
- Date/time
- Attack type
- Target type
- Named actors

## AI Deduplication

If 20 news sources report the same event, merge them into one incident record.

## AI Summaries

Generate:
- Country summaries
- Group summaries
- “What changed in the last 24 hours?”
- “Top emerging hotspots”
- “Recent attacks involving ISIS affiliates”

## AI Risk Scoring

Generate country risk levels based on:
- Incident frequency
- Severity
- Growth rate
- Geographic spread
- Group activity

---

# Data Sources

Potential sources:
- Global Terrorism Database (GTD)
- ACLED
- GDELT
- RSS feeds
- Government alert feeds
- NGO reports
- Crowdsourced submissions
- News APIs

---

# Trust and Moderation

Every incident should have a confidence label:

1. Verified Official Data
2. Verified Media Reports
3. Multiple Independent Sources
4. Community Submission Pending Review
5. Unverified Submission

Moderation tools:
- Spam detection
- Duplicate detection
- Extremist content filtering
- Image moderation
- Admin review queue
- Source credibility scoring

---

# Suggested Tech Stack

## Frontend
- Next.js
- React
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Mapbox GL
- Recharts

## Backend
- Node.js
- PostgreSQL
- PostGIS
- Elasticsearch
- Redis
- Supabase or Firebase for realtime updates

## Infrastructure
- Vercel frontend
- Railway / Render backend
- AWS S3 for media uploads
- Cloudflare CDN

## AI Layer
- OpenAI for extraction and summarization
- OCR for extracting text from uploaded images
- Moderation APIs
- Embedding search for incident matching

---

# UI Style Direction

The UI should feel:
- Premium
- Modern
- Intelligence-dashboard inspired
- Minimal but powerful
- Dark theme
- High-contrast typography
- Large map-first layout
- Glassmorphism panels
- Subtle gradients
- Animated heatmaps
- High-density information without clutter

Avoid:
- Sensationalism
- Flashy red “danger” aesthetics
- Cheap military styling
- Overly dramatic imagery

---

# Potential Product Names

- SentinelMap
- ThreatScope
- CrisisAtlas
- TerraWatch
- Incident Atlas
- VigilWorld
- Global Threat Grid
- CrisisLens
- TerraPulse
- BlackMap

