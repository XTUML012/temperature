// Globální proměnné v paměti serveru pro udržení stavu
let aktualniTeplota = "Neznámá";
let aktualniVlhkost = "Neznámá";

export default async (request, context) => {
  const url = new URL(request.url);

  // 1. POKUD PŘICHÁZÍ DATA Z WEMOSU (Metoda POST)
  if (request.method === "POST") {
    try {
      const data = await request.json();
      if (data.temperature !== undefined && data.humidity !== undefined) {
        aktualniTeplota = parseFloat(data.temperature).toFixed(1);
        aktualniVlhkost = parseFloat(data.humidity).toFixed(1);
        return new Response("Data přijata v paměti", { status: 200 });
      }
      return new Response("Špatný formát dat", { status: 400 });
    } catch (e) {
      return new Response("Chyba zpracování", { status: 500 });
    }
  }

  // 2. POKUD SE DÍVÁŠ TY PŘES MOBIL (Klasické stažení stránky přes GET)
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="60">
        <title>Meteo bez databáze</title>
        <style>
            body { font-family: Arial, sans-serif; background: #f0f4f8; text-align: center; margin-top: 50px; }
            .card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); display: inline-block; min-width: 250px; }
            .value { font-size: 40px; font-weight: bold; margin: 15px 0; }
            .temp { color: #e74c3c; } .hum { color: #3498db; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Pokoj (Netlify RAM)</h2>
            <div class="value temp">${aktualniTeplota} °C</div>
            <div class="value hum">${aktualniVlhkost} %</div>
        </div>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
};

// Konfigurace cesty – funkce poběží na hlavní doméně webu
export const config = { path: "/" };
