import { Vec3 } from '../../core/math/vec3.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

/**
 * A procedural box-shaped geometry.
 *
 * The size, shape and tesselation properties of the box can be controlled via constructor options.
 * By default, a box centered on the object space origin with a width, length and height of 1.0 unit
 * and 1 segment in either axis (2 triangles per face).
 *
 * Note that the box is created with UVs in the range of 0 to 1 on each face.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec3} [opts.halfExtents] - The half dimensions of the box in each axis (defaults to
 * [0.5, 0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the box
 * (defaults to 1).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the box
 * (defaults to 1).
 * @param {number} [opts.heightSegments] - The number of divisions along the Y axis of the box
 * (defaults to 1).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @param {number} [opts.yOffset] - Move the box vertically by given offset in local space. Pass
 * 0.5 to generate the box with pivot point at the bottom face. Defaults to 0.
 * @category Graphics
 */
class BoxGeometry extends Geometry {
    constructor(opts = {}) {
        super();

        // Check the supplied options and provide defaults for unspecified ones
        const he = opts.halfExtents ?? new Vec3(0.5, 0.5, 0.5);
        const ws = opts.widthSegments ?? 1;
        const ls = opts.lengthSegments ?? 1;
        const hs = opts.heightSegments ?? 1;

        const yOffset = opts.yOffset ?? 0;
        const minY = -he.y + yOffset;
        const maxY = he.y + yOffset;

        const corners = [
            new Vec3(-he.x, minY, he.z),
            new Vec3(he.x, minY, he.z),
            new Vec3(he.x, maxY, he.z),
            new Vec3(-he.x, maxY, he.z),
            new Vec3(he.x, minY, -he.z),
            new Vec3(-he.x, minY, -he.z),
            new Vec3(-he.x, maxY, -he.z),
            new Vec3(he.x, maxY, -he.z)
        ];

        const faceAxes = [
            [0, 1, 3], // FRONT
            [4, 5, 7], // BACK
            [3, 2, 6], // TOP
            [1, 0, 4], // BOTTOM
            [1, 4, 2], // RIGHT
            [5, 0, 6]  // LEFT
        ];

        const faceNormals = [
            [0,  0,  1], // FRONT
            [0,  0, -1], // BACK
            [0,  1,  0], // TOP
            [0, -1,  0], // BOTTOM
            [1,  0,  0], // RIGHT
            [-1,  0,  0]  // LEFT
        ];

        const sides = {
            FRONT: 0,
            BACK: 1,
            TOP: 2,
            BOTTOM: 3,
            RIGHT: 4,
            LEFT: 5
        };

        const positions = [];
        const normals = [];
        const uvs = [];
        const uvs1 = [];
        const indices = [];
        let vcounter = 0;

        const generateFace = (side, uSegments, vSegments) => {
            const temp1 = new Vec3();
            const temp2 = new Vec3();
            const temp3 = new Vec3();
            const r = new Vec3();

            for (let i = 0; i <= uSegments; i++) {
                for (let j = 0; j <= vSegments; j++) {
                    temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
                    temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
                    temp3.sub2(temp2, corners[faceAxes[side][0]]);
                    r.add2(temp1, temp3);
                    let u = i / uSegments;
                    let v = j / vSegments;

                    positions.push(r.x, r.y, r.z);
                    normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
                    uvs.push(u, 1 - v);

                    // pack as 3x2. 1/3 will be empty, but it's either that or stretched pixels
                    // TODO: generate non-rectangular lightMaps, so we could use space without stretching
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
        };

        generateFace(sides.FRONT, ws, hs);
        generateFace(sides.BACK, ws, hs);
        generateFace(sides.TOP, ws, ls);
        generateFace(sides.BOTTOM, ws, ls);
        generateFace(sides.RIGHT, ls, hs);
        generateFace(sides.LEFT, ls, hs);

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

export { BoxGeometry };
