import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

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
      const allAppointments: any[] = [];
      let page = 1;
      const limit = 100;
      const maxPages = 10; // safety cap: 1,000 appointments max

      while (page <= maxPages) {
        const ghlUrl = new URL('https://services.leadconnectorhq.com/appointments');
        ghlUrl.searchParams.append('locationId', locId);
        if (startTime) ghlUrl.searchParams.append('startDate', startTime.toString());
        if (endTime) ghlUrl.searchParams.append('endDate', endTime.toString());
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
        console.log(`[GHL Proxy] Appointments page ${page} (${response.status}):`, text.substring(0, 200));

        if (!response.ok) {
          console.error(`GHL Appointments Error (${response.status}):`, text);
          // If 404 on first page, retry with trailing slash as fallback
          if (response.status === 404 && page === 1) {
            const fallbackUrl = new URL('https://services.leadconnectorhq.com/appointments/');
            fallbackUrl.searchParams.append('locationId', locId);
            if (startTime) fallbackUrl.searchParams.append('startDate', startTime.toString());
            if (endTime) fallbackUrl.searchParams.append('endDate', endTime.toString());

            const fallbackResponse = await fetch(fallbackUrl.toString(), {
              headers: { Authorization: authHeader, Version: '2021-07-28', Accept: 'application/json' },
            });
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              return res.json({ appointments: fallbackData.appointments || fallbackData.data || [] });
            }
          }
          return res.status(response.status).json({ error: `GHL API Error: ${response.status}`, details: text });
        }

        const data = JSON.parse(text);
        const batch: any[] = data.appointments || data.data || [];
        allAppointments.push(...batch);

        if (!data.meta?.nextPage || batch.length < limit) break;
        page++;
      }

      console.log(`[GHL Proxy] Appointments total fetched: ${allAppointments.length} across ${page} page(s)`);
      res.json({ appointments: allAppointments });
    } catch (err: any) {
      console.error("GHL Appointments Proxy Error:", err);
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
