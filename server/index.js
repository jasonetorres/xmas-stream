import http from "node:http";
import { ConfigError, createApp } from "./app.js";

const port = Number(process.env.PORT) || 8080;
let server;
let app;

function shutdown() {
  if (!server) return;
  server.close(() => {
    Promise.resolve(app?.close()).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

try {
  app = await createApp(process.env);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

server = http.createServer((req, res) => {
  app.handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Something went wrong.\n");
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  const store = app.config.databaseUrl ? "postgres" : `sqlite ${app.config.sqlitePath}`;
  console.log(`xmas-stream listening on 0.0.0.0:${port}`);
  console.log(`store: ${store}${app.config.ephemeral ? " (ephemeral on Unkey until DATABASE_URL is set)" : ""}`);
  if (app.generatedAdminCode) {
    console.log(`Admin code for Jason: ${app.generatedAdminCode}`);
    console.log("Set ADMIN_CODE to choose your own and keep it out of the logs.");
  }
  if (app.generatedSponsorCode) {
    console.log(`Sponsor code: ${app.generatedSponsorCode}`);
    console.log("Set SPONSOR_CODE to choose your own and keep it out of the logs.");
  }
});
