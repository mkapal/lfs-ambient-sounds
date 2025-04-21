import * as path from "node:path";
import * as process from "node:process";

import chalk from "chalk";
import { z } from "zod";
import { loadConfig as loadZodConfig } from "zod-config";
import { tomlAdapter } from "zod-config/toml-adapter";

const configSchema = z.object({
  insim: z.object({
    host: z.string().min(1).optional().default("127.0.0.1"),
    port: z.number().min(1).max(65535),
    admin: z.string().min(0).max(16).optional().default(""),
  }),
  sounds: z.object({
    profile: z.union([
      z.literal("default"),
      z.string().refine((val) => val !== "default", {
        message: '"default" must be used as a literal only',
      }),
    ]),
  }),
});

export async function loadConfig() {
  const config = await loadZodConfig({
    schema: configSchema,
    adapters: [
      tomlAdapter({
        path: path.join(process.cwd(), "config.toml"),
      }),
      tomlAdapter({
        path: path.join(process.cwd(), "config.local.toml"),
        silent: true,
      }),
    ],
    onError: (error) => {
      console.error(chalk.red("Error loading configuration:"));
      console.error(
        error.errors
          .map((e) => `- ${e.path.join(" -> ")}: ${e.message}`)
          .join("\n"),
      );
      process.exit(1);
    },
  });

  console.log(chalk.green("Configuration loaded"));
  console.log(`Profile: ${config.sounds.profile}`);

  return config;
}
