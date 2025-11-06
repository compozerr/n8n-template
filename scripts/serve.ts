import { Command } from "./utils/command.ts";
import fs from "node:fs/promises"

const dockerComposeFiles = ["docker-compose.yml"];

const moduleComposeContexts: { [name: string]: string } = {};

const moduleComposeContextsEnvironmentVars = Object.entries(moduleComposeContexts).map(([name, path]) => `COMPOSE_${name.toUpperCase()}_CONTEXT=${path}`).join(" ");

if (!Deno.args.includes("--no-build")) {
    console.log("🧹 Cleaning old build cache...");
    const cleanCommand = "docker builder prune --filter until=168h --keep-storage=20GB -f";
    const cleanProcess = new Command(cleanCommand);
    try {
        await cleanProcess.spawn();
        console.log("✅ Cache cleanup completed");
    } catch (error) {
        console.log("⚠️  Cache cleanup failed, continuing anyway:", error);
    }
}

const commandFlags = `-f ${dockerComposeFiles.join(" -f ")}`
const upCommand = `${moduleComposeContextsEnvironmentVars} docker-compose ${commandFlags} up${Deno.args.includes("--no-build") ? "" : " --build"}${Deno.args.includes("-d") ? " -d" : ""}`;

console.log({ upCommand })

await fs.cp("backend/.env", ".env", { force: true });

const process = new Command(upCommand);

Deno.addSignalListener("SIGINT", async () => {
    await process.terminateAsync()
});

await process.spawn();

