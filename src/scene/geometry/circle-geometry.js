import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

/**
 * A procedural circle-shaped geometry - a flat disc in the XZ plane.
 *
 * Typically, you would:
 *
 * 1. Create a CircleGeometry instance.
 * 2. Generate a {@link Mesh} from the geometry.
 * 3. Create a {@link MeshInstance} referencing the mesh.
 * 4. Create an {@link Entity} with a {@link RenderComponent} and assign the {@link MeshInstance} to it.
 * 5. Add the entity to the {@link Scene}.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new CircleGeometry();
 * const mesh = Mesh.fromGeometry(app.graphicsDevice, geometry);
 * const material = new StandardMaterial();
 * const meshInstance = new MeshInstance(mesh, material);
 *
 * // Create an entity
 * const entity = new Entity();
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
class CircleGeometry extends Geometry {
    /**
     * Create a new CircleGeometry instance.
     *
     * By default, the constructor creates a circle centered on the object space origin with a
     * radius of 0.5, 64 sectors and 8 rings. The normal vector of the circle is aligned along the
     * positive Y axis. The circle is created with UVs in the range of 0 to 1, mapped planarly
     * across its bounding square.
     *
     * @param {object} [opts] - Options object.
     * @param {number} [opts.radius] - The radius of the circle. Defaults to 0.5.
     * @param {number} [opts.sectors] - The number of divisions around the circumference of the
     * circle. Defaults to 64.
     * @param {number} [opts.rings] - The number of concentric rings of vertices between the center
     * and the outer edge of the circle. Defaults to 8.
     * @param {number} [opts.ringExponent] - Controls the radial distribution of the rings. A value
     * of 1 spaces the rings uniformly, larger values concentrate the rings (and so the
     * tessellation detail) towards the center of the circle. Defaults to 1.
     * @param {boolean} [opts.calculateTangents] - Generate tangent information. Defaults to false.
     * @example
     * const geometry = new CircleGeometry({
     *     radius: 100,
     *     sectors: 128,
     *     rings: 64,
     *     ringExponent: 2
     * });
     */
    constructor(opts = {}) {
        super();

        // Check the supplied options and provide defaults for unspecified ones
        const radius = opts.radius ?? 0.5;
        const sectors = Math.max(Math.floor(opts.sectors ?? 64), 3);
        const rings = Math.max(Math.floor(opts.rings ?? 8), 1);
        const ringExponent = opts.ringExponent ?? 1;

        // Variable declarations
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // center vertex
        positions.push(0, 0, 0);
        normals.push(0, 1, 0);
        uvs.push(0.5, 0.5);

        // ring vertices. Ring r (1..rings) has `sectors` vertices, laid out consecutively
        for (let r = 1; r <= rings; r++) {
            const ringRadius = radius * Math.pow(r / rings, ringExponent);
            for (let j = 0; j < sectors; j++) {
                const angle = (2 * Math.PI * j) / sectors;
                const x = ringRadius * Math.cos(angle);
                const z = ringRadius * Math.sin(angle);

                positions.push(x, 0, z);
                normals.push(0, 1, 0);
                uvs.push(0.5 + x / (2 * radius), 0.5 + z / (2 * radius));
            }
        }

        // index of the j-th vertex on ring r, wrapping around the seam
        const ringVertex = (r, j) => 1 + (r - 1) * sectors + (j % sectors);

        // triangle fan connecting the center to the innermost ring
        for (let j = 0; j < sectors; j++) {
            indices.push(0, ringVertex(1, j + 1), ringVertex(1, j));
        }

        // quads between consecutive rings
        for (let r = 1; r < rings; r++) {
            for (let j = 0; j < sectors; j++) {
                const inner = ringVertex(r, j);
                const innerNext = ringVertex(r, j + 1);
                const outer = ringVertex(r + 1, j);
                const outerNext = ringVertex(r + 1, j + 1);
                indices.push(inner, outerNext, outer);
                indices.push(inner, innerNext, outerNext);
            }
        }

        this.positions = positions;
        this.normals = normals;
        this.uvs = uvs;
        this.uvs1 = uvs;    // UV1 = UV0 for circle
        this.indices = indices;

        if (opts.calculateTangents) {
            this.tangents = calculateTangents(positions, normals, uvs, indices);
        }
    }
}

export { CircleGeometry };
