// Project eight lights through a rotating ring that gradually folds into a figure eight.
export function orbitPoint (index: number, time: number, clockAngle = 0): {x: number; y: number; z: number} {
  const phase = index * Math.PI / 4 + time * 0.58 + clockAngle * Math.PI / 180;
  const fold = (1 - Math.cos(time * 0.16)) / 2;
  const x = Math.cos(phase) * 0.72;
  const y = Math.sin(phase) * 0.72 * (1 - fold) + Math.sin(phase * 2) * 0.56 * fold;
  const z = Math.sin(phase + time * 0.19) * 0.48 * fold;
  const yaw = time * 0.24;
  const pitch = 0.65 + Math.sin(time * 0.12) * 0.75;
  const roll = time * 0.13;
  const a = x * Math.cos(yaw) + z * Math.sin(yaw);
  const b = z * Math.cos(yaw) - x * Math.sin(yaw);
  const c = y * Math.cos(pitch) - b * Math.sin(pitch);
  const depth = y * Math.sin(pitch) + b * Math.cos(pitch);
  const projection = 2.8 / (2.8 - depth * 0.55);
  return {x: (a * Math.cos(roll) - c * Math.sin(roll)) * projection,
    y: (a * Math.sin(roll) + c * Math.cos(roll)) * projection, z: depth};
}
