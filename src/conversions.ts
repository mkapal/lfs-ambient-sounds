export function lfsToMeters(val: number) {
  return val / 65536;
}

export function headingToForwardVector(heading: number) {
  const radians = (heading / 65536) * 2 * Math.PI;

  const forwardZ = -Math.cos(radians);
  const forwardX = Math.sin(radians);

  return {
    x: forwardX,
    y: 0,
    z: forwardZ,
  };
}

export function yRotationToVector(degrees: number) {
  const radians = (degrees - 90) * (Math.PI / 180);
  const x = Math.cos(radians);
  const z = Math.sin(radians);

  return {
    x,
    y: 0,
    z,
  };
}
