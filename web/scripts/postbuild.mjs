import { writeFileSync, readdirSync } from "fs";

const assets = readdirSync("dist/client/assets");
const jsEntry = assets.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const cssEntry = assets.find((f) => f.startsWith("index-") && f.endsWith(".css"));

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Room Booking</title>
    <link rel="stylesheet" href="/assets/${cssEntry}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${jsEntry}"></script>
  </body>
</html>`;

writeFileSync("dist/client/index.html", html);
console.log("Generated dist/client/index.html");
