import { Vec3 } from "../../core/math/vec3.js";
import { LIGHTTYPE_DIRECTIONAL } from "../constants.js";

const lightCubeDir = [
    new Vec3(-1, 0, 0),
    new Vec3(1, 0, 0),
    new Vec3(0, -1, 0),
    new Vec3(0, 1, 0),
    new Vec3(0, 0, -1),
    new Vec3(0, 0, 1)
];

/**
 * A lighting cube represented by 6 colors, one per cube direction. Use for simple lighting on the
 * particle system.
 *
 * @ignore
 */
class LightCube {
    colors = new Float32Array(6 * 3);

    update(ambientLight, lights) {
        const colors = this.colors;

        // ambient contribution
        const { r, g, b } = ambientLight;
        for (let j = 0; j < 6; j++) {
            colors[j * 3] = r;
            colors[j * 3 + 1] = g;
            colors[j * 3 + 2] = b;
        }

        // directional contribution
        for (let j = 0; j < lights.length; j++) {
            const light = lights[j];
            if (light._type === LIGHTTYPE_DIRECTIONAL) {
                for (let c = 0; c < 6; c++) {
                    const weight = Math.max(lightCubeDir[c].dot(light._direction), 0) * light._intensity;
                    const lightColor = light._color;
                    colors[c * 3] += lightColor.r * weight;
                    colors[c * 3 + 1] += lightColor.g * weight;
                    colors[c * 3 + 2] += lightColor.b * weight;
                }
            }
        }
    }
}

export { LightCube };
