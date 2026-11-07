export const sceneCameraPosition: [number, number, number] = [5, 10, 13.5]
export const sceneCameraTarget: [number, number, number] = [0, -.65, 0]

/** Preserve a visible border around all corners on portrait and landscape arenas. */
export function getSceneFov(aspect: number) {
  return 2 * Math.atan(Math.tan(30 * Math.PI / 360) / Math.min(1, aspect / 1.4)) * 180 / Math.PI
}
