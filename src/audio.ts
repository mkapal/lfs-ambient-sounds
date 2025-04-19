import fs from "fs";
import { AudioContext } from "node-web-audio-api";

import type { TrackSounds } from "./config";
import {
  headingToForwardVector,
  lfsToMeters,
  yRotationToVector,
} from "./conversions";
import { state } from "./state";
import type { Track } from "./tracks";

export function loadSounds(trackSounds: TrackSounds, track: Track) {
  console.log(`Load sounds for track: ${track}`);

  state.positionalAudioContext = new AudioContext();
  state.globalAudioContext = new AudioContext();

  // Reset listener position
  state.positionalAudioContext.listener.positionX.value = 0;
  state.positionalAudioContext.listener.positionY.value = 0;
  state.positionalAudioContext.listener.positionZ.value = 0;
  state.positionalAudioContext.listener.forwardX.value = 0;
  state.positionalAudioContext.listener.forwardY.value = 0;
  state.positionalAudioContext.listener.forwardZ.value = -1;
  state.positionalAudioContext.listener.upX.value = 0;
  state.positionalAudioContext.listener.upY.value = 1;
  state.positionalAudioContext.listener.upZ.value = 0;

  trackSounds[track].forEach(
    ({
      sound,
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
      fs.readFile(`sounds/${sound}`, async (err, data) => {
        if (err) {
          console.log(err);
          return;
        }

        const hasPosition =
          x !== undefined && y !== undefined && z !== undefined;
        const context = hasPosition
          ? state.positionalAudioContext
          : state.globalAudioContext;
        const buffer = await context.decodeAudioData(data.buffer);

        console.log(
          `Sound loaded (${hasPosition ? "positional" : "global"}): ${sound}`,
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

        state.positionalAudioContext.suspend();
        state.globalAudioContext.suspend();

        source.loop = true;
        source.start();
      });
    },
  );
}

export function resumePositionalSounds() {
  console.log("Play positional sounds");
  state.positionalAudioContext.resume();
}

export function pausePositionalSounds() {
  console.log("Pause positional sounds");
  state.positionalAudioContext.suspend();
}

export function resumeGlobalSounds() {
  console.log("Play global sounds");
  state.globalAudioContext.resume();
}

export function pauseGlobalSounds() {
  console.log("Pause global sounds");
  state.globalAudioContext.suspend();
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
  if (state.positionalAudioContext.state !== "running") {
    return;
  }

  const interpolationTime = 0.05;

  state.positionalAudioContext.listener.positionX.linearRampToValueAtTime(
    lfsToMeters(x),
    state.positionalAudioContext.currentTime + interpolationTime,
  );
  state.positionalAudioContext.listener.positionY.linearRampToValueAtTime(
    lfsToMeters(z),
    state.positionalAudioContext.currentTime + interpolationTime,
  );
  state.positionalAudioContext.listener.positionZ.linearRampToValueAtTime(
    lfsToMeters(y),
    state.positionalAudioContext.currentTime + interpolationTime,
  );

  const forwardVector = headingToForwardVector(heading);

  state.positionalAudioContext.listener.forwardX.linearRampToValueAtTime(
    forwardVector.x,
    state.positionalAudioContext.currentTime + interpolationTime,
  );
  state.positionalAudioContext.listener.forwardY.linearRampToValueAtTime(
    forwardVector.y,
    state.positionalAudioContext.currentTime + interpolationTime,
  );
  state.positionalAudioContext.listener.forwardZ.linearRampToValueAtTime(
    forwardVector.z,
    state.positionalAudioContext.currentTime + interpolationTime,
  );
}
