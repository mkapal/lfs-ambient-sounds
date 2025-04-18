import path from "node:path";

console.log("ICU versions:", process.versions.icu);

process.env.NODE_ICU_DATA = path.join(process.cwd(), "full-icu-data");
console.log({ NODE_ICU_DATA: process.env.NODE_ICU_DATA });

import "./env.ts";

import fs from "node:fs";
import { InSimFlags, IS_ISI_ReqI, PacketType } from "npm:node-insim/packets";
import { InSim } from "npm:node-insim";
import { AudioContext } from "npm:node-web-audio-api";

import { lfsToMeters } from "./lfsConversions.ts";
import process from "node:process";

console.log("Connecting to InSim");

const inSim = new InSim();
inSim.connect({
  IName: "Sound",
  Host: process.env.HOST ?? "127.0.0.1",
  Port: process.env.PORT ? parseInt(process.env.PORT, 10) : 29999,
  Flags: InSimFlags.ISF_LOCAL | InSimFlags.ISF_MCI,
  ReqI: IS_ISI_ReqI.SEND_VERSION,
  Interval: 100,
});

inSim.on("connect", () => {
  console.log("Connected to InSim");
});

let viewPLID = 0;

inSim.on(PacketType.ISP_STA, (packet) => {
  viewPLID = packet.ViewPLID;
});

inSim.on(PacketType.ISP_VER, (packet) => {
  if (packet.ReqI !== IS_ISI_ReqI.SEND_VERSION) {
    return;
  }

  console.log("Connected to LFS", packet.Version);

  fs.readFile("public/SkidRoadHeavyMinor.wav", async (err, data) => {
    if (err) {
      console.log(err);
      return;
    }

    console.log("Sound loaded");

    const context = new AudioContext();
    // @ts-ignore test
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

  const forwardZ = -Math.cos(radians); // LFS +Y → WebAudio +Z
  const forwardX = Math.sin(radians); // LFS +X → WebAudio +X

  return { x: forwardX, y: 0, z: forwardZ };
}
