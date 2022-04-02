import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Debug } from '../core/debug.js';

import {
    SEMANTIC_TANGENT, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES,
    TYPE_UINT8
} from '../graphics/constants.js';

import { Mesh } from './mesh.js';

/** @typedef {import('../graphics/graphics-device.js').GraphicsDevice} GraphicsDevice */

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

// cached mesh primitives
const shapePrimitives = [];

/**
 * Normalizes the entire array in place.
 * 
 * @example ```js
 *   let arr = [0,10,0, 20,20,20, 0,1,30];
 *   normalizeArray(arr);
 *   arr.map(_ => _.toFixed(3));
 *   // Output: ['0.000', '1.000', '0.000', '0.577', '0.577', '0.577', '0.000', '0.033', '0.999']
 * ```
 * @param {number[] | Float32Array} arr
 */
function normalizeArray(arr) {
    const n = arr.length;
    const sqrt = Math.sqrt;
    for (let i = 0; i < n; i += 3) {
        const nx = arr[i];
        const ny = arr[i + 1];
        const nz = arr[i + 2];
        const invLen = 1 / sqrt(nx * nx + ny * ny + nz * nz);
        arr[i] *= invLen;
        arr[i + 1] *= invLen;
        arr[i + 2] *= invLen;
    }
}

/**
 * Generates normal information from the specified positions and triangle indices. See
 * {@link createMesh}.
 *
 * @param {number[]|Uint16Array|Float32Array|Int8Array|Uint8Array|Int16Array|Int32Array|Uint32Array} positions - An array of 3-dimensional vertex positions.
 * @param {number[]|Uint16Array|Float32Array|Int8Array|Uint8Array|Int16Array|Int32Array|Uint32Array} indices - An array of triangle indices.
 * @returns {Float32Array} An array of 3-dimensional vertex normals.
 * @example
 * var normals = pc.calculateNormals(positions, indices);
 * var tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * var mesh = pc.createMesh(positions, normals, tangents, uvs, indices);
 */
function calculateNormals(positions, indices) {
    const indicesLength = indices.length;
    const positionsLength = positions.length;
    let p1x = 0;
    let p1y = 0;
    let p1z = 0;
    let p2x = 0;
    let p2y = 0;
    let p2z = 0;
    let p3x = 0;
    let p3y = 0;
    let p3z = 0;
    const p1p2 = new Vec3();
    const p1p3 = new Vec3();
    const faceNormal = new Vec3();

    const normals = new Float32Array(positionsLength);

    // Accumulate face normals for each vertex
    for (let i = 0; i < indicesLength; i += 3) {
        const i1 = indices[i    ] * 3;
        const i2 = indices[i + 1] * 3;
        const i3 = indices[i + 2] * 3;
        p1x = positions[i1];
        p1y = positions[i1 + 1];
        p1z = positions[i1 + 2];
        p2x = positions[i2];
        p2y = positions[i2 + 1];
        p2z = positions[i2 + 2];
        p3x = positions[i3];
        p3y = positions[i3 + 1];
        p3z = positions[i3 + 2];
        // p1p2.sub2(p2, p1)
        p1p2.x = p2x - p1x;
        p1p2.y = p2y - p1y;
        p1p2.z = p2z - p1z;
        // p1p3.sub2(p3, p1);
        p1p3.x = p3x - p1x;
        p1p3.y = p3y - p1y;
        p1p3.z = p3z - p1z;
        faceNormal.cross(p1p2, p1p3).normalize();
        const nx = faceNormal.x;
        const ny = faceNormal.y;
        const nz = faceNormal.z;
        normals[i1]     += nx;
        normals[i1 + 1] += ny;
        normals[i1 + 2] += nz;
        normals[i2]     += nx;
        normals[i2 + 1] += ny;
        normals[i2 + 2] += nz;
        normals[i3]     += nx;
        normals[i3 + 1] += ny;
        normals[i3 + 2] += nz;
    }
    
    // Normalize all normals
    normalizeArray(normals);

    return normals;
}

function fillTan1Tan2(indices, positions, uvs, tan1, tan2) {
    let sdirx = 0;
    let sdiry = 0;
    let sdirz = 0;
    let tdirx = 0;
    let tdiry = 0;
    let tdirz = 0;
    let v1x   = 0;
    let v1y   = 0;
    let v1z   = 0;
    let v2x   = 0;
    let v2y   = 0;
    let v2z   = 0;
    let v3x   = 0;
    let v3y   = 0;
    let v3z   = 0;
    let w1x   = 0;
    let w1y   = 0;
    let w2x   = 0;
    let w2y   = 0;
    let w3x   = 0;
    let w3y   = 0;
    let x1    = 0;
    let x2    = 0;
    let y1    = 0;
    let y2    = 0;
    let z1    = 0;
    let z2    = 0;
    let s1    = 0;
    let s2    = 0;
    let t1    = 0;
    let t2    = 0;
    let area  = 0;
    let r     = 0;
    let i1    = 0;
    let i2    = 0;
    let i3    = 0;
    let i1Duo = 0;
    let i2Duo = 0;
    let i3Duo = 0;
    let i1Trio = 0;
    let i2Trio = 0;
    let i3Trio = 0;
    const n = indices.length;
    for (let i = 0; i < n; i += 3) {
        i1 = indices[i    ] >>> 0;
        i2 = indices[i + 1] >>> 0;
        i3 = indices[i + 2] >>> 0;

        // `<< 1` is same `* 2`
        i1Duo = i1 << 1;
        i2Duo = i2 << 1;
        i3Duo = i3 << 1;

        // Same as * 3
        i1Trio = (i1 << 1) + i1;
        i2Trio = (i2 << 1) + i2;
        i3Trio = (i3 << 1) + i3;

        v1x = positions[i1Trio];
        v1y = positions[i1Trio + 1];
        v1z = positions[i1Trio + 2];
        v2x = positions[i2Trio];
        v2y = positions[i2Trio + 1];
        v2z = positions[i2Trio + 2];
        v3x = positions[i3Trio];
        v3y = positions[i3Trio + 1];
        v3z = positions[i3Trio + 2];

        w1x = uvs[i1Duo];
        w1y = uvs[i1Duo + 1];
        w2x = uvs[i2Duo];
        w2y = uvs[i2Duo + 1];
        w3x = uvs[i3Duo];
        w3y = uvs[i3Duo + 1];

        x1 = v2x - v1x;
        x2 = v3x - v1x;
        y1 = v2y - v1y;
        y2 = v3y - v1y;
        z1 = v2z - v1z;
        z2 = v3z - v1z;

        s1 = w2x - w1x;
        s2 = w3x - w1x;
        t1 = w2y - w1y;
        t2 = w3y - w1y;

        area = s1 * t2 - s2 * t1;

        // Area can be 0 for degenerate triangles or bad uv coordinates
        if (area === 0) {
            // Fallback to default values
            sdirx = 0;
            sdiry = 1;
            sdirz = 0;
            tdirx = 1;
            tdiry = 0;
            tdirz = 0;
        } else {
            r = 1 / area;
            sdirx = (t2 * x1 - t1 * x2) * r;
            sdiry = (t2 * y1 - t1 * y2) * r;
            sdirz = (t2 * z1 - t1 * z2) * r;
            tdirx = (s1 * x2 - s2 * x1) * r;
            tdiry = (s1 * y2 - s2 * y1) * r;
            tdirz = (s1 * z2 - s2 * z1) * r;
        }

        tan1[i1Trio]     += sdirx;
        tan1[i1Trio + 1] += sdiry;
        tan1[i1Trio + 2] += sdirz;
        tan1[i2Trio]     += sdirx;
        tan1[i2Trio + 1] += sdiry;
        tan1[i2Trio + 2] += sdirz;
        tan1[i3Trio]     += sdirx;
        tan1[i3Trio + 1] += sdiry;
        tan1[i3Trio + 2] += sdirz;

        tan2[i1Trio]     += tdirx;
        tan2[i1Trio + 1] += tdiry;
        tan2[i1Trio + 2] += tdirz;
        tan2[i2Trio]     += tdirx;
        tan2[i2Trio + 1] += tdiry;
        tan2[i2Trio + 2] += tdirz;
        tan2[i3Trio]     += tdirx;
        tan2[i3Trio + 1] += tdiry;
        tan2[i3Trio + 2] += tdirz;
    }
}

function fillTangents(normals, tangents, tan1, tan2) {
    const t1 = new Vec3();
    const t2 = new Vec3();
    const n = new Vec3();
    const temp = new Vec3();
    let iQuad = 0;
    const len = normals.length;
    for (let i = 0; i < len; i += 3, iQuad += 4) {
        //n.set(normals[i], normals[i + 1], normals[i + 2]);
        n.x = normals[i];
        n.y = normals[i + 1];
        n.z = normals[i + 2];
        //t1.set(   tan1[i],    tan1[i + 1],    tan1[i + 2]);
        t1.x = tan1[i];
        t1.y = tan1[i + 1];
        t1.z = tan1[i + 2];
        //t2.set(   tan2[i],    tan2[i + 1],    tan2[i + 2]);
        t2.x = tan2[i];
        t2.y = tan2[i + 1];
        t2.z = tan2[i + 2];
        // Gram-Schmidt orthogonalize
        const ndott = n.dot(t1);
        // temp.copy(n).mulScalar(ndott);
        // temp.sub2(t1, temp);
        temp.x = t1.x - n.x * ndott;
        temp.y = t1.y - n.y * ndott;
        temp.z = t1.z - n.z * ndott;
        temp.normalize();
        tangents[iQuad]     = temp.x;
        tangents[iQuad + 1] = temp.y;
        tangents[iQuad + 2] = temp.z;
        // Calculate handedness
        temp.cross(n, t1);
        tangents[iQuad + 3] = (temp.dot(t2) < 0.0) ? -1.0 : 1.0;
    }
}

/**
 * Generates tangent information from the specified positions, normals, texture coordinates and
 * triangle indices. See {@link createMesh}.
 *
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {number[]} normals - An array of 3-dimensional vertex normals.
 * @param {number[]} uvs - An array of 2-dimensional vertex texture coordinates.
 * @param {number[]} indices - An array of triangle indices.
 * @returns {Float32Array} An array of 3-dimensional vertex tangents.
 * @example
 * var tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * var mesh = pc.createMesh(positions, normals, tangents, uvs, indices);
 */
function calculateTangents(positions, normals, uvs, indices) {
    // Lengyel's Method
    // http://web.archive.org/web/20180620024439/http://www.terathon.com/code/tangent.html
    const positionsLength = positions.length;
    const vertexCount   = positionsLength / 3;
    const tan1     = new Float32Array(vertexCount * 3);
    const tan2     = new Float32Array(vertexCount * 3);
    const tangents = new Float32Array(vertexCount * 4);
    fillTan1Tan2(indices, positions, uvs, tan1, tan2);
    fillTangents(normals, tangents, tan1, tan2);
    return tangents;
}

/**
 * Creates a new mesh object from the supplied vertex information and topology.
 *
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number[]} [opts.normals] - An array of 3-dimensional vertex normals.
 * @param {number[]} [opts.tangents] - An array of 3-dimensional vertex tangents.
 * @param {number[]} [opts.colors] - An array of 4-dimensional vertex colors where each component
 * is an integer in the range 0 to 255.
 * @param {number[]} [opts.uvs] - An array of 2-dimensional vertex texture coordinates.
 * @param {number[]} [opts.uvs1] - Same as opts.uvs, but for additional UV set
 * @param {number[]} [opts.blendIndices] - An array of 4-dimensional bone indices where each
 * component is an integer in the range 0 to 255.
 * @param {number[]} [opts.blendWeights] - An array of 4-dimensional bone weights where each
 * component is in the range 0 to 1 and the sum of the weights should equal 1.
 * @param {number[]} [opts.indices] - An array of triangle indices.
 * @returns {Mesh} A new Mesh constructed from the supplied vertex and triangle data.
 * @example
 * // Create a simple, indexed triangle (with texture coordinates and vertex normals)
 * var mesh = pc.createMesh(graphicsDevice, [0, 0, 0, 1, 0, 0, 0, 1, 0], {
 *     normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
 *     uvs: [0, 0, 1, 0, 0, 1],
 *     indices: [0, 1, 2]
 * });
 */
function createMesh(device, positions, opts) {

    const mesh = new Mesh(device);
    mesh.setPositions(positions);

    if (opts) {
        if (opts.normals) {
            mesh.setNormals(opts.normals);
        }

        if (opts.tangents) {
            mesh.setVertexStream(SEMANTIC_TANGENT, opts.tangents, 4);
        }

        if (opts.colors) {
            mesh.setColors32(opts.colors);
        }

        if (opts.uvs) {
            mesh.setUvs(0, opts.uvs);
        }

        if (opts.uvs1) {
            mesh.setUvs(1, opts.uvs1);
        }

        if (opts.blendIndices) {
            mesh.setVertexStream(SEMANTIC_BLENDINDICES, opts.blendIndices, 4, opts.blendIndices.length / 4, TYPE_UINT8);
        }

        if (opts.blendWeights) {
            mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, opts.blendWeights, 4);
        }

        if (opts.indices) {
            mesh.setIndices(opts.indices);
        }
    }

    mesh.update();
    return mesh;
}

/**
 * Creates a procedural torus-shaped mesh.
 *
 * The size, shape and tesselation properties of the torus can be controlled via function
 * parameters. By default, the function will create a torus in the XZ-plane with a tube radius of
 * 0.2, a ring radius of 0.3, 20 segments and 30 sides.
 *
 * Note that the torus is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the torus's mesh.
 *
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.tubeRadius] - The radius of the tube forming the body of the torus
 * (defaults to 0.2).
 * @param {number} [opts.ringRadius] - The radius from the centre of the torus to the centre of the
 * tube (defaults to 0.3).
 * @param {number} [opts.segments] - The number of radial divisions forming cross-sections of the
 * torus ring (defaults to 20).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the torus ring
 * (defaults to 30).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new torus-shaped mesh.
 */
function createTorus(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    const rc = opts && opts.tubeRadius !== undefined ? opts.tubeRadius : 0.2;
    const rt = opts && opts.ringRadius !== undefined ? opts.ringRadius : 0.3;
    const segments = opts && opts.segments !== undefined ? opts.segments : 30;
    const sides = opts && opts.sides !== undefined ? opts.sides : 20;
    const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Variable declarations
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= sides; i++) {
        for (let j = 0; j <= segments; j++) {
            const x = Math.cos(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
            const y = Math.sin(2 * Math.PI * i / sides) * rc;
            const z = Math.sin(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));

            const nx = Math.cos(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);
            const ny = Math.sin(2 * Math.PI * i / sides);
            const nz = Math.sin(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);

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

    const options = {
        normals: normals,
        uvs: uvs,
        indices: indices
    };

    if (calcTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

function _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
    // Variable declarations
    const pos = new Vec3();
    const bottomToTop = new Vec3();
    const norm = new Vec3();
    const top = new Vec3();
    const bottom = new Vec3();
    const tangent = new Vec3();
    const positions = [];
    const normals = [];
    const uvs = [];
    const uvs1 = [];
    const indices = [];
    let offset;

    // Define the body of the cone/cylinder
    if (height > 0) {
        for (let i = 0; i <= heightSegments; i++) {
            for (let j = 0; j <= capSegments; j++) {
                // Sweep the cone body from the positive Y axis to match a 3DS Max cone/cylinder
                const theta = (j / capSegments) * 2 * Math.PI - Math.PI;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);
                bottom.set(sinTheta * baseRadius, -height / 2, cosTheta * baseRadius);
                top.set(sinTheta * peakRadius, height / 2, cosTheta * peakRadius);
                pos.lerp(bottom, top, i / heightSegments);
                bottomToTop.sub2(top, bottom).normalize();
                tangent.set(cosTheta, 0, -sinTheta);
                norm.cross(tangent, bottomToTop).normalize();

                positions.push(pos.x, pos.y, pos.z);
                normals.push(norm.x, norm.y, norm.z);
                let u = j / capSegments;
                let v = i / heightSegments;
                uvs.push(u, 1 - v);

                // Pack UV1 to 1st third
                const _v = v;
                v = u;
                u = _v;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u /= 3;
                uvs1.push(u, 1 - v);

                if ((i < heightSegments) && (j < capSegments)) {
                    const first   = ((i))     * (capSegments + 1) + ((j));
                    const second  = ((i))     * (capSegments + 1) + ((j + 1));
                    const third   = ((i + 1)) * (capSegments + 1) + ((j));
                    const fourth  = ((i + 1)) * (capSegments + 1) + ((j + 1));

                    indices.push(first, second, third);
                    indices.push(second, fourth, third);
                }
            }
        }
    }

    if (roundedCaps) {
        const latitudeBands = Math.floor(capSegments / 2);
        const longitudeBands = capSegments;
        const capOffset = height / 2;

        // Generate top cap
        for (let lat = 0; lat <= latitudeBands; lat++) {
            const theta = (lat * Math.PI * 0.5) / latitudeBands;
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
                let u = 1 - lon / longitudeBands;
                let v = 1 - lat / latitudeBands;

                positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
                normals.push(x, y, z);
                uvs.push(u, 1 - v);

                // Pack UV1 to 2nd third
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u /= 3;
                v /= 3;
                u += 1.0 / 3;
                uvs1.push(u, 1 - v);
            }
        }

        offset = (heightSegments + 1) * (capSegments + 1);
        for (let lat = 0; lat < latitudeBands; ++lat) {
            for (let lon = 0; lon < longitudeBands; ++lon) {
                const first  = (lat * (longitudeBands + 1)) + lon;
                const second = first + longitudeBands + 1;

                indices.push(offset + first + 1, offset + second, offset + first);
                indices.push(offset + first + 1, offset + second + 1, offset + second);
            }
        }

        // Generate bottom cap
        for (let lat = 0; lat <= latitudeBands; lat++) {
            const theta = Math.PI * 0.5 + (lat * Math.PI * 0.5) / latitudeBands;
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
                let u = 1 - lon / longitudeBands;
                let v = 1 - lat / latitudeBands;

                positions.push(x * peakRadius, y * peakRadius - capOffset, z * peakRadius);
                normals.push(x, y, z);
                uvs.push(u, 1 - v);

                // Pack UV1 to 3rd third
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u /= 3;
                v /= 3;
                u += 2.0 / 3;
                uvs1.push(u, 1 - v);
            }
        }

        offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);
        for (let lat = 0; lat < latitudeBands; ++lat) {
            for (let lon = 0; lon < longitudeBands; ++lon) {
                const first  = (lat * (longitudeBands + 1)) + lon;
                const second = first + longitudeBands + 1;

                indices.push(offset + first + 1, offset + second, offset + first);
                indices.push(offset + first + 1, offset + second + 1, offset + second);
            }
        }
    } else {
        // Generate bottom cap
        offset = (heightSegments + 1) * (capSegments + 1);
        if (baseRadius > 0) {
            for (let i = 0; i < capSegments; i++) {
                const theta = (i / capSegments) * 2 * Math.PI;
                const x = Math.sin(theta);
                const y = -height / 2;
                const z = Math.cos(theta);
                let u = 1 - (x + 1) / 2;
                let v = (z + 1) / 2;

                positions.push(x * baseRadius, y, z * baseRadius);
                normals.push(0, -1, 0);
                uvs.push(u, 1 - v);

                // Pack UV1 to 2nd third
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u /= 3;
                v /= 3;
                u += 1 / 3;
                uvs1.push(u, 1 - v);

                if (i > 1) {
                    indices.push(offset, offset + i, offset + i - 1);
                }
            }
        }

        // Generate top cap
        offset += capSegments;
        if (peakRadius > 0) {
            for (let i = 0; i < capSegments; i++) {
                const theta = (i / capSegments) * 2 * Math.PI;
                const x = Math.sin(theta);
                const y = height / 2;
                const z = Math.cos(theta);
                let u = 1 - (x + 1) / 2;
                let v = (z + 1) / 2;

                positions.push(x * peakRadius, y, z * peakRadius);
                normals.push(0, 1, 0);
                uvs.push(u, 1 - v);

                // Pack UV1 to 3rd third
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u /= 3;
                v /= 3;
                u += 2 / 3;
                uvs1.push(u, 1 - v);

                if (i > 1) {
                    indices.push(offset, offset + i - 1, offset + i);
                }
            }
        }
    }

    return {
        positions: positions,
        normals: normals,
        uvs: uvs,
        uvs1: uvs1,
        indices: indices
    };
}

/**
 * Creates a procedural cylinder-shaped mesh.
 *
 * The size, shape and tesselation properties of the cylinder can be controlled via function
 * parameters. By default, the function will create a cylinder standing vertically centered on the
 * XZ-plane with a radius of 0.5, a height of 1.0, 1 height segment and 20 cap segments.
 *
 * Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the cylinder's mesh.
 *
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the cylinder (defaults to 0.5).
 * @param {number} [opts.height] - The length of the body of the cylinder (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cylinder (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the cylinder (defaults to 20).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cylinder-shaped mesh.
 */
function createCylinder(device, opts) {
    // #if _DEBUG
    if (opts && opts.hasOwnProperty('baseRadius') && !opts.hasOwnProperty('radius')) {
        Debug.deprecated('"baseRadius" in arguments, use "radius" instead');
    }
    // #endif

    // Check the supplied options and provide defaults for unspecified ones
    let radius = opts && (opts.radius || opts.baseRadius);
    radius = radius !== undefined ? radius : 0.5;
    const height = opts && opts.height !== undefined ? opts.height : 1.0;
    const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    const capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 20;
    const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    const options = _createConeData(radius, radius, height, heightSegments, capSegments, false);

    if (calcTangents) {
        options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural capsule-shaped mesh.
 *
 * The size, shape and tesselation properties of the capsule can be controlled via function
 * parameters. By default, the function will create a capsule standing vertically centered on the
 * XZ-plane with a radius of 0.25, a height of 1.0, 1 height segment and 10 cap segments.
 *
 * Note that the capsule is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the capsule's mesh.
 *
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the capsule (defaults
 * to 0.3).
 * @param {number} [opts.height] - The length of the body of the capsule from tip to tip (defaults
 * to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the tubular length of the
 * capsule (defaults to 1).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the capsule
 * (defaults to 20).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cylinder-shaped mesh.
 */
function createCapsule(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    const radius = opts && opts.radius !== undefined ? opts.radius : 0.3;
    const height = opts && opts.height !== undefined ? opts.height : 1.0;
    const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
    const sides = opts && opts.sides !== undefined ? opts.sides : 20;
    const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    const options = _createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);

    if (calcTangents) {
        options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural cone-shaped mesh.
 *
 * The size, shape and tesselation properties of the cone can be controlled via function
 * parameters. By default, the function will create a cone standing vertically centered on the
 * XZ-plane with a base radius of 0.5, a height of 1.0, 5 height segments and 20 cap segments.
 *
 * Note that the cone is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cone's mesh.
 *
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.baseRadius] - The base radius of the cone (defaults to 0.5).
 * @param {number} [opts.peakRadius] - The peak radius of the cone (defaults to 0.0).
 * @param {number} [opts.height] - The length of the body of the cone (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cone
 * (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the cone
 * (defaults to 18).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cone-shaped mesh.
 */
function createCone(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    const baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
    const peakRadius = opts && opts.peakRadius !== undefined ? opts.peakRadius : 0.0;
    const height = opts && opts.height !== undefined ? opts.height : 1.0;
    const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    const capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;
    const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    const options = _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);

    if (calcTangents) {
        options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural sphere-shaped mesh.
 *
 * The size and tesselation properties of the sphere can be controlled via function parameters. By
 * default, the function will create a sphere centered on the object space origin with a radius of
 * 0.5 and 16 segments in both longitude and latitude.
 *
 * Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the sphere's mesh.
 *
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the sphere (defaults to 0.5).
 * @param {number} [opts.latitudeBands] - The number of divisions along the latitudinal axis of the
 * sphere (defaults to 16).
 * @param {number} [opts.longitudeBands] - The number of divisions along the longitudinal axis of
 * the sphere (defaults to 16).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new sphere-shaped mesh.
 */
function createSphere(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    const radius = opts && opts.radius !== undefined ? opts.radius : 0.5;
    const latitudeBands = opts && opts.latitudeBands !== undefined ? opts.latitudeBands : 16;
    const longitudeBands = opts && opts.longitudeBands !== undefined ? opts.longitudeBands : 16;
    const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

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

    const options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs, // UV1 = UV0 for sphere
        indices: indices
    };

    if (calcTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

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
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec2} [opts.halfExtents] - The half dimensions of the plane in the X and Z axes
 * (defaults to [0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the plane
 * (defaults to 5).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the plane
 * (defaults to 5).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new plane-shaped mesh.
 */
function createPlane(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    const he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec2(0.5, 0.5);
    const ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 5;
    const ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 5;
    const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

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

    if (calcTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

/**
 * Creates a procedural box-shaped mesh.
 *
 * The size, shape and tesselation properties of the box can be controlled via function parameters.
 * By default, the function will create a box centered on the object space origin with a width,
 * length and height of 1.0 unit and 10 segments in either axis (50 triangles per face).
 *
 * Note that the box is created with UVs in the range of 0 to 1 on each face. Additionally, tangent
 * information is generated into the vertex buffer of the box's mesh.
 *
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
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
 * @returns {Mesh} A new box-shaped mesh.
 */
function createBox(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    const he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec3(0.5, 0.5, 0.5);
    const ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 1;
    const ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 1;
    const hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
    const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    const corners = [
        new Vec3(-he.x, -he.y, he.z),
        new Vec3(he.x, -he.y, he.z),
        new Vec3(he.x, he.y, he.z),
        new Vec3(-he.x, he.y, he.z),
        new Vec3(he.x, -he.y, -he.z),
        new Vec3(-he.x, -he.y, -he.z),
        new Vec3(-he.x, he.y, -he.z),
        new Vec3(he.x, he.y, -he.z)
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

    const options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs1,
        indices: indices
    };

    if (calcTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

// returns Primitive data, used by ModelComponent and RenderComponent
function getShapePrimitive(device, type) {

    // find in cache
    let primData = null;
    for (let i = 0; i < shapePrimitives.length; i++) {
        if (shapePrimitives[i].type === type && shapePrimitives[i].device === device) {
            primData = shapePrimitives[i].primData;
        }
    }

    // not in cache, create new
    if (!primData) {

        let mesh, area;
        switch (type) {

            case 'box':
                mesh = createBox(device, { halfExtents: new Vec3(0.5, 0.5, 0.5) });
                area = { x: 2, y: 2, z: 2, uv: (2.0 / 3) };
                break;

            case 'capsule':
                mesh = createCapsule(device, { radius: 0.5, height: 2 });
                area = { x: (Math.PI * 2), y: Math.PI, z: (Math.PI * 2), uv: (1.0 / 3 + ((1.0 / 3) / 3) * 2) };
                break;

            case 'cone':
                mesh = createCone(device, { baseRadius: 0.5, peakRadius: 0, height: 1 });
                area = { x: 2.54, y: 2.54, z: 2.54, uv: (1.0 / 3 + (1.0 / 3) / 3) };
                break;

            case 'cylinder':
                mesh = createCylinder(device, { radius: 0.5, height: 1 });
                area = { x: Math.PI, y: (0.79 * 2), z: Math.PI, uv: (1.0 / 3 + ((1.0 / 3) / 3) * 2) };
                break;

            case 'plane':
                mesh = createPlane(device, { halfExtents: new Vec2(0.5, 0.5), widthSegments: 1, lengthSegments: 1 });
                area = { x: 0, y: 1, z: 0, uv: 1 };
                break;

            case 'sphere':
                mesh = createSphere(device, { radius: 0.5 });
                area = { x: Math.PI, y: Math.PI, z: Math.PI, uv: 1 };
                break;

            default:
                throw new Error("Invalid primitive type: " + type);
        }

        // inc reference to keep primitive alive
        mesh.incRefCount();

        primData = { mesh: mesh, area: area };

        // add to cache
        shapePrimitives.push({
            type: type,
            device: device,
            primData: primData
        });
    }

    return primData;
}

export { calculateNormals, calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus, getShapePrimitive };
