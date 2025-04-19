import "./title";

import chalk from "chalk";
import fs from "fs";
import { InSim } from "node-insim";
import { ViewIdentifier } from "node-insim/packets";
import {
  InSimFlags,
  IS_ISI_ReqI,
  IS_TINY,
  PacketType,
  RaceState,
  TinyType,
} from "node-insim/packets";
import { AudioContext } from "node-web-audio-api";

import { config, trackSounds } from "./config";
import { lfsToMeters } from "./lfsConversions";
import type { Track } from "./tracks";

const inSim = new InSim();

console.log(`Connecting to ${config.insim.host}:${config.insim.port}`);

inSim.connect({
  IName: "Sound",
  Host: config.insim.host,
  Port: config.insim.port,
  Admin: config.insim.admin,
  Flags: InSimFlags.ISF_LOCAL | InSimFlags.ISF_MCI,
  ReqI: IS_ISI_ReqI.SEND_VERSION,
  Interval: 100,
});

const state: {
  viewPLID: number;
  camera: ViewIdentifier | null;
  track: Track | null;
  positionalAudioContext: AudioContext;
  globalAudioContext: AudioContext;
} = {
  viewPLID: 0,
  camera: null,
  track: null as Track | null,
  positionalAudioContext: new AudioContext(),
  globalAudioContext: new AudioContext(),
};

inSim.on(PacketType.ISP_VER, (packet) => {
  if (packet.ReqI !== IS_ISI_ReqI.SEND_VERSION) {
    return;
  }

  console.log("Connected to LFS");

  inSim.send(
    new IS_TINY({
      ReqI: 1,
      SubT: TinyType.TINY_SST,
    }),
  );
});

inSim.on(PacketType.ISP_STA, (packet) => {
  const prevTrack = state.track;
  const prevCamera = state.camera;

  state.viewPLID = packet.ViewPLID;
  state.camera = packet.InGameCam;
  state.track = packet.Track.substring(0, 2) as Track;

  const isSessionInProgress = packet.RaceInProg !== RaceState.NO_RACE;

  if (isSessionInProgress && prevCamera !== state.camera) {
    console.log("Camera changed");
    if (state.camera === ViewIdentifier.VIEW_DRIVER) {
      resumePositionalSounds();
    } else {
      pausePositionalSounds();
    }
  }

  if (prevTrack !== state.track) {
    if (state.track === null) {
      pausePositionalSounds();
      pauseGlobalSounds();
    } else {
      loadSounds(state.track);
      if (!isSessionInProgress) {
        pausePositionalSounds();
        pauseGlobalSounds();
      }
    }
  }
});

inSim.on(PacketType.ISP_RST, () => {
  console.log("Session started");
  if (state.track === null) {
    return;
  }

  setTimeout(() => {
    resumePositionalSounds();
    resumeGlobalSounds();
  }, 1000);
});

inSim.on(PacketType.ISP_TINY, (packet) => {
  if (packet.SubT === TinyType.TINY_REN) {
    console.log("Session ended");
    pausePositionalSounds();
    pauseGlobalSounds();
  }
});

inSim.on(PacketType.ISP_MCI, (packet) => {
  packet.Info.forEach((info) => {
    if (info.PLID === state.viewPLID) {
      state.positionalAudioContext.listener.positionX.value = lfsToMeters(
        info.X,
      );
      state.positionalAudioContext.listener.positionY.value = lfsToMeters(
        info.Z,
      );
      state.positionalAudioContext.listener.positionZ.value = lfsToMeters(
        info.Y,
      );

      const forwardVector = headingToForwardVector(info.Heading);
      state.positionalAudioContext.listener.forwardX.value = forwardVector.x;
      state.positionalAudioContext.listener.forwardY.value = forwardVector.y;
      state.positionalAudioContext.listener.forwardZ.value = forwardVector.z;
    }
  });
});

function loadSounds(track: Track) {
  console.log(`Load sounds for track: ${track}`);

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

  trackSounds[track].forEach(({ sound, x, y, z, refDistance, maxDistance }) => {
    fs.readFile(`sounds/${sound}`, async (err, data) => {
      if (err) {
        console.log(err);
        return;
      }

      const hasPosition = x !== undefined && y !== undefined && z !== undefined;
      const context = hasPosition
        ? state.positionalAudioContext
        : state.globalAudioContext;
      const buffer = await context.decodeAudioData(data.buffer);

      console.log(
        `Sound loaded (${hasPosition ? "positional" : "global"}): ${sound}`,
      );

      const source = context.createBufferSource();
      source.buffer = buffer;

      if (hasPosition) {
        const panner = context.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = refDistance;
        panner.rolloffFactor = 1.5;
        panner.maxDistance = maxDistance;
        panner.positionX.value = x;
        panner.positionY.value = z;
        panner.positionZ.value = y;
        panner.orientationX.value = 1;
        panner.orientationY.value = 0;
        panner.orientationZ.value = 0;

        source.connect(panner).connect(context.destination);
      } else {
        source.connect(context.destination);
      }

      source.loop = true;
      source.start();
    });
  });
}

function resumePositionalSounds() {
  console.log("Resume positional sounds");
  state.positionalAudioContext.resume();
}

function pausePositionalSounds() {
  console.log("Pause positional sounds");
  state.positionalAudioContext.suspend();
}

function resumeGlobalSounds() {
  console.log("Resume global sounds");
  state.globalAudioContext.resume();
}

function pauseGlobalSounds() {
  console.log("Pause global sounds");
  state.globalAudioContext.suspend();
}

function headingToForwardVector(heading: number) {
  const radians = (heading / 65536) * 2 * Math.PI;

  const forwardZ = -Math.cos(radians);
  const forwardX = Math.sin(radians);

  return {
    x: forwardX,
    y: 0,
    z: forwardZ,
  };
}

process.on("uncaughtException", (error) => {
  console.error(chalk.red(error));
});
