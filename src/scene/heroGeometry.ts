import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

/** Open, tapered crescents with longitudinal ridges; no reference images/text baked in. */
export function energyCrescent(radius: number, width: number, segments: number, flame = false, sweep = Math.PI * 1.6) {
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, a = (t - .5) * sweep;
    const taper = Math.pow(Math.max(0, Math.sin(t * Math.PI)), .7);
    const edge = radius + (flame ? Math.sin(t * 63) * .09 * taper : 0);
    for (const r of [edge - width * taper, edge]) vertices.push(Math.cos(a) * r, Math.sin(a) * r, Math.sin(t * 16) * .025);
    if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic sharp lightning branches, stable across re-renders and clients. */
export function lightningPath(seed: number, height = 1.8, count = 15) {
  return Array.from({ length: count }, (_, j) => new Vector3(
    Math.sin(j * 7.7 + seed * 2.3) * .12,
    j * height / (count - 1) - height / 2,
    Math.cos(j * 5.3 + seed) * .05,
  ));
}
