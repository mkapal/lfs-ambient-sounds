import "./title";

import chalk from "chalk";
import fs from "fs";
import { InSim } from "node-insim";
import {
  InSimFlags,
  IS_ISI_ReqI,
  IS_TINY,
  PacketType,
  TinyType,
} from "node-insim/packets";
import { AudioContext } from "node-web-audio-api";

import { config } from "./config";
import { lfsToMeters } from "./lfsConversions";

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

let viewPLID = 0;

inSim.on(PacketType.ISP_STA, (packet) => {
  viewPLID = packet.ViewPLID;
});

inSim.on(PacketType.ISP_RST, (packet) => {});

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

  fs.readFile("sound/birds.mp3", async (err, data) => {
    if (err) {
      console.log(err);
      return;
    }

    console.log("Sound loaded");

    const context = new AudioContext();
    const buffer = await context.decodeAudioData(data.buffer);

    const source = context.createBufferSource();
    source.buffer = buffer;

    const panner = context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 3;
    panner.rolloffFactor = 1.5;
    panner.maxDistance = 100;
    panner.positionX.value = 0;
    panner.positionY.value = 2;
    panner.positionZ.value = 0;
    panner.orientationX.value = 1;
    panner.orientationY.value = 0;
    panner.orientationZ.value = 0;

    context.listener.positionX.value = 0;
    context.listener.positionY.value = 0;
    context.listener.positionZ.value = 0;
    context.listener.forwardX.value = 0;
    context.listener.forwardY.value = 0;
    context.listener.forwardZ.value = -1;
    context.listener.upX.value = 0;
    context.listener.upY.value = 1;
    context.listener.upZ.value = 0;

    source.connect(panner).connect(context.destination);
    source.loop = true;
    source.start(0);

    inSim.on(PacketType.ISP_MCI, (packet) => {
      packet.Info.forEach((info) => {
        if (info.PLID === viewPLID) {
          context.listener.positionX.value = lfsToMeters(info.X);
          context.listener.positionY.value = lfsToMeters(info.Z);
          context.listener.positionZ.value = lfsToMeters(info.Y);

          const forwardVector = headingToForwardVector(info.Heading);
          context.listener.forwardX.value = forwardVector.x;
          context.listener.forwardY.value = forwardVector.y;
          context.listener.forwardZ.value = forwardVector.z;
        }
      });
    });
  });
});

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
