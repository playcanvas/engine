import { Debug } from "../../core/debug.js";
import { SKYMESH_BOX, SKYMESH_DOME, SKYMESH_INFINITE } from "../constants.js";
import { createBox, createMesh } from "../procedural.js";

class SkyGeometry {
    static create(device, type) {
        switch (type) {
            case SKYMESH_BOX: return SkyGeometry.box(device);
            case SKYMESH_DOME: return SkyGeometry.dome(device);
        }
        Debug.assert(type === SKYMESH_INFINITE, `Unsupported sky geometry type ${type}`);
        return SkyGeometry.infinite(device);
    }

    static infinite(device) {
        return createBox(device);
    }

    static box(device) {
        return createBox(device);
    }

    static dome(device) {
        // flatten bottom y-coordinate
        const bottomLimit = 0.1;

        // normalized distance from the center that is completely flat
        const curvatureRadius = 0.95;

        // derived values
        const invBottomLimit = 1 - bottomLimit;
        const curvatureRadiusSq = curvatureRadius * curvatureRadius;

        const radius = 0.5;
        const latitudeBands = 50;
        const longitudeBands = 50;
        const positions = [];
        const indices = [];

        for (let lat = 0; lat <= latitudeBands; lat++) {
            const theta = lat * Math.PI / latitudeBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= longitudeBands; lon++) {
                // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
                const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const x = cosPhi * sinTheta;
                let y = cosTheta;
                const z = sinPhi * sinTheta;

                if (y < 0) {

                    // scale vertices on the bottom
                    y *= 0.3;

                    // flatten the center
                    if (x * x + z * z < curvatureRadiusSq) {
                        y = -bottomLimit;
                    }
                }

                positions.push(x * radius, (y - invBottomLimit) * radius, z * radius);
            }
        }

        for (let lat = 0; lat < latitudeBands; ++lat) {
            for (let lon = 0; lon < longitudeBands; ++lon) {
                const first  = (lat * (longitudeBands + 1)) + lon;
                const second = first + longitudeBands + 1;

                indices.push(first + 1, second, first);
                indices.push(first + 1, second + 1, second);
            }
        }

        return createMesh(device, positions, {
            indices: indices
        });
    }
}

export { SkyGeometry };
