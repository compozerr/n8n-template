import { Command } from "./utils/command.ts";
import fs from "node:fs/promises"

const dockerComposeFiles = ["docker-compose.yml"];

const moduleComposeContexts: { [name: string]: string } = {};

const moduleComposeContextsEnvironmentVars = Object.entries(moduleComposeContexts)
    .map(([name, path]) => `COMPOSE_${name.toUpperCase()}_CONTEXT=${path}`)
    .join(" ");

const commandFlags = `-f ${dockerComposeFiles.join(" -f ")}`;

// Clean up existing containers first
if (!Deno.args.includes("--no-clean")) {
    console.log("🗑️  Stopping and removing existing containers...");
    const downCommand = `${moduleComposeContextsEnvironmentVars} docker-compose ${commandFlags} down --remove-orphans`;
    const downProcess = new Command(downCommand);
    try {
        await downProcess.spawn();
        console.log("✅ Containers cleaned up");
    } catch (error) {
        console.log("⚠️  Cleanup failed, continuing anyway:", error);
    }
}

if (!Deno.args.includes("--no-build")) {
    console.log("🧹 Cleaning old build cache...");
    const cleanCommand = "docker builder prune --filter until=168h --reserved-space=20GB -f";
    const cleanProcess = new Command(cleanCommand);
    try {
        await cleanProcess.spawn();
        console.log("✅ Cache cleanup completed");
    } catch (error) {
        console.log("⚠️  Cache cleanup failed, continuing anyway:", error);
    }
}

// Copy .env file if it exists
try {
    await fs.access("backend/.env");
    await fs.cp("backend/.env", ".env", { force: true });
    console.log("✅ Copied backend/.env to .env");
} catch (_error) {
    console.log("⚠️  backend/.env not found, skipping copy");
}

const upCommand = `${moduleComposeContextsEnvironmentVars} docker-compose ${commandFlags} up --pull always --force-recreate${Deno.args.includes("--no-build") ? "" : " --build"}${Deno.args.includes("-d") ? " -d" : ""}`;

console.log({ upCommand });

const process = new Command(upCommand);

Deno.addSignalListener("SIGINT", async () => {
    console.log("\n🛑 Shutting down gracefully...");
    await process.terminateAsync();
    Deno.exit(0);
});

try {
    await process.spawn();
} catch (error) {
    console.error("❌ Docker compose failed:", error);
    Deno.exit(1);
}