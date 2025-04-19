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
  audioContext: AudioContext;
  audioSources: AudioBufferSourceNode[];
} = {
  viewPLID: 0,
  camera: null,
  track: null as Track | null,
  audioContext: new AudioContext(),
  audioSources: [],
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
      resume();
    } else {
      pause();
    }
  }

  if (prevTrack !== state.track) {
    if (state.track === null) {
      pause();
    } else {
      initializeTrackSounds(state.track);
      if (!isSessionInProgress) {
        pause();
      }
    }
  }
});

inSim.on(PacketType.ISP_RST, () => {
  console.log("Race started");
  if (state.track === null) {
    return;
  }

  setTimeout(() => {
    resume();
  }, 1000);
});

inSim.on(PacketType.ISP_TINY, (packet) => {
  if (packet.SubT === TinyType.TINY_REN) {
    pause();
  }
});

inSim.on(PacketType.ISP_MCI, (packet) => {
  packet.Info.forEach((info) => {
    if (info.PLID === state.viewPLID) {
      state.audioContext.listener.positionX.value = lfsToMeters(info.X);
      state.audioContext.listener.positionY.value = lfsToMeters(info.Z);
      state.audioContext.listener.positionZ.value = lfsToMeters(info.Y);

      const forwardVector = headingToForwardVector(info.Heading);
      state.audioContext.listener.forwardX.value = forwardVector.x;
      state.audioContext.listener.forwardY.value = forwardVector.y;
      state.audioContext.listener.forwardZ.value = forwardVector.z;
    }
  });
});

function initializeTrackSounds(track: Track) {
  state.audioSources = [];

  console.log(`Load sounds for track: ${track}`);

  // Reset listener position
  state.audioContext.listener.positionX.value = 0;
  state.audioContext.listener.positionY.value = 0;
  state.audioContext.listener.positionZ.value = 0;
  state.audioContext.listener.forwardX.value = 0;
  state.audioContext.listener.forwardY.value = 0;
  state.audioContext.listener.forwardZ.value = -1;
  state.audioContext.listener.upX.value = 0;
  state.audioContext.listener.upY.value = 1;
  state.audioContext.listener.upZ.value = 0;

  trackSounds[track].forEach(({ x, y, z, sound }) => {
    fs.readFile(`sounds/${sound}`, async (err, data) => {
      if (err) {
        console.log(err);
        return;
      }

      const buffer = await state.audioContext.decodeAudioData(data.buffer);
      console.log(`Sound loaded: ${sound}`);

      const source = state.audioContext.createBufferSource();
      state.audioSources.push(source);
      source.buffer = buffer;

      const panner = state.audioContext.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 3;
      panner.rolloffFactor = 1.5;
      panner.maxDistance = 100;
      panner.positionX.value = x;
      panner.positionY.value = z;
      panner.positionZ.value = y;
      panner.orientationX.value = 1;
      panner.orientationY.value = 0;
      panner.orientationZ.value = 0;

      source.connect(panner).connect(state.audioContext.destination);
      source.loop = true;
      source.start();
    });
  });
}

function resume() {
  console.log("Resume");
  state.audioContext.resume();
}

function pause() {
  console.log("Pause");
  state.audioContext.suspend();
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
