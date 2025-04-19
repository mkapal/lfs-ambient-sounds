import "./title";

import chalk from "chalk";
import { InSim } from "node-insim";
import {
  InSimFlags,
  IS_ISI_ReqI,
  IS_TINY,
  PacketType,
  RaceState,
  StateFlags,
  TinyType,
  ViewIdentifier,
} from "node-insim/packets";

import {
  loadSounds,
  pauseGlobalSounds,
  pausePositionalSounds,
  resumeGlobalSounds,
  resumePositionalSounds,
  updateListenerPosition,
} from "./audio";
import { loadConfig } from "./config";
import { state } from "./state";
import type { Track } from "./tracks";

(async function () {
  const { config, trackSounds } = await loadConfig();

  console.log(`Connecting to ${config.insim.host}:${config.insim.port}`);

  const inSim = new InSim();
  inSim.connect({
    IName: "Sound",
    Host: config.insim.host,
    Port: config.insim.port,
    Admin: config.insim.admin,
    Flags: InSimFlags.ISF_LOCAL | InSimFlags.ISF_MCI,
    ReqI: IS_ISI_ReqI.SEND_VERSION,
    Interval: 100,
  });

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

    if (isSessionInProgress) {
      const inCarCameras = [
        ViewIdentifier.VIEW_DRIVER,
        ViewIdentifier.VIEW_CUSTOM,
      ];

      if (
        inCarCameras.includes(state.camera) &&
        (prevCamera !== state.camera ||
          (packet.Flags & StateFlags.ISS_SHIFTU) === 0)
      ) {
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
        loadSounds(trackSounds, state.track);

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

    // Wait for MCI packets to arrive before playing sounds
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
      if (info.PLID !== state.viewPLID) {
        return;
      }

      updateListenerPosition({
        x: info.X,
        y: info.Y,
        z: info.Z,
        heading: info.Heading,
      });
    });
  });
})();

process.on("uncaughtException", (error) => {
  console.error(chalk.red(error));
});
