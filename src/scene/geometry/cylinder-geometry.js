import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

/**
 * A procedural cylinder-shaped geometry.
 *
 * The size, shape and tesselation properties of the cylinder can be controlled via constructor
 * parameters. By default, the function will create a cylinder standing vertically centered on the
 * XZ-plane with a radius of 0.5, a height of 1.0, 1 height segment and 20 cap segments.
 *
 * Note that the cylinder is created with UVs in the range of 0 to 1.
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
 * @category Graphics
 */
class CylinderGeometry extends ConeBaseGeometry {
    constructor(opts = {}) {

        // Check the supplied options and provide defaults for unspecified ones
        const radius = opts.radius ?? 0.5;
        const height = opts.height ?? 1;
        const heightSegments = opts.heightSegments ?? 5;
        const capSegments = opts.capSegments ?? 20;

        // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
        super(radius, radius, height, heightSegments, capSegments, false);

        if (opts.calculateTangents) {
            this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
        }
    }
}

export { CylinderGeometry };
