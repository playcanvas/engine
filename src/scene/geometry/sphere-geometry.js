import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

/**
 * A procedural sphere-shaped geometry.
 *
 * Typically, you would:
 *
 * 1. Create a SphereGeometry instance.
 * 2. Generate a {@link Mesh} from the geometry.
 * 3. Create a {@link MeshInstance} referencing the mesh.
 * 4. Create an {@link Entity} with a {@link RenderComponent} and assign the {@link MeshInstance} to it.
 * 5. Add the entity to the {@link Scene}.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new pc.SphereGeometry();
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
class SphereGeometry extends Geometry {
    /**
     * Create a new SphereGeometry instance.
     *
     * By default, the constructor creates a sphere centered on the object space origin with a radius
     * of 0.5 and 16 segments in both longitude and latitude. The sphere is created with UVs in the
     * range of 0 to 1.
     *
     * @param {object} [opts] - Options object.
     * @param {number} [opts.radius] - The radius of the sphere. Defaults to 0.5.
     * @param {number} [opts.latitudeBands] - The number of divisions along the latitudinal axis of
     * the sphere. Defaults to 16.
     * @param {number} [opts.longitudeBands] - The number of divisions along the longitudinal axis of
     * the sphere. Defaults to 16.
     * @param {boolean} [opts.calculateTangents] - Generate tangent information. Defaults to false.
     * @example
     * const geometry = new pc.SphereGeometry({
     *     radius: 1,
     *     latitudeBands: 32,
     *     longitudeBands: 32
     * });
     */
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
