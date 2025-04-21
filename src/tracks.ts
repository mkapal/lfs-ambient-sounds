import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import chalk from "chalk";
import { z } from "zod";
import { loadConfig as loadZodConfig } from "zod-config";
import { tomlAdapter } from "zod-config/toml-adapter";

const coordinateSchema = z.number().min(-32768).max(32767).optional();
const soundConfigSchema = z
  .object({
    file: z.string().min(1),
    x: coordinateSchema,
    y: coordinateSchema,
    z: coordinateSchema,
    refDistance: z.number().min(0).max(4096).optional().default(1),
    rolloffFactor: z.number().min(0).optional().default(1),
    gain: z.number().min(0).max(10).optional().default(1),
    coneInnerAngle: z.number().min(0).max(360).optional().default(360),
    coneOuterAngle: z.number().min(0).max(360).optional().default(0),
    coneOuterGain: z.number().min(0).max(1).optional().default(0),
    rotation: z.number().min(-360).max(360).optional().default(0),
  })
  .strict();
const trackSchema = z.array(soundConfigSchema).optional().default([]);

export type TrackSounds = Record<string, z.output<typeof soundConfigSchema>[]>;

export async function loadTrackSounds(profile: string) {
  const tomlPattern = new RegExp(
    String.raw`^([A-Z]{2}[\dRXY]?)(?:_${profile})?\.toml$`,
  );
  const tracksDir = path.join(process.cwd(), "tracks");
  const files = fs
    .readdirSync(tracksDir)
    .filter((file) => file.endsWith(".toml") && tomlPattern.test(file));

  const trackSounds: TrackSounds = {};

  for (const file of files) {
    const config = await loadZodConfig({
      schema: z
        .object({
          sound: trackSchema,
        })
        .strict(),
      adapters: tomlAdapter({
        path: path.join(tracksDir, file),
      }),
      onError: (error) => {
        console.error(chalk.red(`Error loading sound config from ${file}:`));
        console.error(
          error.errors
            .map((e) => `- ${e.path.join(" -> ")}: ${e.message}`)
            .join("\n"),
        );
        process.exit(1);
      },
    });
    const track = file.match(tomlPattern)?.[1];

    if (!track) {
      continue;
    }

    if (trackSounds[track]) {
      trackSounds[track].push(...config.sound);
    } else {
      trackSounds[track] = config.sound;
    }
    console.log(
      chalk.green(
        `Track configuration found: ${file} (${config.sound.length} sound${config.sound.length === 1 ? "" : "s"})`,
      ),
    );
  }

  return trackSounds;
}
