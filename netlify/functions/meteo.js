import { getStore } from "@netlify/blobs";

// Netlify Functions v2 – export default async handler
export default async (request, context) => {

  // Blobs store – název musí být alfanumerický, bez diakritiky
  const store = getStore("meteo-historie");

  let historie = [];
  try {
    const raw = await store.get("zaznamy", { type: "json" });
    if (Array.isArray(raw)) historie = raw;
  } catch (e) {
    // Klíč ještě neexistuje – první spuštění, začínáme prázdným polem
    historie = [];
  }

  // ── 1. PŘÍJEM DAT (POST) ────────────────────────────────────────────────
  if (request.method === "POST") {
    try {
      const data = await request.json();

      if (data.temperature === undefined || data.humidity === undefined) {
        return new Response("Spatny format dat.", { status: 400 });
      }

      const zaznam = {
        temp: parseFloat(data.temperature),
        hum:  parseFloat(data.humidity),
        ts:   Date.now(),          // timestamp pro budoucí použití
      };

      historie.unshift(zaznam);
      if (historie.length > 60) historie.length = 60;   // max 60 záznamů = 60 min

      await store.setJSON("zaznamy", historie);

      return new Response("OK", { status: 200 });

    } catch (e) {
      console.error("POST chyba:", e);
      return new Response("Chyba serveru: " + e.message, { status: 500 });
    }
  }

  // ── 2. ZOBRAZENÍ HTML KARTY (GET) ───────────────────────────────────────
  const aktualni = historie[0] ?? null;

  const tempText = aktualni ? aktualni.temp.toFixed(1) + " °C"   : "—";
  const humText  = aktualni ? aktualni.hum.toFixed(1)  + " %"    : "—";

  // Trend: porovnáváme nejstarší dostupný záznam (ideálně index 59 = před 60 min)
  let trendHtml = `<p class="trend sbir">⏳ Sbírám data… (${historie.length}/60 min)</p>`;

  if (aktualni && historie.length >= 2) {
    const srovnavaci = historie.length >= 60 ? historie[59] : historie[historie.length - 1];
    const rozdil = aktualni.temp - srovnavaci.temp;
    const abs    = Math.abs(rozdil).toFixed(1);
    const minAgo = Math.round((aktualni.ts - srovnavaci.ts) / 60000);

    if      (rozdil >  0.1) trendHtml = `<p class="trend up">▲ +${abs} °C za posl. ${minAgo} min</p>`;
    else if (rozdil < -0.1) trendHtml = `<p class="trend down">▼ −${abs} °C za posl. ${minAgo} min</p>`;
    else                    trendHtml = `<p class="trend flat">● Teplota stabilní</p>`;
  }

  // Čas posledního měření (pokud máme timestamp)
  let casHtml = "";
  if (aktualni?.ts) {
    const cas = new Date(aktualni.ts).toLocaleTimeString("cs-CZ", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Europe/Prague"
    });
    casHtml = `<p class="cas">Poslední měření: ${cas}</p>`;
  }

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="60">
  <title>Meteostanice</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
    }

    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 1.5rem;
      padding: 2.5rem 3rem;
      text-align: center;
      min-width: 280px;
      box-shadow: 0 4px 32px rgba(0,0,0,.4);
    }

    h1 { font-size: .85rem; letter-spacing: .15em; text-transform: uppercase;
         color: #64748b; margin-bottom: 1.5rem; }

    .temp { font-size: 4.5rem; font-weight: 700; color: #f8fafc; line-height: 1; }
    .hum  { font-size: 2rem;   font-weight: 400; color: #94a3b8; margin-top: .4rem; }

    .trend {
      margin-top: 1.2rem;
      font-size: 1rem;
      font-weight: 600;
      padding: .4rem .8rem;
      border-radius: .5rem;
      display: inline-block;
    }
    .trend.up   { background: #7f1d1d22; color: #f87171; }
    .trend.down { background: #1e3a5f22; color: #60a5fa; }
    .trend.flat { background: #14532d22; color: #4ade80; }
    .trend.sbir { background: #44444422; color: #94a3b8; }

    .cas { margin-top: 1.2rem; font-size: .8rem; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Meteostanice — Wemos D1 + SHT3X</h1>
    <div class="temp">${tempText}</div>
    <div class="hum">💧 ${humText}</div>
    ${trendHtml}
    ${casHtml}
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type":  "text/html; charset=UTF-8",
      "Cache-Control": "no-store",          // vždy čerstvá data
    },
  });
};

// Netlify Functions v2 – definice routy a metod
export const config = {
  path: ["/", "/meteo"],
  method: ["GET", "POST"],
};
