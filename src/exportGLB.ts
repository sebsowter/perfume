import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

export async function exportGLB(
  object: THREE.Object3D,
  filename = "bottle.glb",
) {
  const exporter = new GLTFExporter();

  const result = await exporter.parseAsync(object, {
    binary: true,

    /*
     * Only export objects that are currently visible.
     */
    onlyVisible: true,

    /*
     * Include custom userData if we add any later.
     */
    includeCustomExtensions: true,
  });

  if (!(result instanceof ArrayBuffer)) {
    throw new Error("Expected binary GLB export");
  }

  const blob = new Blob([result], {
    type: "model/gltf-binary",
  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);

  anchor.click();

  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
