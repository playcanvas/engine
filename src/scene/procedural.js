import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';

import {
    SEMANTIC_TANGENT, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES,
    TYPE_UINT8
} from '../graphics/constants.js';

import { Mesh } from './mesh.js';


/**
 * @function
 * @name calculateNormals
 * @description Generates normal information from the specified positions and
 * triangle indices. See {@link createMesh}.
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {number[]} indices - An array of triangle indices.
 * @returns {number[]} An array of 3-dimensional vertex normals.
 * @example
 * var normals = pc.calculateNormals(positions, indices);
 * var tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * var mesh = pc.createMesh(positions, normals, tangents, uvs, indices);
 */

var primitiveUv1Padding = 4.0 / 64;
var primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

// cached mesh primitives
var shapePrimitives = [];

function calculateNormals(positions, indices) {
    var triangleCount = indices.length / 3;
    var vertexCount   = positions.length / 3;
    var i1, i2, i3;
    var i; // Loop counter
    var p1 = new Vec3();
    var p2 = new Vec3();
    var p3 = new Vec3();
    var p1p2 = new Vec3();
    var p1p3 = new Vec3();
    var faceNormal = new Vec3();

    var normals = [];

    // Initialize the normal array to zero
    for (i = 0; i < positions.length; i++) {
        normals[i] = 0;
    }

    // Accumulate face normals for each vertex
    for (i = 0; i < triangleCount; i++) {
        i1 = indices[i * 3];
        i2 = indices[i * 3 + 1];
        i3 = indices[i * 3 + 2];

        p1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
        p2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
        p3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);

        p1p2.sub2(p2, p1);
        p1p3.sub2(p3, p1);
        faceNormal.cross(p1p2, p1p3).normalize();

        normals[i1 * 3]     += faceNormal.x;
        normals[i1 * 3 + 1] += faceNormal.y;
        normals[i1 * 3 + 2] += faceNormal.z;
        normals[i2 * 3]     += faceNormal.x;
        normals[i2 * 3 + 1] += faceNormal.y;
        normals[i2 * 3 + 2] += faceNormal.z;
        normals[i3 * 3]     += faceNormal.x;
        normals[i3 * 3 + 1] += faceNormal.y;
        normals[i3 * 3 + 2] += faceNormal.z;
    }

    // Normalize all normals
    for (i = 0; i < vertexCount; i++) {
        var nx = normals[i * 3];
        var ny = normals[i * 3 + 1];
        var nz = normals[i * 3 + 2];
        var invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        normals[i * 3] *= invLen;
        normals[i * 3 + 1] *= invLen;
        normals[i * 3 + 2] *= invLen;
    }

    return normals;
}

/**
 * @function
 * @name calculateTangents
 * @description Generates tangent information from the specified positions,
 * normals, texture coordinates and triangle indices. See {@link createMesh}.
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {number[]} normals - An array of 3-dimensional vertex normals.
 * @param {number[]} uvs - An array of 2-dimensional vertex texture coordinates.
 * @param {number[]} indices - An array of triangle indices.
 * @returns {number[]} An array of 3-dimensional vertex tangents.
 * @example
 * var tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * var mesh = pc.createMesh(positions, normals, tangents, uvs, indices);
 */
function calculateTangents(positions, normals, uvs, indices) {

    // Lengyel’s Method
    // http://web.archive.org/web/20180620024439/http://www.terathon.com/code/tangent.html
    var triangleCount = indices.length / 3;
    var vertexCount   = positions.length / 3;
    var i1, i2, i3;
    var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
    var sdir = new Vec3();
    var tdir = new Vec3();
    var v1   = new Vec3();
    var v2   = new Vec3();
    var v3   = new Vec3();
    var w1   = new Vec2();
    var w2   = new Vec2();
    var w3   = new Vec2();
    var i; // Loop counter
    var tan1 = new Float32Array(vertexCount * 3);
    var tan2 = new Float32Array(vertexCount * 3);

    var tangents = [];
    var area = 0.0;

    for (i = 0; i < triangleCount; i++) {
        i1 = indices[i * 3];
        i2 = indices[i * 3 + 1];
        i3 = indices[i * 3 + 2];

        v1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
        v2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
        v3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);

        w1.set(uvs[i1 * 2], uvs[i1 * 2 + 1]);
        w2.set(uvs[i2 * 2], uvs[i2 * 2 + 1]);
        w3.set(uvs[i3 * 2], uvs[i3 * 2 + 1]);

        x1 = v2.x - v1.x;
        x2 = v3.x - v1.x;
        y1 = v2.y - v1.y;
        y2 = v3.y - v1.y;
        z1 = v2.z - v1.z;
        z2 = v3.z - v1.z;

        s1 = w2.x - w1.x;
        s2 = w3.x - w1.x;
        t1 = w2.y - w1.y;
        t2 = w3.y - w1.y;

        area = s1 * t2 - s2 * t1;

        // Area can be 0 for degenerate triangles or bad uv coordinates
        if (area === 0) {
            // Fallback to default values
            sdir.set(0.0, 1.0, 0.0);
            tdir.set(1.0, 0.0, 0.0);
        } else {
            r = 1.0 / area;
            sdir.set((t2 * x1 - t1 * x2) * r,
                     (t2 * y1 - t1 * y2) * r,
                     (t2 * z1 - t1 * z2) * r);
            tdir.set((s1 * x2 - s2 * x1) * r,
                     (s1 * y2 - s2 * y1) * r,
                     (s1 * z2 - s2 * z1) * r);
        }

        tan1[i1 * 3 + 0] += sdir.x;
        tan1[i1 * 3 + 1] += sdir.y;
        tan1[i1 * 3 + 2] += sdir.z;
        tan1[i2 * 3 + 0] += sdir.x;
        tan1[i2 * 3 + 1] += sdir.y;
        tan1[i2 * 3 + 2] += sdir.z;
        tan1[i3 * 3 + 0] += sdir.x;
        tan1[i3 * 3 + 1] += sdir.y;
        tan1[i3 * 3 + 2] += sdir.z;

        tan2[i1 * 3 + 0] += tdir.x;
        tan2[i1 * 3 + 1] += tdir.y;
        tan2[i1 * 3 + 2] += tdir.z;
        tan2[i2 * 3 + 0] += tdir.x;
        tan2[i2 * 3 + 1] += tdir.y;
        tan2[i2 * 3 + 2] += tdir.z;
        tan2[i3 * 3 + 0] += tdir.x;
        tan2[i3 * 3 + 1] += tdir.y;
        tan2[i3 * 3 + 2] += tdir.z;
    }

    t1 = new Vec3();
    t2 = new Vec3();
    var n = new Vec3();
    var temp = new Vec3();

    for (i = 0; i < vertexCount; i++) {
        n.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        t1.set(tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
        t2.set(tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);

        // Gram-Schmidt orthogonalize
        var ndott = n.dot(t1);
        temp.copy(n).mulScalar(ndott);
        temp.sub2(t1, temp).normalize();

        tangents[i * 4]     = temp.x;
        tangents[i * 4 + 1] = temp.y;
        tangents[i * 4 + 2] = temp.z;

        // Calculate handedness
        temp.cross(n, t1);
        tangents[i * 4 + 3] = (temp.dot(t2) < 0.0) ? -1.0 : 1.0;
    }

    return tangents;
}

/**
 * @function
 * @name createMesh
 * @description Creates a new mesh object from the supplied vertex information and topology.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number[]} [opts.normals] - An array of 3-dimensional vertex normals.
 * @param {number[]} [opts.tangents] - An array of 3-dimensional vertex tangents.
 * @param {number[]} [opts.colors] - An array of 4-dimensional vertex colors where each
 * component is an integer in the range 0 to 255.
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
            mesh.setVertexStream(SEMANTIC_BLENDINDICES, opts.blendIndices, 4, TYPE_UINT8);
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
 * @function
 * @name createTorus
 * @description Creates a procedural torus-shaped mesh.
 *
 * The size, shape and tesselation properties of the torus can be controlled via function parameters.
 * By default, the function will create a torus in the XZ-plane with a tube radius of 0.2, a ring radius
 * of 0.3, 20 segments and 30 sides.
 *
 * Note that the torus is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the torus's mesh.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.tubeRadius] - The radius of the tube forming the body of the torus (defaults to 0.2).
 * @param {number} [opts.ringRadius] - The radius from the centre of the torus to the centre of the tube (defaults to 0.3).
 * @param {number} [opts.segments] - The number of radial divisions forming cross-sections of the torus ring (defaults to 20).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the torus ring (defaults to 30).
 * @returns {Mesh} A new torus-shaped mesh.
 */
function createTorus(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var rc = opts && opts.tubeRadius !== undefined ? opts.tubeRadius : 0.2;
    var rt = opts && opts.ringRadius !== undefined ? opts.ringRadius : 0.3;
    var segments = opts && opts.segments !== undefined ? opts.segments : 30;
    var sides = opts && opts.sides !== undefined ? opts.sides : 20;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Variable declarations
    var i, j;
    var x, y, z, nx, ny, nz, u, v;
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    for (i = 0; i <= sides; i++) {
        for (j = 0; j <= segments; j++) {
            x  = Math.cos(2.0 * Math.PI * j / segments) * (rt + rc * Math.cos(2.0 * Math.PI * i / sides));
            y  = Math.sin(2.0 * Math.PI * i / sides) * rc;
            z  = Math.sin(2.0 * Math.PI * j / segments) * (rt + rc * Math.cos(2.0 * Math.PI * i / sides));

            nx = Math.cos(2.0 * Math.PI * j / segments) * Math.cos(2.0 * Math.PI * i / sides);
            ny = Math.sin(2.0 * Math.PI * i / sides);
            nz = Math.sin(2.0 * Math.PI * j / segments) * Math.cos(2.0 * Math.PI * i / sides);

            u = i / sides;
            v = 1.0 - j / segments;

            positions.push(x, y, z);
            normals.push(nx, ny, nz);
            uvs.push(u, 1.0 - v);

            if ((i < sides) && (j < segments)) {
                var first, second, third, fourth;
                first   = ((i))     * (segments + 1) + ((j));
                second  = ((i + 1)) * (segments + 1) + ((j));
                third   = ((i))     * (segments + 1) + ((j + 1));
                fourth  = ((i + 1)) * (segments + 1) + ((j + 1));

                indices.push(first, second, third);
                indices.push(second, fourth, third);
            }
        }
    }

    var options = {
        normals: normals,
        uvs: uvs,
        indices: indices
    };

    if (calculateTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

function _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
    // Variable declarations
    var i, j;
    var x, y, z, u, v;
    var pos = new Vec3();
    var bottomToTop = new Vec3();
    var norm = new Vec3();
    var top, bottom, tangent;
    var positions = [];
    var normals = [];
    var uvs = [];
    var uvs1 = [];
    var indices = [];
    var theta, cosTheta, sinTheta;
    var phi, sinPhi, cosPhi;
    var first, second, third, fourth;
    var offset;

    // Define the body of the cone/cylinder
    if (height > 0) {
        for (i = 0; i <= heightSegments; i++) {
            for (j = 0; j <= capSegments; j++) {
                // Sweep the cone body from the positive Y axis to match a 3DS Max cone/cylinder
                theta = (j / capSegments) * 2.0 * Math.PI - Math.PI;
                sinTheta = Math.sin(theta);
                cosTheta = Math.cos(theta);
                bottom = new Vec3(sinTheta * baseRadius, -height / 2.0, cosTheta * baseRadius);
                top    = new Vec3(sinTheta * peakRadius,  height / 2.0, cosTheta * peakRadius);
                pos.lerp(bottom, top, i / heightSegments);
                bottomToTop.sub2(top, bottom).normalize();
                tangent = new Vec3(cosTheta, 0.0, -sinTheta);
                norm.cross(tangent, bottomToTop).normalize();

                positions.push(pos.x, pos.y, pos.z);
                normals.push(norm.x, norm.y, norm.z);
                u = j / capSegments;
                v = i / heightSegments;
                uvs.push(u, 1.0 - v);

                // Pack UV1 to 1st third
                var _v = v;
                v = u;
                u = _v;
                u /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                uvs1.push(u, 1.0 - v);

                if ((i < heightSegments) && (j < capSegments)) {
                    first   = ((i))     * (capSegments + 1) + ((j));
                    second  = ((i))     * (capSegments + 1) + ((j + 1));
                    third   = ((i + 1)) * (capSegments + 1) + ((j));
                    fourth  = ((i + 1)) * (capSegments + 1) + ((j + 1));

                    indices.push(first, second, third);
                    indices.push(second, fourth, third);
                }
            }
        }
    }

    if (roundedCaps) {
        var lat, lon;
        var latitudeBands = Math.floor(capSegments / 2);
        var longitudeBands = capSegments;
        var capOffset = height / 2;

        // Generate top cap
        for (lat = 0; lat <= latitudeBands; lat++) {
            theta = (lat * Math.PI * 0.5) / latitudeBands;
            sinTheta = Math.sin(theta);
            cosTheta = Math.cos(theta);

            for (lon = 0; lon <= longitudeBands; lon++) {
                // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
                phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2.0;
                sinPhi = Math.sin(phi);
                cosPhi = Math.cos(phi);

                x = cosPhi * sinTheta;
                y = cosTheta;
                z = sinPhi * sinTheta;
                u = 1.0 - lon / longitudeBands;
                v = 1.0 - lat / latitudeBands;

                positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
                normals.push(x, y, z);
                uvs.push(u, 1.0 - v);

                // Pack UV1 to 2nd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 1.0 / 3;
                uvs1.push(u, 1.0 - v);
            }
        }

        offset = (heightSegments + 1) * (capSegments + 1);
        for (lat = 0; lat < latitudeBands; ++lat) {
            for (lon = 0; lon < longitudeBands; ++lon) {
                first  = (lat * (longitudeBands + 1)) + lon;
                second = first + longitudeBands + 1;

                indices.push(offset + first + 1, offset + second, offset + first);
                indices.push(offset + first + 1, offset + second + 1, offset + second);
            }
        }

        // Generate bottom cap
        for (lat = 0; lat <= latitudeBands; lat++) {
            theta = Math.PI * 0.5 + (lat * Math.PI * 0.5) / latitudeBands;
            sinTheta = Math.sin(theta);
            cosTheta = Math.cos(theta);

            for (lon = 0; lon <= longitudeBands; lon++) {
                // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
                phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2.0;
                sinPhi = Math.sin(phi);
                cosPhi = Math.cos(phi);

                x = cosPhi * sinTheta;
                y = cosTheta;
                z = sinPhi * sinTheta;
                u = 1.0 - lon / longitudeBands;
                v = 1.0 - lat / latitudeBands;

                positions.push(x * peakRadius, y * peakRadius - capOffset, z * peakRadius);
                normals.push(x, y, z);
                uvs.push(u, 1.0 - v);

                // Pack UV1 to 3rd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 2.0 / 3;
                uvs1.push(u, 1.0 - v);
            }
        }

        offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);
        for (lat = 0; lat < latitudeBands; ++lat) {
            for (lon = 0; lon < longitudeBands; ++lon) {
                first  = (lat * (longitudeBands + 1)) + lon;
                second = first + longitudeBands + 1;

                indices.push(offset + first + 1, offset + second, offset + first);
                indices.push(offset + first + 1, offset + second + 1, offset + second);
            }
        }
    } else {
        // Generate bottom cap
        offset = (heightSegments + 1) * (capSegments + 1);
        if (baseRadius > 0.0) {
            for (i = 0; i < capSegments; i++) {
                theta = (i / capSegments) * 2.0 * Math.PI;
                x = Math.sin(theta);
                y = -height / 2.0;
                z = Math.cos(theta);
                u = 1.0 - (x + 1.0) / 2.0;
                v = (z + 1.0) / 2.0;

                positions.push(x * baseRadius, y, z * baseRadius);
                normals.push(0.0, -1.0, 0.0);
                uvs.push(u, 1.0 - v);

                // Pack UV1 to 2nd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 1.0 / 3;
                uvs1.push(u, 1.0 - v);

                if (i > 1) {
                    indices.push(offset, offset + i, offset + i - 1);
                }
            }
        }

        // Generate top cap
        offset += capSegments;
        if (peakRadius > 0.0) {
            for (i = 0; i < capSegments; i++) {
                theta = (i / capSegments) * 2.0 * Math.PI;
                x = Math.sin(theta);
                y = height / 2.0;
                z = Math.cos(theta);
                u = 1.0 - (x + 1.0) / 2.0;
                v = (z + 1.0) / 2.0;

                positions.push(x * peakRadius, y, z * peakRadius);
                normals.push(0.0, 1.0, 0.0);
                uvs.push(u, 1.0 - v);

                // Pack UV1 to 3rd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 2.0 / 3;
                uvs1.push(u, 1.0 - v);

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
 * @function
 * @name createCylinder
 * @description Creates a procedural cylinder-shaped mesh.
 *
 * The size, shape and tesselation properties of the cylinder can be controlled via function parameters.
 * By default, the function will create a cylinder standing vertically centered on the XZ-plane with a radius
 * of 0.5, a height of 1.0, 1 height segment and 20 cap segments.
 *
 * Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cylinder's mesh.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the cylinder (defaults to 0.5).
 * @param {number} [opts.height] - The length of the body of the cylinder (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cylinder (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the cylinder (defaults to 20).
 * @returns {Mesh} A new cylinder-shaped mesh.
 */
function createCylinder(device, opts) {
    // #if _DEBUG
    if (opts && opts.hasOwnProperty('baseRadius') && !opts.hasOwnProperty('radius')) {
        console.warn('DEPRECATED: "baseRadius" in arguments, use "radius" instead');
    }
    // #endif

    // Check the supplied options and provide defaults for unspecified ones
    var radius = opts && (opts.radius || opts.baseRadius);
    radius = radius !== undefined ? radius : 0.5;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 20;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    var options = _createConeData(radius, radius, height, heightSegments, capSegments, false);

    if (calculateTangents) {
        options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return createMesh(device, options.positions, options);
}

/**
 * @function
 * @name createCapsule
 * @description Creates a procedural capsule-shaped mesh.
 *
 * The size, shape and tesselation properties of the capsule can be controlled via function
 * parameters. By default, the function will create a capsule standing vertically centered
 * on the XZ-plane with a radius of 0.25, a height of 1.0, 1 height segment and 10 cap
 * segments.
 *
 * Note that the capsule is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the capsule's mesh.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the capsule (defaults to 0.3).
 * @param {number} [opts.height] - The length of the body of the capsule from tip to tip (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the tubular length of the capsule (defaults to 1).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the capsule (defaults to 20).
 * @returns {Mesh} A new cylinder-shaped mesh.
 */
function createCapsule(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var radius = opts && opts.radius !== undefined ? opts.radius : 0.3;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
    var sides = opts && opts.sides !== undefined ? opts.sides : 20;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    var options = _createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);

    if (calculateTangents) {
        options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return createMesh(device, options.positions, options);
}

/**
 * @function
 * @name createCone
 * @description Creates a procedural cone-shaped mesh.
 *
 * The size, shape and tesselation properties of the cone can be controlled via function
 * parameters. By default, the function will create a cone standing vertically centered
 * on the XZ-plane with a base radius of 0.5, a height of 1.0, 5 height segments and 20
 * cap segments.
 *
 * Note that the cone is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the cone's mesh.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.baseRadius] - The base radius of the cone (defaults to 0.5).
 * @param {number} [opts.peakRadius] - The peak radius of the cone (defaults to 0.0).
 * @param {number} [opts.height] - The length of the body of the cone (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cone (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the cone (defaults to 18).
 * @returns {Mesh} A new cone-shaped mesh.
 */
function createCone(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
    var peakRadius = opts && opts.peakRadius !== undefined ? opts.peakRadius : 0.0;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    var options = _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);

    if (calculateTangents) {
        options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return createMesh(device, options.positions, options);
}

/**
 * @function
 * @name createSphere
 * @description Creates a procedural sphere-shaped mesh.
 *
 * The size and tesselation properties of the sphere can be controlled via function
 * parameters. By default, the function will create a sphere centered on the object
 * space origin with a radius of 0.5 and 16 segments in both longitude and latitude.
 *
 * Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the sphere's mesh.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the sphere (defaults to 0.5).
 * @param {number} [opts.segments] - The number of divisions along the longitudinal
 * and latitudinal axes of the sphere (defaults to 16).
 * @returns {Mesh} A new sphere-shaped mesh.
 */
function createSphere(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var radius = opts && opts.radius !== undefined ? opts.radius : 0.5;
    var latitudeBands = opts && opts.latitudeBands !== undefined ? opts.latitudeBands : 16;
    var longitudeBands = opts && opts.longitudeBands !== undefined ? opts.longitudeBands : 16;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Variable declarations
    var lon, lat;
    var theta, sinTheta, cosTheta, phi, sinPhi, cosPhi;
    var first, second;
    var x, y, z, u, v;
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    for (lat = 0; lat <= latitudeBands; lat++) {
        theta = lat * Math.PI / latitudeBands;
        sinTheta = Math.sin(theta);
        cosTheta = Math.cos(theta);

        for (lon = 0; lon <= longitudeBands; lon++) {
            // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
            phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2.0;
            sinPhi = Math.sin(phi);
            cosPhi = Math.cos(phi);

            x = cosPhi * sinTheta;
            y = cosTheta;
            z = sinPhi * sinTheta;
            u = 1.0 - lon / longitudeBands;
            v = 1.0 - lat / latitudeBands;

            positions.push(x * radius, y * radius, z * radius);
            normals.push(x, y, z);
            uvs.push(u, 1.0 - v);
        }
    }

    for (lat = 0; lat < latitudeBands; ++lat) {
        for (lon = 0; lon < longitudeBands; ++lon) {
            first  = (lat * (longitudeBands + 1)) + lon;
            second = first + longitudeBands + 1;

            indices.push(first + 1, second, first);
            indices.push(first + 1, second + 1, second);
        }
    }

    var options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs, // UV1 = UV0 for sphere
        indices: indices
    };

    if (calculateTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

/**
 * @function
 * @name createPlane
 * @description Creates a procedural plane-shaped mesh.
 *
 * The size and tesselation properties of the plane can be controlled via function
 * parameters. By default, the function will create a plane centered on the object
 * space origin with a width and length of 1.0 and 5 segments in either axis (50
 * triangles). The normal vector of the plane is aligned along the positive Y axis.
 *
 * Note that the plane is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the plane's mesh.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec2} [opts.halfExtents] - The half dimensions of the plane in the X and Z axes (defaults to [0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the plane (defaults to 5).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the plane (defaults to 5).
 * @returns {Mesh} A new plane-shaped mesh.
 */
function createPlane(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec2(0.5, 0.5);
    var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 5;
    var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 5;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Variable declarations
    var i, j;
    var x, y, z, u, v;
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    // Generate plane as follows (assigned UVs denoted at corners):
    // (0,1)x---------x(1,1)
    //      |         |
    //      |         |
    //      |    O--X |length
    //      |    |    |
    //      |    Z    |
    // (0,0)x---------x(1,0)
    // width
    var vcounter = 0;

    for (i = 0; i <= ws; i++) {
        for (j = 0; j <= ls; j++) {
            x = -he.x + 2.0 * he.x * i / ws;
            y = 0.0;
            z = -(-he.y + 2.0 * he.y * j / ls);
            u = i / ws;
            v = j / ls;

            positions.push(x, y, z);
            normals.push(0.0, 1.0, 0.0);
            uvs.push(u, 1.0 - v);

            if ((i < ws) && (j < ls)) {
                indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
                indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
            }

            vcounter++;
        }
    }

    var options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs, // UV1 = UV0 for plane
        indices: indices
    };

    if (calculateTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

/**
 * @function
 * @name createBox
 * @description Creates a procedural box-shaped mesh.
 *
 * The size, shape and tesselation properties of the box can be controlled via function parameters. By
 * default, the function will create a box centered on the object space origin with a width, length and
 * height of 1.0 unit and 10 segments in either axis (50 triangles per face).
 *
 * Note that the box is created with UVs in the range of 0 to 1 on each face. Additionally, tangent
 * information is generated into the vertex buffer of the box's mesh.
 * @param {GraphicsDevice} device - The graphics device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec3} [opts.halfExtents] - The half dimensions of the box in each axis (defaults to [0.5, 0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the box (defaults to 1).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the box (defaults to 1).
 * @param {number} [opts.heightSegments] - The number of divisions along the Y axis of the box (defaults to 1).
 * @returns {Mesh} A new box-shaped mesh.
 */
function createBox(device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec3(0.5, 0.5, 0.5);
    var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 1;
    var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 1;
    var hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    var corners = [
        new Vec3(-he.x, -he.y, he.z),
        new Vec3(he.x, -he.y, he.z),
        new Vec3(he.x, he.y, he.z),
        new Vec3(-he.x, he.y, he.z),
        new Vec3(he.x, -he.y, -he.z),
        new Vec3(-he.x, -he.y, -he.z),
        new Vec3(-he.x, he.y, -he.z),
        new Vec3(he.x, he.y, -he.z)
    ];

    var faceAxes = [
        [0, 1, 3], // FRONT
        [4, 5, 7], // BACK
        [3, 2, 6], // TOP
        [1, 0, 4], // BOTTOM
        [1, 4, 2], // RIGHT
        [5, 0, 6]  // LEFT
    ];

    var faceNormals = [
        [0,  0,  1], // FRONT
        [0,  0, -1], // BACK
        [0,  1,  0], // TOP
        [0, -1,  0], // BOTTOM
        [1,  0,  0], // RIGHT
        [-1,  0,  0]  // LEFT
    ];

    var sides = {
        FRONT: 0,
        BACK: 1,
        TOP: 2,
        BOTTOM: 3,
        RIGHT: 4,
        LEFT: 5
    };

    var positions = [];
    var normals = [];
    var uvs = [];
    var uvs1 = [];
    var indices = [];
    var vcounter = 0;

    var generateFace = function (side, uSegments, vSegments) {
        var u, v;
        var i, j;

        for (i = 0; i <= uSegments; i++) {
            for (j = 0; j <= vSegments; j++) {
                var temp1 = new Vec3();
                var temp2 = new Vec3();
                var temp3 = new Vec3();
                var r = new Vec3();
                temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
                temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
                temp3.sub2(temp2, corners[faceAxes[side][0]]);
                r.add2(temp1, temp3);
                u = i / uSegments;
                v = j / vSegments;

                positions.push(r.x, r.y, r.z);
                normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
                uvs.push(u, 1.0 - v);
                // pack as 3x2
                // 1/3 will be empty, but it's either that or stretched pixels
                // TODO: generate non-rectangular lightMaps, so we could use space without stretching
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += (side % 3) / 3;
                v += Math.floor(side / 3) / 3;
                uvs1.push(u, 1.0 - v);

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

    var options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs1,
        indices: indices
    };

    if (calculateTangents) {
        options.tangents = calculateTangents(positions, normals, uvs, indices);
    }

    return createMesh(device, positions, options);
}

// returns Primitive data, used by ModelComponent and RenderComponent
function getShapePrimitive(device, type) {

    // find in cache
    var primData = null;
    for (var i = 0; i < shapePrimitives.length; i++) {
        if (shapePrimitives[i].type === type && shapePrimitives[i].device === device) {
            primData = shapePrimitives[i].primData;
        }
    }

    // not in cache, create new
    if (!primData) {

        var mesh, area;
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
