import chalk from "chalk";
import fs from "fs";
import { AudioContext } from "node-web-audio-api";

import {
  headingToForwardVector,
  lfsToMeters,
  yRotationToVector,
} from "./conversions";
import type { TrackSoundConfig } from "./tracks";

let positionalAudioContext = new AudioContext();
let globalAudioContext = new AudioContext();

export function loadSounds(soundConfig: TrackSoundConfig, track: string) {
  console.log(`Load sounds for track: ${track}`);

  positionalAudioContext = new AudioContext();
  globalAudioContext = new AudioContext();

  // Reset listener position
  positionalAudioContext.listener.positionX.value = 0;
  positionalAudioContext.listener.positionY.value = 0;
  positionalAudioContext.listener.positionZ.value = 0;
  positionalAudioContext.listener.forwardX.value = 0;
  positionalAudioContext.listener.forwardY.value = 0;
  positionalAudioContext.listener.forwardZ.value = -1;
  positionalAudioContext.listener.upX.value = 0;
  positionalAudioContext.listener.upY.value = 1;
  positionalAudioContext.listener.upZ.value = 0;

  const soundsForTrack = soundConfig[track] ?? [];
  const soundsForTrackConfig = soundConfig[track.substring(0, 2)] ?? [];

  [...soundsForTrack, ...soundsForTrackConfig].forEach(
    ({
      file,
      x,
      y,
      z,
      refDistance,
      rolloffFactor,
      gain,
      coneInnerAngle,
      coneOuterAngle,
      coneOuterGain,
      rotation,
    }) => {
      fs.readFile(`sounds/${file}`, async (err, data) => {
        if (err) {
          console.log(err);
          return;
        }

        const hasPosition =
          x !== undefined && y !== undefined && z !== undefined;
        const context = hasPosition
          ? positionalAudioContext
          : globalAudioContext;
        const buffer = await context.decodeAudioData(data.buffer);

        console.log(
          chalk.green(
            `${hasPosition ? "Positional" : "Global"} sound loaded: ${file}`,
          ),
        );

        const source = context.createBufferSource();
        source.buffer = buffer;

        const gainRef = context.createGain();
        gainRef.gain.value = gain;

        if (hasPosition) {
          const orientationVector = yRotationToVector(rotation);

          const panner = context.createPanner();

          panner.panningModel = "HRTF";
          panner.rolloffFactor = rolloffFactor;
          panner.refDistance = refDistance;
          panner.positionX.value = x;
          panner.positionY.value = z;
          panner.positionZ.value = y;
          panner.orientationX.value = orientationVector.x;
          panner.orientationY.value = orientationVector.y;
          panner.orientationZ.value = orientationVector.z;
          panner.coneInnerAngle = coneInnerAngle;
          panner.coneOuterAngle = coneOuterAngle;
          panner.coneOuterGain = coneOuterGain;

          source.connect(gainRef).connect(panner).connect(context.destination);
        } else {
          source.connect(gainRef).connect(context.destination);
        }

        positionalAudioContext.suspend();
        globalAudioContext.suspend();

        source.loop = true;
        source.start();
      });
    },
  );
}

export function resumePositionalSounds() {
  console.log(`Positional sounds: ${chalk.green("on")}`);
  positionalAudioContext.resume();
}

export function pausePositionalSounds() {
  console.log(`Positional sounds: ${chalk.red("off")}`);
  positionalAudioContext.suspend();
}

export function resumeGlobalSounds() {
  console.log(`Global sounds: ${chalk.green("on")}`);
  globalAudioContext.resume();
}

export function pauseGlobalSounds() {
  console.log(`Global sounds: ${chalk.red("off")}`);
  globalAudioContext.suspend();
}

export function updateListenerPosition({
  x,
  y,
  z,
  heading,
}: {
  x: number;
  y: number;
  z: number;
  heading: number;
}) {
  if (positionalAudioContext.state !== "running") {
    return;
  }

  const interpolationTime = 0.05;

  positionalAudioContext.listener.positionX.linearRampToValueAtTime(
    lfsToMeters(x),
    positionalAudioContext.currentTime + interpolationTime,
  );
  positionalAudioContext.listener.positionY.linearRampToValueAtTime(
    lfsToMeters(z),
    positionalAudioContext.currentTime + interpolationTime,
  );
  positionalAudioContext.listener.positionZ.linearRampToValueAtTime(
    lfsToMeters(y),
    positionalAudioContext.currentTime + interpolationTime,
  );

  const forwardVector = headingToForwardVector(heading);

  positionalAudioContext.listener.forwardX.linearRampToValueAtTime(
    forwardVector.x,
    positionalAudioContext.currentTime + interpolationTime,
  );
  positionalAudioContext.listener.forwardY.linearRampToValueAtTime(
    forwardVector.y,
    positionalAudioContext.currentTime + interpolationTime,
  );
  positionalAudioContext.listener.forwardZ.linearRampToValueAtTime(
    forwardVector.z,
    positionalAudioContext.currentTime + interpolationTime,
  );
}
