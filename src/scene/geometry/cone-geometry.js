import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

/**
 * A procedural cone-shaped geometry.
 *
 * Typically, you would:
 *
 * 1. Create a ConeGeometry instance.
 * 2. Generate a {@link Mesh} from the geometry.
 * 3. Create a {@link MeshInstance} referencing the mesh.
 * 4. Create an {@link Entity} with a {@link RenderComponent} and assign the {@link MeshInstance} to it.
 * 5. Add the entity to the {@link Scene}.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new pc.ConeGeometry();
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
class ConeGeometry extends ConeBaseGeometry {
    /**
     * Create a new ConeGeometry instance.
     *
     * By default, the constructor creates a cone standing vertically centered on the XZ-plane with
     * a base radius of 0.5, a height of 1.0, 5 height segments and 18 cap segments. The cone is
     * created with UVs in the range of 0 to 1.
     *
     * @param {object} [opts] - Options object.
     * @param {number} [opts.baseRadius] - The base radius of the cone. Defaults to 0.5.
     * @param {number} [opts.peakRadius] - The peak radius of the cone. Defaults to 0.
     * @param {number} [opts.height] - The length of the body of the cone. Defaults to 1.
     * @param {number} [opts.heightSegments] - The number of divisions along the length of the cone.
     * Defaults to 5.
     * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the
     * cone. Defaults to 18.
     * @param {boolean} [opts.calculateTangents] - Generate tangent information. Defaults to false.
     * @example
     * const geometry = new pc.ConeGeometry({
     *     baseRadius: 1,
     *     height: 2,
     *     heightSegments: 2,
     *     capSegments: 20
     * });
     */
    constructor(opts = {}) {

        // Check the supplied options and provide defaults for unspecified ones
        const baseRadius = opts.baseRadius ?? 0.5;
        const peakRadius = opts.peakRadius ?? 0;
        const height = opts.height ?? 1;
        const heightSegments = opts.heightSegments ?? 5;
        const capSegments = opts.capSegments ?? 18;

        super(baseRadius, peakRadius, height, heightSegments, capSegments, false);

        if (opts.calculateTangents) {
            this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
        }
    }
}

export { ConeGeometry };
