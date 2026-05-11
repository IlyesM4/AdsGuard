import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Database not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file.");
  }
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // FB OAuth Config
  const FB_APP_ID = process.env.FB_APP_ID;
  const FB_APP_SECRET = process.env.FB_APP_SECRET;
  
  // Google OAuth Config
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  let APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

  // Remove trailing slash if present
  if (APP_URL.endsWith('/')) {
    APP_URL = APP_URL.slice(0, -1);
  }


  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Meeting Prep generation (CSV or PDF)
  app.post("/api/generate-meeting-prep", express.json({ limit: "20mb" }), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "GEMINI_API_KEY is not set in environment variables." });
    }

    const { rows, headers, template, clientName, niche, pdfBase64, clientId } = req.body;
    if (!template) {
      return res.status(400).json({ error: "Missing template in request body." });
    }
    if (!rows && !pdfBase64) {
      return res.status(400).json({ error: "Missing data: provide either CSV rows or pdfBase64." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Fetch client history for AI context
      let clientHistory: Array<{ output: string; post_meeting_notes: string | null; created_at: string }> = [];
      if (clientId && SUPABASE_URL && SUPABASE_KEY) {
        try {
          const histRes = await sbFetch(`/meeting_preps?select=output,post_meeting_notes,created_at&client_id=eq.${clientId}&order=created_at.desc&limit=3`);
          if (histRes.ok) clientHistory = await histRes.json();
        } catch { /* no history available */ }
      }

      const clientContext = [
        clientName ? `Client Name: ${clientName}` : "",
        niche ? `Niche / Industry: ${niche}` : "",
      ].filter(Boolean).join("\n");

      const sep = "─".repeat(60);
      const historySection = clientHistory.length > 0
        ? `\nCLIENT HISTORY (previous meeting preps — use these to identify changes, patterns & growth opportunities):\n${sep}\n${
            clientHistory.map((p, i) => {
              const date = new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
              const label = i === 0 ? "Most Recent Report" : `Report ${i + 1}`;
              return `[${label} — ${date}]\n${p.output}${p.post_meeting_notes ? `\n\n[Post-meeting notes from that session]: ${p.post_meeting_notes}` : ""}`;
            }).join(`\n${sep}\n`)
          }\n${sep}\n`
        : "";

      const systemPrompt = `You are a professional meeting preparation assistant for a digital marketing agency.

Your job is to analyze the provided advertising data and generate a polished, insightful meeting prep document.

${clientContext ? `CONTEXT:\n${clientContext}\n` : ""}${historySection}OUTPUT TEMPLATE (structure guide):
${template}

INSTRUCTIONS:
- Use the template above as a STRUCTURAL GUIDE ONLY — it defines the sections and format of your output.
- Do NOT copy the template text literally. Instead, analyze the data and write real, data-driven content.
- Extract actual numbers, metrics, and trends from the data to populate every section.
- Calculate derived metrics where needed (CPL, ROAS, booking rate, show rate, etc.).
- If the template mentions a client name or niche and they are provided in CONTEXT above, use those values.
- Format numbers: currencies as $X,XXX · percentages as X% · whole numbers for counts.
- If data for a section is unavailable, note it briefly rather than leaving a blank.
- Write ONLY the completed meeting prep document — no meta-commentary, no preamble.${clientHistory.length > 0 ? `
- HISTORICAL ANALYSIS: You have access to this client's previous reports above. Use them to:
  • Note what has CHANGED since the last report (metrics trending up or down)
  • Identify RECURRING struggles or consistent wins across multiple periods
  • Surface GROWTH OPPORTUNITIES based on observed patterns
  • If post-meeting notes exist, factor in what actually happened after that session` : ""}`;

      let response;

      if (pdfBase64) {
        // PDF path: pass the document as inline data to Gemini
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt + "\n\nDATA (see attached PDF):" },
                { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                { text: "Generate the meeting prep document now:" },
              ],
            },
          ],
        });
      } else {
        // CSV path: embed the table as text
        const csvTable = [
          headers.join(", "),
          ...rows.map((r: Record<string, string>) => headers.map((h: string) => r[h] ?? "").join(", ")),
        ].join("\n");

        response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: systemPrompt + `\n\nDATA (CSV):\n${csvTable}\n\nGenerate the meeting prep document now:`,
        });
      }

      res.json({ output: response.text });
    } catch (err: any) {
      console.error("Gemini generation error:", err);
      res.status(500).json({ error: err.message || "Generation failed" });
    }
  });

  // ── Client Memory API ──────────────────────────────────────────────────

  // GET /api/clients — list all clients with report count
  app.get("/api/clients", async (req, res) => {
    try {
      const sbRes = await sbFetch("/clients?select=*,meeting_preps(count)&order=name.asc");
      if (!sbRes.ok) return res.status(500).json({ error: await sbRes.text() });
      res.json({ clients: await sbRes.json() });
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  // POST /api/clients — create a new client
  app.post("/api/clients", express.json(), async (req, res) => {
    const { name, niche } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Client name is required." });
    try {
      const sbRes = await sbFetch("/clients", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name: name.trim(), niche: niche?.trim() || null }),
      });
      if (!sbRes.ok) return res.status(500).json({ error: await sbRes.text() });
      const [client] = await sbRes.json();
      res.json({ client });
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  // GET /api/meeting-preps?clientId=X — list reports for a client
  app.get("/api/meeting-preps", async (req, res) => {
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: "clientId is required." });
    try {
      const sbRes = await sbFetch(`/meeting_preps?select=*&client_id=eq.${clientId}&order=created_at.desc`);
      if (!sbRes.ok) return res.status(500).json({ error: await sbRes.text() });
      res.json({ preps: await sbRes.json() });
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  // POST /api/meeting-preps — save a generated report
  app.post("/api/meeting-preps", express.json(), async (req, res) => {
    const { clientId, output, fileName, templateName, template } = req.body;
    if (!clientId || !output) return res.status(400).json({ error: "clientId and output are required." });
    try {
      const sbRes = await sbFetch("/meeting_preps", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ client_id: clientId, output, file_name: fileName || null, template_name: templateName || null, template: template || null }),
      });
      if (!sbRes.ok) return res.status(500).json({ error: await sbRes.text() });
      const [prep] = await sbRes.json();
      res.json({ prep });
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  // PATCH /api/meeting-preps/:id/notes — add or edit post-meeting notes
  app.patch("/api/meeting-preps/:id/notes", express.json(), async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    try {
      const sbRes = await sbFetch(`/meeting_preps?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ post_meeting_notes: notes ?? null }),
      });
      if (!sbRes.ok) return res.status(500).json({ error: await sbRes.text() });
      const [prep] = await sbRes.json();
      res.json({ prep });
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  // Google Auth URL
  app.get("/api/auth/google/url", (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(400).json({ error: "GOOGLE_CLIENT_ID is not configured." });
    }
    const redirectUri = `${APP_URL}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.email openid https://lookerstudio.googleapis.com/auth/lookerstudio.readonly",
      access_type: "offline",
      prompt: "select_account consent",
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    res.json({ url: authUrl });
  });

  // Google Callback
  app.get("/auth/google/callback", async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${error}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!code) return res.status(400).send("No code provided");

    try {
      const redirectUri = `${APP_URL}/auth/google/callback`;
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) throw new Error(tokens.error_description || tokens.error);

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${err.message}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }
  });

  // Proxy to fetch GHL Opportunities
  app.get("/api/ghl/opportunities", async (req, res) => {
    const authHeader = req.headers.authorization;
    let { locationId, startTime, endTime } = req.query;
    
    const locId = (locationId || req.query.location_id) as string;
    console.log(`[GHL Proxy] Opportunities list: locId=${locId}`);

    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    if (!locId || locId === 'undefined' || locId === '') {
      return res.status(422).json({ error: "Location ID is required." });
    }

    try {
      const allOpportunities: any[] = [];
      let page = 1;
      const limit = 100;
      const maxPages = 20; // safety cap: 2,000 opportunities max

      while (page <= maxPages) {
        const ghlUrl = new URL('https://services.leadconnectorhq.com/opportunities/search');
        ghlUrl.searchParams.append('location_id', locId);
        ghlUrl.searchParams.append('page', page.toString());
        ghlUrl.searchParams.append('limit', limit.toString());

        const response = await fetch(ghlUrl.toString(), {
          headers: {
            Authorization: authHeader,
            Version: '2021-07-28',
            Accept: 'application/json'
          },
        });

        const text = await response.text();
        console.log(`[GHL Proxy] Opportunities page ${page} (${response.status}):`, text.substring(0, 200));

        if (!response.ok) {
          console.error(`GHL Opportunities Error (${response.status}):`, text);
          return res.status(response.status).json({ error: `GHL API Error: ${response.status}`, details: text });
        }

        const data = JSON.parse(text);
        const batch: any[] = data.opportunities || data.data || [];
        allOpportunities.push(...batch);

        if (!data.meta?.nextPage || batch.length < limit) break;
        page++;
      }

      console.log(`[GHL Proxy] Opportunities total fetched: ${allOpportunities.length} across ${page} page(s)`);

      const filtered = allOpportunities.filter((o: any) => {
        const dateStr = o.createdAt || o.dateAdded || o.date_added || o.updatedAt;
        if (!dateStr) return false;
        const created = new Date(dateStr).getTime();
        return created >= Number(startTime) && created <= Number(endTime);
      });

      res.json({ opportunities: filtered });
    } catch (err: any) {
      console.error("GHL Opportunities Proxy Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy to fetch GHL Appointments
  app.get("/api/ghl/appointments", async (req, res) => {
    const authHeader = req.headers.authorization;
    let { locationId, startTime, endTime } = req.query;
    
    const locId = (locationId || req.query.location_id) as string;
    console.log(`[GHL Proxy] Appointments list: locId=${locId}`);

    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    if (!locId || locId === 'undefined' || locId === '') {
      return res.status(422).json({ error: "Location ID is required." });
    }

    try {
      // GHL /calendars/events filters by appointment date, not booking creation date.
      // People often book appointments for future dates, so we extend endTime by +90 days
      // to capture them. Filtering by creation date (dateAdded) happens in ghl.ts.
      const startISO = new Date(Number(startTime)).toISOString();
      const endISO   = new Date(Number(endTime) + 90 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`[GHL Proxy] Calendar Events range: ${startISO} → ${endISO} (+90d buffer)`);

      const calendarsUrl = new URL('https://services.leadconnectorhq.com/calendars/');
      calendarsUrl.searchParams.append('locationId', locId);

      const calendarsRes = await fetch(calendarsUrl.toString(), {
        headers: { Authorization: authHeader, Version: '2021-07-28', Accept: 'application/json' },
      });

      if (!calendarsRes.ok) {
        const text = await calendarsRes.text();
        console.error(`GHL Calendars list error (${calendarsRes.status}):`, text);
        return res.status(calendarsRes.status).json({ error: `GHL Calendars Error: ${calendarsRes.status}`, details: text });
      }

      const calendarsData = await calendarsRes.json();
      const calendars: any[] = calendarsData.calendars || [];
      console.log(`[GHL Proxy] Found ${calendars.length} calendar(s) for location`);

      if (calendars.length === 0) {
        return res.json({ appointments: [] });
      }

      // Fetch events for every calendar in parallel (no page/limit — not supported)
      const eventBatches = await Promise.all(
        calendars.map(async (cal: any) => {
          const eventsUrl = new URL('https://services.leadconnectorhq.com/calendars/events');
          eventsUrl.searchParams.append('locationId', locId);
          eventsUrl.searchParams.append('calendarId', cal.id);
          eventsUrl.searchParams.append('startTime', startISO);
          eventsUrl.searchParams.append('endTime', endISO);

          const res2 = await fetch(eventsUrl.toString(), {
            headers: { Authorization: authHeader, Version: '2021-07-28', Accept: 'application/json' },
          });

          if (!res2.ok) {
            const t = await res2.text();
            console.warn(`[GHL Proxy] Events for calendar ${cal.id} (${res2.status}):`, t.substring(0, 200));
            return [];
          }

          const d = await res2.json();
          return d.events || d.appointments || d.data || [];
        })
      );

      // Flatten + deduplicate by event id
      const seen = new Set<string>();
      const allAppointments = eventBatches.flat().filter((e: any) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      console.log(`[GHL Proxy] Appointments total: ${allAppointments.length} across ${calendars.length} calendar(s)`);
      res.json({ appointments: allAppointments });
    } catch (err: any) {
      console.error("GHL Appointments Proxy Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy to fetch GHL Contacts filtered by niche tag
  app.get("/api/ghl/contacts", async (req, res) => {
    const authHeader = req.headers.authorization;
    const { locationId, tag, startTime, endTime } = req.query;
    const locId = locationId as string;

    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    if (!locId) return res.status(422).json({ error: "Location ID is required." });

    try {
      const allContacts: any[] = [];
      let startAfterId: string | undefined;
      const limit = 100;
      const maxPages = 30;
      // Normalize tag: "knee-pain" and "knee pain" both become "knee pain" for comparison
      const normalizedTag = (tag as string || '').toLowerCase().replace(/-/g, ' ').trim();

      console.log(`[GHL Proxy] Contacts search: tag="${tag}", range=${startTime}→${endTime}`);

      for (let page = 0; page < maxPages; page++) {
        const ghlUrl = new URL('https://services.leadconnectorhq.com/contacts/');
        ghlUrl.searchParams.append('locationId', locId);
        ghlUrl.searchParams.append('limit', limit.toString());
        // GHL query searches across name, email, phone, and tags
        if (tag) ghlUrl.searchParams.append('query', tag as string);
        if (startAfterId) ghlUrl.searchParams.append('startAfterId', startAfterId);

        const response = await fetch(ghlUrl.toString(), {
          headers: { Authorization: authHeader, Version: '2021-07-28', Accept: 'application/json' },
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`GHL Contacts Error (${response.status}):`, text);
          return res.status(response.status).json({ error: `GHL Contacts Error: ${response.status}`, details: text });
        }

        const data = await response.json();
        const contacts: any[] = data.contacts || [];

        // Filter: contact must have a tag that fuzzy-matches the niche
        const tagFiltered = normalizedTag
          ? contacts.filter((c: any) => {
              const contactTags: string[] = (c.tags || []).map((t: string) =>
                t.toLowerCase().replace(/-/g, ' ')
              );
              return contactTags.some(t => t.includes(normalizedTag) || normalizedTag.includes(t));
            })
          : contacts;

        // Filter by date range (dateAdded)
        const start = Number(startTime);
        const end = Number(endTime);
        const dateFiltered = (startTime && endTime)
          ? tagFiltered.filter((c: any) => {
              const dateStr = c.dateAdded || c.createdAt;
              if (!dateStr) return false;
              const created = new Date(dateStr).getTime();
              return created >= start && created <= end;
            })
          : tagFiltered;

        allContacts.push(...dateFiltered);

        // GHL cursor pagination
        if (contacts.length < limit) break;
        startAfterId = contacts[contacts.length - 1]?.id;
        if (!startAfterId) break;
      }

      console.log(`[GHL Proxy] Contacts with tag "${tag}": ${allContacts.length}`);
      res.json({ contacts: allContacts });
    } catch (err: any) {
      console.error("GHL Contacts Proxy Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy to fetch Google Sheets list
  app.get("/api/google/sheets", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    try {
      const response = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime)", {
        headers: { Authorization: authHeader },
      });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy to fetch Looker Studio assets
  app.get("/api/google/lookerstudio", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    try {
      // Asset search for reports
      const response = await fetch("https://lookerstudio.googleapis.com/v1/assets:search?assetType=REPORT", {
        headers: { Authorization: authHeader },
      });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy to fetch Spreadsheet content
  app.get("/api/google/sheets/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    const { id } = req.params;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    try {
      // First get sheet metadata to get sheet names
      const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}`, {
        headers: { Authorization: authHeader },
      });
      const metaData = await metaResponse.json();
      
      // Fetch first sheet range
      if (metaData.sheets && metaData.sheets.length > 0) {
        const sheetName = metaData.sheets[0].properties.title;
        const dataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${sheetName}!A1:Z100`, {
          headers: { Authorization: authHeader },
        });
        const values = await dataResponse.json();
        res.json({ metadata: metaData, values });
      } else {
        res.json({ metadata: metaData, values: { values: [] } });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // FB Auth URL
  app.get("/api/auth/facebook/url", (req, res) => {
    if (!FB_APP_ID) {
      console.error("Missing FB_APP_ID environment variable");
      return res.status(400).json({ error: "FB_APP_ID is not configured in environment variables." });
    }
    const redirectUri = `${APP_URL}/auth/facebook/callback`;
    const params = new URLSearchParams({
      client_id: FB_APP_ID,
      redirect_uri: redirectUri,
      scope: "ads_management,ads_read,read_insights",
      response_type: "code",
    });
    const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?${params}`;
    res.json({ url: authUrl });
  });

  // FB Callback
  app.get("/auth/facebook/callback", async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'FB_AUTH_ERROR', error: '${error}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send("No code provided");
    }

    try {
      // Exchange code for token
      const redirectUri = `${APP_URL}/auth/facebook/callback`;
      const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${redirectUri}&client_secret=${FB_APP_SECRET}&code=${code}`;
      
      const response = await fetch(tokenUrl);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const accessToken = data.access_token;

      // Send token back to client
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FB_AUTH_SUCCESS', token: '${accessToken}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'FB_AUTH_ERROR', error: '${err.message}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
