// TODO
export default function parseLFSMessage(msg: Uint8Array | string): string {
  if (typeof msg === "string") {
    return msg;
  }

  return new TextDecoder().decode(msg);
}
