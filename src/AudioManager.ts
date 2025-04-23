import chalk from "chalk";
import fs from "fs";
import { AudioContext } from "node-web-audio-api";

import {
  headingToForwardVector,
  lfsToMeters,
  yRotationToVector,
} from "./conversions";
import type { TrackSoundConfig, TrackSoundConfigMap } from "./tracks";

type Position3D = {
  x: number;
  y: number;
  z: number;
};

export class AudioManager {
  private positionalContext: AudioContext;
  private globalContext: AudioContext;
  private readonly updateInterpolationTime = 0.05;
  private readonly soundBufferCache: Record<string, AudioBuffer> = {};

  constructor() {
    this.positionalContext = new AudioContext();
    this.globalContext = new AudioContext();
    this.resetListenerPosition();
  }

  async loadSounds(
    soundConfigMap: TrackSoundConfigMap,
    track: string,
  ): Promise<void> {
    this.positionalContext.close();
    this.globalContext.close();
    this.positionalContext = new AudioContext();
    this.globalContext = new AudioContext();
    this.resetListenerPosition();

    const soundsForTrack = soundConfigMap[track] ?? [];
    const soundsForTrackConfig = soundConfigMap[track.substring(0, 2)] ?? [];
    const allSounds = [...soundsForTrack, ...soundsForTrackConfig];

    for (const soundConfig of allSounds) {
      const index = allSounds.indexOf(soundConfig);
      await this.loadSound(soundConfig, index);
    }
  }

  updateListenerPosition({
    x,
    y,
    z,
    heading,
  }: Position3D & { heading: number }): void {
    if (this.positionalContext.state !== "running") return;

    const time =
      this.positionalContext.currentTime + this.updateInterpolationTime;
    const listener = this.positionalContext.listener;
    const forwardVector = headingToForwardVector(heading);

    listener.positionX.linearRampToValueAtTime(lfsToMeters(x), time);
    listener.positionY.linearRampToValueAtTime(lfsToMeters(z), time);
    listener.positionZ.linearRampToValueAtTime(lfsToMeters(y), time);
    listener.forwardX.linearRampToValueAtTime(forwardVector.x, time);
    listener.forwardY.linearRampToValueAtTime(forwardVector.y, time);
    listener.forwardZ.linearRampToValueAtTime(forwardVector.z, time);
  }

  resumePositionalSounds(): void {
    console.log(`Positional sounds: ${chalk.green("on")}`);
    this.positionalContext.resume();
  }

  pausePositionalSounds(): void {
    console.log(`Positional sounds: ${chalk.red("off")}`);
    this.positionalContext.suspend();
  }

  resumeGlobalSounds(): void {
    console.log(`Global sounds: ${chalk.green("on")}`);
    this.globalContext.resume();
  }

  pauseGlobalSounds(): void {
    console.log(`Global sounds: ${chalk.red("off")}`);
    this.globalContext.suspend();
  }

  private async loadSound(
    config: TrackSoundConfig,
    index: number,
  ): Promise<void> {
    const { file, x, y, z, gain } = config;
    const hasPosition = x !== undefined && y !== undefined && z !== undefined;
    const context = hasPosition ? this.positionalContext : this.globalContext;

    try {
      const source = context.createBufferSource();

      if (this.soundBufferCache[file]) {
        console.log(
          `Read sound #${index + 1} from cache: ${file} ${
            hasPosition ? `[${x}, ${y}, ${z}]` : ""
          }`,
        );
        source.buffer = this.soundBufferCache[file];
      } else {
        console.log(
          `Read sound #${index + 1} from file: ${file} ${
            hasPosition ? `[${x}, ${y}, ${z}]` : ""
          }`,
        );
        const data = await fs.promises.readFile(`sounds/${file}`);
        console.log(`${file} - ${data.byteLength} bytes`);
        source.buffer = await context.decodeAudioData(data.buffer);
        this.soundBufferCache[file] = source.buffer;
      }

      source.loop = true;

      const gainNode = context.createGain();
      gainNode.gain.value = gain;

      if (hasPosition) {
        const panner = this.createPanner(context, {
          ...config,
          x,
          y,
          z,
        });
        source.connect(gainNode).connect(panner).connect(context.destination);
      } else {
        source.connect(gainNode).connect(context.destination);
      }

      this.positionalContext.suspend();
      this.globalContext.suspend();

      source.start();

      console.log(
        chalk.green(
          `Sound #${index + 1} loaded: ${file} ${
            hasPosition ? `[${x},${y},${z}]` : ""
          }`,
        ),
      );
    } catch (error) {
      console.error(chalk.red(`Failed to load sound ${file}:`, error));
    }
  }

  private createPanner(
    context: AudioContext,
    { x, y, z, rotation }: Position3D & TrackSoundConfig,
  ): PannerNode {
    const orientationVector = yRotationToVector(rotation);
    console.log("Create panner");
    const panner = context.createPanner();
    console.log("Panner created");

    panner.panningModel = "HRTF";
    panner.positionX.value = x;
    panner.positionY.value = z;
    panner.positionZ.value = y;
    panner.orientationX.value = orientationVector.x;
    panner.orientationY.value = orientationVector.y;
    panner.orientationZ.value = orientationVector.z;

    return panner;
  }

  private resetListenerPosition(): void {
    const listener = this.positionalContext.listener;
    // Initial position
    listener.positionX.value = 0;
    listener.positionY.value = 0;
    listener.positionZ.value = 0;
    // Forward vector
    listener.forwardX.value = 0;
    listener.forwardY.value = 0;
    listener.forwardZ.value = -1;
    // Up vector
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  }
}
