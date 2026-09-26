import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env") && !process.argv.includes("--replace")) {
  throw new Error(
    ".env already exists. Use --replace only if you intend to replace its local configuration.",
  );
}
// Never copy status wholesale: it also includes server-only credentials.
const status = JSON.parse(
  execFileSync("npx", ["--yes", "supabase@2.117.0", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!status.API_URL || !key) throw new Error("Start local Supabase first.");
writeFileSync(
  ".env",
  `# Local development only. Public client configuration.\nEXPO_PUBLIC_SUPABASE_URL=${status.API_URL}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nEXPO_PUBLIC_SUPABASE_ANDROID_URL=http://10.0.2.2:54321\n`,
  { mode: 0o600 },
);
console.log("Created .env with only the local API URL and public key.");
