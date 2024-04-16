import { Vec2 } from '../../core/math/vec2.js';
import { calculateTangents, createMesh } from './create-mesh.js';

/**
 * Creates a procedural plane-shaped mesh.
 *
 * The size and tesselation properties of the plane can be controlled via function parameters. By
 * default, the function will create a plane centered on the object space origin with a width and
 * length of 1.0 and 5 segments in either axis (50 triangles). The normal vector of the plane is
 * aligned along the positive Y axis.
 *
 * Note that the plane is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the plane's mesh.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec2} [opts.halfExtents] - The half dimensions of the plane in the X and Z axes
 * (defaults to [0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the plane
 * (defaults to 5).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the plane
 * (defaults to 5).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @param {boolean} [opts.storageVertex] - Defines if the vertex buffer of the mesh can be used as
 * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
 * @param {boolean} [opts.storageIndex] - Defines if the index buffer of the mesh can be used as
 * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
 * @returns {import('../mesh.js').Mesh} A new plane-shaped mesh.
 * @category Graphics
 */
function createPlane(device, opts = {}) {
    // Check the supplied options and provide defaults for unspecified ones
    const he = opts.halfExtents ?? new Vec2(0.5, 0.5);
    const ws = opts.widthSegments ?? 5;
    const ls = opts.lengthSegments ?? 5;
    const calcTangents = opts.calculateTangents ?? false;

    // Variable declarations
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Generate plane as follows (assigned UVs denoted at corners):
    // (0,1)x---------x(1,1)
    //      |         |
    //      |         |
    //      |    O--X |length
    //      |    |    |
    //      |    Z    |
    // (0,0)x---------x(1,0)
    // width
    let vcounter = 0;

    for (let i = 0; i <= ws; i++) {
        for (let j = 0; j <= ls; j++) {
            const x = -he.x + 2 * he.x * i / ws;
            const y = 0.0;
            const z = -(-he.y + 2 * he.y * j / ls);
            const u = i / ws;
            const v = j / ls;

            positions.push(x, y, z);
            normals.push(0, 1, 0);
            uvs.push(u, 1 - v);

            if ((i < ws) && (j < ls)) {
                indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
                indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
            }

            vcounter++;
        }
    }

    const options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs, // UV1 = UV0 for plane
        indices: indices
    };

    options.storageVertex = opts.storageVertex;
    options.storageIndex = opts.storageIndex;

    if (calcTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

export { createPlane };
