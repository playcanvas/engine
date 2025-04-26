import { Vec2 } from '../../core/math/vec2.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

/**
 * A procedural plane-shaped geometry.
 *
 * Typically, you would:
 *
 * 1. Create a PlaneGeometry instance.
 * 2. Generate a {@link Mesh} from the geometry.
 * 3. Create a {@link MeshInstance} referencing the mesh.
 * 4. Create an {@link Entity} with a {@link RenderComponent} and assign the {@link MeshInstance} to it.
 * 5. Add the entity to the {@link Scene}.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new pc.PlaneGeometry();
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
class PlaneGeometry extends Geometry {
    /**
     * Create a new PlaneGeometry instance.
     *
     * By default, the constructor creates a plane centered on the object space origin with a width
     * and length of 1 and 5 segments in either axis (50 triangles). The normal vector of the plane is
     * aligned along the positive Y axis. The plane is created with UVs in the range of 0 to 1.
     *
     * @param {object} [opts] - Options object.
     * @param {Vec2} [opts.halfExtents] - The half dimensions of the plane in the X and Z axes.
     * Defaults to [0.5, 0.5].
     * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the plane.
     * Defaults to 5.
     * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the plane.
     * Defaults to 5.
     * @param {boolean} [opts.calculateTangents] - Generate tangent information. Defaults to false.
     * @example
     * const geometry = new pc.PlaneGeometry({
     *     halfExtents: new pc.Vec2(1, 1),
     *     widthSegments: 10,
     *     lengthSegments: 10
     * });
     */
    constructor(opts = {}) {
        super();

        // Check the supplied options and provide defaults for unspecified ones
        const he = opts.halfExtents ?? new Vec2(0.5, 0.5);
        const ws = opts.widthSegments ?? 5;
        const ls = opts.lengthSegments ?? 5;

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

        this.positions = positions;
        this.normals = normals;
        this.uvs = uvs;
        this.uvs1 = uvs;    // UV1 = UV0 for plane
        this.indices = indices;

        if (opts.calculateTangents) {
            this.tangents = calculateTangents(positions, normals, uvs, indices);
        }
    }
}

export { PlaneGeometry };
