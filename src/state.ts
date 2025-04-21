import type { ViewIdentifier } from "node-insim/packets";
import { AudioContext } from "node-web-audio-api";

export type State = {
  viewPLID: number;
  camera: ViewIdentifier | null;
  track: string | null;
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
