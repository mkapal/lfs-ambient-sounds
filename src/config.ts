import * as path from "node:path";

import chalk from "chalk";
import { z } from "zod";
import { loadConfig } from "zod-config";
import { tomlAdapter } from "zod-config/toml-adapter";

const coordinateSchema = z.number().min(-32768).max(32767);
const soundLocationSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  z: coordinateSchema,
  sound: z.string().min(1),
});
const trackSchema = z.array(soundLocationSchema).optional().default([]);
const configSchema = z.object({
  insim: z.object({
    host: z.string().min(1).optional().default("127.0.0.1"),
    port: z.number().min(1).max(65535),
    admin: z.string().min(0).max(16).optional().default(""),
  }),
  sounds: z.object({
    BL: trackSchema,
    FE: trackSchema,
    SO: trackSchema,
    AU: trackSchema,
    KY: trackSchema,
    AS: trackSchema,
    WE: trackSchema,
    RO: trackSchema,
    LA: trackSchema,
  }),
});

const filePath = path.join(process.cwd(), "config.toml");

export const config = await loadConfig({
  schema: configSchema,
  adapters: tomlAdapter({ path: filePath }),
  onError: (error) => {
    console.error(chalk.red("Error loading configuration file:"));
    console.error(
      error.errors
        .map((e) => `- ${e.path.join(" -> ")}: ${e.message}`)
        .join("\n"),
    );
    process.exit(1);
  },
});

console.log("Configuration loaded");
