// Použijeme čistý globální import, který Netlify Functions v2 umí samy od sebe
const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // Inicializace trvalého úložiště
  const store = getStore("meteo_historie");
  
  // Načtení historie z disku (pokud neexistuje, začínáme s prázdným polem)
  let historie = await store.get("zaznamy", { type: "json" }) || [];

  // 1. PŘÍJEM DAT OD WEMOSU (POST požadavek)
  if (event.httpMethod === "POST") {
    try {
      const data = JSON.parse(event.body);
      
      if (data.temperature !== undefined && data.humidity !== undefined) {
        // Přidáme nové měření na začátek pole
        historie.unshift({
          temp: parseFloat(data.temperature),
          hum: parseFloat(data.humidity)
        });

        // Držíme v paměti pouze posledních 60 záznamů (1 hodina)
        if (historie.length > 60) {
          historie.pop();
        }

        // Uložíme aktualizované pole zpět do Blobs
        await store.setJSON("zaznamy", historie);

        return {
          statusCode: 200,
          body: "Data uspesne ulozena do Netlify Blobs."
        };
      }
      return { statusCode: 400, body: "Spatny format dat." };
    } catch (e) {
      return { statusCode: 500, body: "Chyba serveru pri zpracovani POST." };
    }
  }

  // 2. ZOBRAZENÍ WEBOVKY (GET požadavek)
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
        <title>Meteostanice</title>
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
            <h2>Meteostanice (Blobs)</h2>
            <div class="value temp">${typeof aktualni.temp === "number" ? aktualni.temp.toFixed(1) : aktualni.temp} °C</div>
            ${trendHtml}
            <div class="value hum">${typeof aktualni.hum === "number" ? aktualni.hum.toFixed(1) : aktualni.hum} %</div>
        </div>
    </body>
    </html>
  `;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: html
  };
};
