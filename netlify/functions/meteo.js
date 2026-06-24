import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  // Inicializace trvalého úložiště Blobs
  const store = getStore("meteo_historie");
  
  // Načtení historie (pokud neexistuje, vytvoří se prázdné pole)
  let historie = await store.get("zaznamy", { type: "json" }) || [];

  // 1. PŘÍJEM DAT OD WEMOSU (POST)
  if (request.method === "POST") {
    try {
      const data = await request.json();
      if (data.temperature !== undefined && data.humidity !== undefined) {
        
        // Přidáme nový záznam na začátek
        historie.unshift({
          temp: parseFloat(data.temperature),
          hum: parseFloat(data.humidity)
        });

        // Držíme v paměti pouze posledních 60 minut
        if (historie.length > 60) {
          historie.pop();
        }

        // Trvalé uložení na disk Netlify
        await store.setJSON("zaznamy", historie);

        return new Response("Data trvale ulozena do Blobs.", { status: 200 });
      }
      return new Response("Spatny format dat.", { status: 400 });
    } catch (e) {
      return new Response("Chyba serveru při POST.", { status: 500 });
    }
  }

  // 2. ZOBRAZENÍ WEBOVKY PRO TEBE (GET)
  const aktualni = historie[0] || { temp: "Neznamá", hum: "Neznamá" };
  let srovnavaciZaznam = historie.length >= 60 ? historie[59] : null;
  
  let trendHtml = "";
  if (srovnavaciZaznam && typeof aktualni.temp === "number") {
    const rozdil = aktualni.temp - srovnavaciZaznam.temp;
    const absRozdil = Math.abs(rozdil).toFixed(1);

    if (rozdil > 0.1) {
      trendHtml = `<div class="trend up">▲ o ${absRozdil} °C (za hodinu)</div>`;
    } else if (rozdil < -0.1) {
      trendHtml = `<div class="trend down">▼ o ${absRozdil} °C (za hodinu)</div>`;
    } else {
      trendHtml = `<div class="trend">● beze změny (za hodinu)</div>`;
    }
  } else {
    trendHtml = `<div class="trend">Sbiram data pro srovnani... (${historie.length}/60 min)</div>`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="60">
        <title>Meteo Blobs</title>
        <style>
            body { font-family: Arial, sans-serif; background: #f0f4f8; text-align: center; margin-top: 50px; }
            .card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); display: inline-block; min-width: 250px; }
            .value { font-size: 40px; font-weight: bold; margin: 15px 0; }
            .temp { color: #e74c3c; } .hum { color: #3498db; }
            .trend { font-size: 16px; font-weight: bold; margin-top: -5px; margin-bottom: 15px; color: #7f8c8d; }
            .trend.up { color: #2ecc71; } .trend.down { color: #e74c3c; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Meteostanice</h2>
            <div class="value temp">${typeof aktualni.temp === "number" ? aktualni.temp.toFixed(1) : aktualni.temp} °C</div>
            ${trendHtml}
            <div class="value hum">${typeof aktualni.hum === "number" ? aktualni.hum.toFixed(1) : aktualni.hum} %</div>
        </div>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
};
export const config = { path: "/" };
