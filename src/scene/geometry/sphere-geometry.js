import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

/**
 * A procedural sphere-shaped geometry.
 *
 * The size and tesselation properties of the sphere can be controlled via constructor parameters. By
 * default, the function will create a sphere centered on the object space origin with a radius of
 * 0.5 and 16 segments in both longitude and latitude.
 *
 * Note that the sphere is created with UVs in the range of 0 to 1.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the sphere (defaults to 0.5).
 * @param {number} [opts.latitudeBands] - The number of divisions along the latitudinal axis of the
 * sphere (defaults to 16).
 * @param {number} [opts.longitudeBands] - The number of divisions along the longitudinal axis of
 * the sphere (defaults to 16).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @category Graphics
 */
class SphereGeometry extends Geometry {
    constructor(opts = {}) {
        super();

        // Check the supplied options and provide defaults for unspecified ones
        const radius = opts.radius ?? 0.5;
        const latitudeBands = opts.latitudeBands ?? 16;
        const longitudeBands = opts.longitudeBands ?? 16;

        // Variable declarations
        const positions = [];
        const normals = [];
        const uvs = [];
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
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                const u = 1 - lon / longitudeBands;
                const v = 1 - lat / latitudeBands;

                positions.push(x * radius, y * radius, z * radius);
                normals.push(x, y, z);
                uvs.push(u, 1 - v);
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

        this.positions = positions;
        this.normals = normals;
        this.uvs = uvs;
        this.uvs1 = uvs;    // UV1 = UV0 for sphere
        this.indices = indices;

        if (opts.calculateTangents) {
            this.tangents = calculateTangents(positions, normals, uvs, indices);
        }
    }
}

export { SphereGeometry };
