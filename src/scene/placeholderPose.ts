import { Group, Mesh, Object3D } from 'three';
/** Pose only the known original placeholder layout; never modify a replacement rig. */
export function posePlaceholderArms(copy: Object3D) {
  if (!copy.children.some(child => child.name.startsWith('Placeholder'))) return;
  const parents: Object3D[] = [];
  copy.traverse(object => {
    if (object.children.some(c => c instanceof Mesh && Math.abs(c.position.x) > .13 && c.position.y > .44 && c.position.y < .74)) parents.push(object);
  });
  copy.updateMatrixWorld(true);
  for (const parent of parents) for (const side of [-1,1]) {
    const arm = parent.children.filter(child => child instanceof Mesh && child.position.x * side > .13 && child.position.x * side < .25 && child.position.y > .44 && child.position.y < .74 && child.position.z < .1);
    if (!arm.length) continue;
    const shoulder = new Group(); shoulder.name = 'Cinematic shoulder'; shoulder.position.set(side*.12,.715,0); parent.add(shoulder); shoulder.updateWorldMatrix(true,false);
    for (const mesh of arm) shoulder.attach(mesh);
    shoulder.rotation.x = -1.45;
  }
}
