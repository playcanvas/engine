import { math } from '../../core/math/math.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

/**
 * A procedural torus-shaped geometry.
 *
 * Typically, you would:
 *
 * 1. Create a TorusGeometry instance.
 * 2. Generate a {@link Mesh} from the geometry.
 * 3. Create a {@link MeshInstance} referencing the mesh.
 * 4. Create an {@link Entity} with a {@link RenderComponent} and assign the {@link MeshInstance} to it.
 * 5. Add the entity to the {@link Scene}.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new pc.TorusGeometry();
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
class TorusGeometry extends Geometry {
    /**
     * Create a new TorusGeometry instance.
     *
     * By default, the constructor creates a torus in the XZ-plane with a tube radius of 0.2, a ring
     * radius of 0.3, 30 segments and 20 sides. The torus is created with UVs in the range of 0 to 1.
     *
     * @param {object} [opts] - Options object.
     * @param {number} [opts.tubeRadius] - The radius of the tube forming the body of the torus.
     * Defaults to 0.2.
     * @param {number} [opts.ringRadius] - The radius from the centre of the torus to the centre of the
     * tube. Defaults to 0.3.
     * @param {number} [opts.sectorAngle] - The sector angle in degrees of the ring of the torus.
     * Defaults to 2 * Math.PI.
     * @param {number} [opts.segments] - The number of radial divisions forming cross-sections of the
     * torus ring. Defaults to 20.
     * @param {number} [opts.sides] - The number of divisions around the tubular body of the torus ring.
     * Defaults to 30.
     * @param {boolean} [opts.calculateTangents] - Generate tangent information. Defaults to false.
     * @example
     * const geometry = new pc.TorusGeometry({
     *     tubeRadius: 1,
     *     ringRadius: 2,
     *     sectorAngle: 360,
     *     segments: 30,
     *     sides: 20
     * });
     */
    constructor(opts = {}) {
        super();

        // Check the supplied options and provide defaults for unspecified ones
        const rc = opts.tubeRadius ?? 0.2;
        const rt = opts.ringRadius ?? 0.3;
        const sectorAngle = (opts.sectorAngle ?? 360) * math.DEG_TO_RAD;
        const segments = opts.segments ?? 30;
        const sides = opts.sides ?? 20;

        // Variable declarations
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        for (let i = 0; i <= sides; i++) {
            for (let j = 0; j <= segments; j++) {
                const x = Math.cos(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
                const y = Math.sin(2 * Math.PI * i / sides) * rc;
                const z = Math.sin(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));

                const nx = Math.cos(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
                const ny = Math.sin(2 * Math.PI * i / sides);
                const nz = Math.sin(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);

                const u = i / sides;
                const v = 1 - j / segments;

                positions.push(x, y, z);
                normals.push(nx, ny, nz);
                uvs.push(u, 1.0 - v);

                if ((i < sides) && (j < segments)) {
                    const first  = ((i))     * (segments + 1) + ((j));
                    const second = ((i + 1)) * (segments + 1) + ((j));
                    const third  = ((i))     * (segments + 1) + ((j + 1));
                    const fourth = ((i + 1)) * (segments + 1) + ((j + 1));

                    indices.push(first, second, third);
                    indices.push(second, fourth, third);
                }
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

export { TorusGeometry };
