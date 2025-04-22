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
import { gameState } from "./gameState";
import { loadTrackSoundConfigs } from "./tracks";

(async function () {
  const config = await loadConfig();
  const soundConfig = await loadTrackSoundConfigs(config.sounds.profile);

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

    console.log(chalk.green("Connected to LFS"));

    inSim.send(
      new IS_TINY({
        ReqI: 1,
        SubT: TinyType.TINY_SST,
      }),
    );
  });

  inSim.on(PacketType.ISP_STA, (packet) => {
    const prevTrack = gameState.track;
    const prevCamera = gameState.camera;

    gameState.viewPLID = packet.ViewPLID;
    gameState.camera = packet.InGameCam;
    gameState.track = packet.Track;

    const isSessionInProgress = packet.RaceInProg !== RaceState.NO_RACE;

    if (isSessionInProgress) {
      const inCarCameras = [
        ViewIdentifier.VIEW_DRIVER,
        ViewIdentifier.VIEW_CUSTOM,
      ];

      if (
        inCarCameras.includes(gameState.camera) &&
        (prevCamera !== gameState.camera ||
          (packet.Flags & StateFlags.ISS_SHIFTU) === 0)
      ) {
        resumePositionalSounds();
      } else {
        pausePositionalSounds();
      }
    }

    if (prevTrack !== gameState.track) {
      if (gameState.track === null) {
        pausePositionalSounds();
        pauseGlobalSounds();
      } else {
        loadSounds(soundConfig, gameState.track);

        if (!isSessionInProgress) {
          pausePositionalSounds();
          pauseGlobalSounds();
        } else {
          resumeGlobalSounds();
        }
      }
    }
  });

  inSim.on(PacketType.ISP_RST, () => {
    console.log("Session started");
    if (gameState.track === null) {
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
      if (info.PLID !== gameState.viewPLID) {
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
