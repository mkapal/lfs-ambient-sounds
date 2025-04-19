import type { ViewIdentifier } from "node-insim/packets";
import { AudioContext } from "node-web-audio-api";

import type { Track } from "./tracks";

export type State = {
  viewPLID: number;
  camera: ViewIdentifier | null;
  track: Track | null;
  positionalAudioContext: AudioContext;
  globalAudioContext: AudioContext;
};

export const state: State = {
  viewPLID: 0,
  camera: null,
  track: null,
  positionalAudioContext: new AudioContext(),
  globalAudioContext: new AudioContext(),
};
