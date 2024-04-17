import { calculateTangents, createMesh } from './create-mesh.js';

/**
 * Creates a procedural sphere-shaped mesh.
 *
 * The size and tesselation properties of the sphere can be controlled via function parameters. By
 * default, the function will create a sphere centered on the object space origin with a radius of
 * 0.5 and 16 segments in both longitude and latitude.
 *
 * Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the sphere's mesh.
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
 * @param {boolean} [opts.storageVertex] - Defines if the vertex buffer of the mesh can be used as
 * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
 * @param {boolean} [opts.storageIndex] - Defines if the index buffer of the mesh can be used as
 * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
 * @returns {import('../mesh.js').Mesh} A new sphere-shaped mesh.
 * @category Graphics
 */
function createSphere(device, opts = {}) {
    // Check the supplied options and provide defaults for unspecified ones
    const radius = opts.radius ?? 0.5;
    const latitudeBands = opts.latitudeBands ?? 16;
    const longitudeBands = opts.longitudeBands ?? 16;
    const calcTangents = opts.calculateTangents ?? false;

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

    const options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs, // UV1 = UV0 for sphere
        indices: indices,
        storageVertex: opts.storageVertex,
        storageIndex: opts.storageIndex
    };

    if (calcTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

export { createSphere };
