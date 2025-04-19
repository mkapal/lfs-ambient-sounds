import * as path from "node:path";
import * as process from "node:process";

import chalk from "chalk";
import { z } from "zod";
import { loadConfig } from "zod-config";
import { tomlAdapter } from "zod-config/toml-adapter";

import type { Track } from "./tracks";
import { tracks } from "./tracks";

const coordinateSchema = z.number().min(-32768).max(32767).optional();
const soundConfigSchema = z.object({
  sound: z.string().min(1),
  x: coordinateSchema,
  y: coordinateSchema,
  z: coordinateSchema,
  refDistance: z.number().min(0).max(4096).optional().default(3),
  maxDistance: z.number().min(0).max(4096).optional().default(100),
});
const trackSchema = z.array(soundConfigSchema).optional().default([]);
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

export const config = await loadConfig({
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

console.log("Configuration loaded");
console.log(`Profile: ${config.sounds.profile}`);

export const trackSounds: Record<Track, z.output<typeof trackSchema>> = {
  BL: [],
  SO: [],
  FE: [],
  AU: [],
  KY: [],
  AS: [],
  WE: [],
  RO: [],
  LA: [],
};

tracks.forEach(async (track) => {
  const soundProfile = await loadConfig({
    schema: z.object({
      [track]: trackSchema,
    }),
    adapters: tomlAdapter({
      path: path.join(
        process.cwd(),
        `profiles/${config.sounds.profile}/${track}.toml`,
      ),
    }),
    onError: (error) => {
      console.error(chalk.red("Error loading sound profile:"));
      console.error(
        error.errors
          .map((e) => `- ${e.path.join(" -> ")}: ${e.message}`)
          .join("\n"),
      );
      process.exit(1);
    },
  });

  const numSounds = soundProfile[track].length;
  if (numSounds > 0) {
    console.log(
      `Loaded ${track} sound profile with ${numSounds} sound${numSounds !== 1 ? "s" : ""}`,
    );
  }

  trackSounds[track] = soundProfile[track];
});
