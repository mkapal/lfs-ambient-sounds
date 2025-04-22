import type { ViewIdentifier } from "node-insim/packets";

export type GameState = {
  viewPLID: number;
  camera: ViewIdentifier | null;
  track: string | null;
};

export const gameState: GameState = {
  viewPLID: 0,
  camera: null,
  track: null,
};
