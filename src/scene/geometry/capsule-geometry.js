import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

/**
 * A procedural capsule-shaped geometry.
 *
 * Typically, you would:
 *
 * 1. Create a CapsuleGeometry instance.
 * 2. Generate a {@link Mesh} from the geometry.
 * 3. Create a {@link MeshInstance} referencing the mesh.
 * 4. Create an {@link Entity} with a {@link RenderComponent} and assign the {@link MeshInstance} to it.
 * 5. Add the entity to the {@link Scene}.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new pc.CapsuleGeometry();
 * const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry);
 * const material = new pc.StandardMaterial();
 * const meshInstance = new pc.MeshInstance(mesh, material);
 *
 * // Create an entity
 * const entity = new pc.Entity();
 * entity.addComponent('render', {
 *     meshInstances: [meshInstance]
 * });
 *
 * // Add the entity to the scene hierarchy
 * app.scene.root.addChild(entity);
 * ```
 *
 * @category Graphics
 */
class CapsuleGeometry extends ConeBaseGeometry {
    /**
     * Create a new CapsuleGeometry instance.
     *
     * By default, the constructor creates a capsule standing vertically centered on the XZ-plane
     * with a radius of 0.3, a height of 1.0, 1 height segment and 20 cap segments. The capsule is
     * created with UVs in the range of 0 to 1.
     *
     * @param {object} [opts] - Options object.
     * @param {number} [opts.radius] - The radius of the tube forming the body of the capsule.
     * Defaults to 0.3.
     * @param {number} [opts.height] - The length of the body of the capsule from tip to tip.
     * Defaults to 1.
     * @param {number} [opts.heightSegments] - The number of divisions along the tubular length of
     * the capsule. Defaults to 1.
     * @param {number} [opts.sides] - The number of divisions around the tubular body of the capsule.
     * Defaults to 20.
     * @param {boolean} [opts.calculateTangents] - Generate tangent information. Defaults to false.
     * @example
     * const geometry = new pc.CapsuleGeometry({
     *     radius: 1,
     *     height: 2,
     *     heightSegments: 2,
     *     sides: 20
     * });
     */
    constructor(opts = {}) {

        // Check the supplied options and provide defaults for unspecified ones
        const radius = opts.radius ?? 0.3;
        const height = opts.height ?? 1;
        const heightSegments = opts.heightSegments ?? 1;
        const sides = opts.sides ?? 20;

        // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
        super(radius, radius, height - 2 * radius, heightSegments, sides, true);

        if (opts.calculateTangents) {
            this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
        }
    }
}

export { CapsuleGeometry };
