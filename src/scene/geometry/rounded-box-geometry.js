import { Vec3 } from '../../core/math/vec3.js';
import { Geometry } from './geometry.js';

const primitiveUv1Padding = 8.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

// The faces in the same order and orientation as in BoxGeometry, so both share the texture and
// lightmap layout. Each face lists the axis and sign of its normal, and of its u and v directions.
const faces = [
    { n: 2, ns: 1, u: 0, us: 1, v: 1, vs: 1 },      // FRONT
    { n: 2, ns: -1, u: 0, us: -1, v: 1, vs: 1 },    // BACK
    { n: 1, ns: 1, u: 0, us: 1, v: 2, vs: -1 },     // TOP
    { n: 1, ns: -1, u: 0, us: -1, v: 2, vs: -1 },   // BOTTOM
    { n: 0, ns: 1, u: 2, us: -1, v: 1, vs: 1 },     // RIGHT
    { n: 0, ns: -1, u: 2, us: 1, v: 1, vs: 1 }      // LEFT
];

/**
 * Samples a face along one axis, from -halfExtent to +halfExtent. Each rounded end covers the 45
 * degrees of arc up to the seam with the neighboring face and is sampled at equal angles, the flat
 * part between them is sampled evenly. Each sample stores its coordinate on the box before the
 * rounding, and its distance along the rounded surface as a fraction of the total, which is used
 * as the texture coordinate so the texture is not stretched on the rounded parts.
 *
 * @param {number} halfExtent - The half extent of the box along the axis.
 * @param {number} radius - The radius of the rounding.
 * @param {number} flatSegments - The number of segments of the flat part.
 * @param {number} roundSegments - The number of segments of each rounded end.
 * @returns {{ coords: number[], fractions: number[] }} The samples.
 */
const sampleAxis = (halfExtent, radius, flatSegments, roundSegments) => {
    const inner = halfExtent - radius;
    const flat = inner > 0 ? flatSegments : 0;
    const arc = radius * Math.PI / 4;
    const length = 2 * (inner + arc);
    const invLength = length > 0 ? 1 / length : 0;

    // the rounded samples on the positive side: their coordinate, and their distance along the arc
    // from the flat part
    const roundCoords = [];
    const arcs = [];
    for (let i = 1; i <= roundSegments; i++) {
        const angle = (i / roundSegments) * Math.PI / 4;

        // the last sample is placed exactly on the edge of the box, so that neighboring faces
        // generate bit identical vertices along the seam
        roundCoords.push(i === roundSegments ? halfExtent : inner + radius * Math.tan(angle));
        arcs.push(radius * angle);
    }

    const coords = [];
    const fractions = [];

    for (let i = roundSegments - 1; i >= 0; i--) {
        coords.push(-roundCoords[i]);
        fractions.push((arc - arcs[i]) * invLength);
    }

    for (let i = 0; i <= flat; i++) {
        const f = flat > 0 ? i / flat : 0;
        coords.push(-inner + 2 * inner * f);
        fractions.push((arc + 2 * inner * f) * invLength);
    }

    for (let i = 0; i < roundSegments; i++) {
        coords.push(roundCoords[i]);
        fractions.push((arc + 2 * inner + arcs[i]) * invLength);
    }

    return { coords, fractions };
};

/**
 * A procedural box-shaped geometry with rounded edges and corners.
 *
 * Typically, you would:
 *
 * 1. Create a RoundedBoxGeometry instance.
 * 2. Generate a {@link Mesh} from the geometry.
 * 3. Create a {@link MeshInstance} referencing the mesh.
 * 4. Create an {@link Entity} with a {@link RenderComponent} and assign the {@link MeshInstance} to it.
 * 5. Add the entity to the {@link Scene}.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new RoundedBoxGeometry();
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
class RoundedBoxGeometry extends Geometry {
    /**
     * Create a new RoundedBoxGeometry instance.
     *
     * By default, the constructor creates a box centered on the object space origin with a width,
     * length and height of 1 unit, edges and corners rounded with a radius of 0.1 and 8 segments
     * across each rounded edge. The faces are laid out as in {@link BoxGeometry}, each with UVs
     * in the range of 0 to 1. Each face also takes half of each rounded edge next to it, so
     * neighboring faces meet half way around the rounded edge.
     *
     * @param {object} [opts] - Options object.
     * @param {Vec3} [opts.halfExtents] - The half dimensions of the box in each axis. Defaults to
     * [0.5, 0.5, 0.5].
     * @param {number} [opts.radius] - The radius of the rounded edges and corners. It is clamped to
     * the smallest half extent, where the box becomes fully rounded in that axis. A radius of 0
     * generates a box identical to {@link BoxGeometry}. Defaults to 0.1.
     * @param {number} [opts.radiusSegments] - The number of segments across each rounded edge,
     * which turns through 90 degrees. Must be even, as neighboring faces meet half way around the
     * edge, so an odd value is rounded up. Defaults to 8.
     * @param {number} [opts.widthSegments] - The number of divisions of the flat part of the box
     * along the X axis. Defaults to 1.
     * @param {number} [opts.lengthSegments] - The number of divisions of the flat part of the box
     * along the Z axis. Defaults to 1.
     * @param {number} [opts.heightSegments] - The number of divisions of the flat part of the box
     * along the Y axis. Defaults to 1.
     * @param {boolean} [opts.calculateTangents] - Generate tangent information. Defaults to false.
     * @param {number} [opts.yOffset] - Move the box vertically by given offset in local space. Pass
     * 0.5 to generate the box with pivot point at the bottom face. Defaults to 0.
     * @example
     * const geometry = new RoundedBoxGeometry({
     *     halfExtents: new Vec3(1, 0.5, 0.5),
     *     radius: 0.2,
     *     radiusSegments: 12
     * });
     */
    constructor(opts = {}) {
        super();

        // Check the supplied options and provide defaults for unspecified ones
        const he = opts.halfExtents ?? new Vec3(0.5, 0.5, 0.5);
        const radius = Math.max(0, Math.min(opts.radius ?? 0.1, he.x, he.y, he.z));
        const roundSegments = radius > 0 ? Math.max(1, Math.ceil((opts.radiusSegments ?? 8) / 2)) : 0;
        const yOffset = opts.yOffset ?? 0;

        const halfExtents = [he.x, he.y, he.z];
        const inner = [he.x - radius, he.y - radius, he.z - radius];
        const samples = [
            sampleAxis(he.x, radius, opts.widthSegments ?? 1, roundSegments),
            sampleAxis(he.y, radius, opts.heightSegments ?? 1, roundSegments),
            sampleAxis(he.z, radius, opts.lengthSegments ?? 1, roundSegments)
        ];

        const positions = [];
        const normals = [];
        const uvs = [];
        const uvs1 = [];
        const indices = [];
        let vcounter = 0;

        // a point on the box before the rounding, the closest point to it on the inner box, and
        // the normal
        const p = [0, 0, 0];
        const c = [0, 0, 0];
        const n = [0, 0, 0];

        for (let side = 0; side < faces.length; side++) {
            const face = faces[side];
            const uSamples = samples[face.u];
            const vSamples = samples[face.v];
            const uSegments = uSamples.coords.length - 1;
            const vSegments = vSamples.coords.length - 1;

            p[face.n] = face.ns * halfExtents[face.n];

            for (let i = 0; i <= uSegments; i++) {
                for (let j = 0; j <= vSegments; j++) {
                    p[face.u] = face.us * uSamples.coords[i];
                    p[face.v] = face.vs * vSamples.coords[j];

                    // project the point onto the rounded box: clamp it to the inner box, and push it
                    // back out by the radius, in the direction it was clamped from
                    if (radius > 0) {
                        let lengthSq = 0;
                        for (let k = 0; k < 3; k++) {
                            c[k] = Math.max(-inner[k], Math.min(inner[k], p[k]));
                            n[k] = p[k] - c[k];
                            lengthSq += n[k] * n[k];
                        }
                        const invLength = 1 / Math.sqrt(lengthSq);
                        for (let k = 0; k < 3; k++) {
                            n[k] *= invLength;
                            c[k] += n[k] * radius;
                        }
                    } else {
                        for (let k = 0; k < 3; k++) {
                            c[k] = p[k];
                            n[k] = 0;
                        }
                        n[face.n] = face.ns;
                    }

                    positions.push(c[0], c[1] + yOffset, c[2]);
                    normals.push(n[0], n[1], n[2]);

                    let u = uSamples.fractions[i];
                    let v = vSamples.fractions[j];
                    uvs.push(u, 1 - v);

                    // pack as 3x2, same as BoxGeometry
                    u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                    v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                    u /= 3;
                    v /= 3;

                    u += (side % 3) / 3;
                    v += Math.floor(side / 3) / 3;
                    uvs1.push(u, 1 - v);

                    if ((i < uSegments) && (j < vSegments)) {
                        indices.push(vcounter + vSegments + 1, vcounter + 1, vcounter);
                        indices.push(vcounter + vSegments + 1, vcounter + vSegments + 2, vcounter + 1);
                    }

                    vcounter++;
                }
            }
        }

        this.positions = positions;
        this.normals = normals;
        this.uvs = uvs;
        this.uvs1 = uvs1;
        this.indices = indices;

        if (opts.calculateTangents) {
            this.calculateTangents();
        }
    }
}

export { RoundedBoxGeometry };
