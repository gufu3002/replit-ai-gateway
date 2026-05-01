import { loadConfig, syncEnvVars } from "./config";

const config = loadConfig();
syncEnvVars(config);

async function main() {
  const { default: app } = await import("./app");
  const { logger } = await import("./lib/logger");

  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const server = app.listen(port);
  server.once("listening", () => logger.info({ port }, "Server listening"));
  server.once("error", (err: NodeJS.ErrnoException) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
