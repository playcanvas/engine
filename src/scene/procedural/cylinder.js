import { createConeData } from './cone-data.js';
import { calculateTangents, createMesh } from './create-mesh.js';

/**
 * Creates a procedural cylinder-shaped mesh.
 *
 * The size, shape and tesselation properties of the cylinder can be controlled via function
 * parameters. By default, the function will create a cylinder standing vertically centered on the
 * XZ-plane with a radius of 0.5, a height of 1.0, 1 height segment and 20 cap segments.
 *
 * Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the cylinder's mesh.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the cylinder
 * (defaults to 0.5).
 * @param {number} [opts.height] - The length of the body of the cylinder (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cylinder
 * (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the
 * cylinder (defaults to 20).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @param {boolean} [opts.storageVertex] - Defines if the vertex buffer of the mesh can be used as
 * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
 * @param {boolean} [opts.storageIndex] - Defines if the index buffer of the mesh can be used as
 * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
 * @returns {import('../mesh.js').Mesh} A new cylinder-shaped mesh.
 * @category Graphics
 */
function createCylinder(device, opts = {}) {
    // Check the supplied options and provide defaults for unspecified ones
    const radius = opts.radius ?? 0.5;
    const height = opts.height ?? 1;
    const heightSegments = opts.heightSegments ?? 5;
    const capSegments = opts.capSegments ?? 20;
    const calcTangents = opts.calculateTangents ?? false;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    const options = createConeData(radius, radius, height, heightSegments, capSegments, false);

    if (calcTangents) {
        options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    options.storageVertex = opts.storageVertex;
    options.storageIndex = opts.storageIndex;

    return createMesh(device, options.positions, options);
}

export { createCylinder };
