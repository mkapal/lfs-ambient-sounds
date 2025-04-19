export const tracks = [
  "BL",
  "SO",
  "FE",
  "AU",
  "KY",
  "AS",
  "WE",
  "RO",
  "LA",
] as const;

export type Track = (typeof tracks)[number];
