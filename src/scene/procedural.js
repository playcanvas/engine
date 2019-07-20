/**
 * @function
 * @name pc.calculateNormals
 * @description Generates normal information from the specified positions and triangle indices. See {@link pc.createMesh}.
 * @param {Number[]} positions An array of 3-dimensional vertex positions.
 * @param {Number[]} indices An array of triangle indices.
 * @returns {Number[]} An array of 3-dimensional vertex normals.
 * @example
 * var normals = pc.calculateNormals(positions, indices);
 * var tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * var mesh = pc.createMesh(positions, normals, tangents, uvs, indices);
 */

var primitiveUv1Padding = 4.0 / 64;
var primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

pc.calculateNormals = function (positions, indices) {
    var triangleCount = indices.length / 3;
    var vertexCount   = positions.length / 3;
    var i1, i2, i3;
    var i; // Loop counter
    var p1 = new pc.Vec3();
    var p2 = new pc.Vec3();
    var p3 = new pc.Vec3();
    var p1p2 = new pc.Vec3();
    var p1p3 = new pc.Vec3();
    var faceNormal = new pc.Vec3();

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
};

/**
 * @function
 * @name pc.calculateTangents
 * @description Generates tangent information from the specified positions, normals, texture coordinates
 * and triangle indices. See {@link pc.createMesh}.
 * @param {Number[]} positions An array of 3-dimensional vertex positions.
 * @param {Number[]} normals An array of 3-dimensional vertex normals.
 * @param {Number[]} uvs An array of 2-dimensional vertex texture coordinates.
 * @param {Number[]} indices An array of triangle indices.
 * @returns {Number[]} An array of 3-dimensional vertex tangents.
 * @example
 * var tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * var mesh = pc.createMesh(positions, normals, tangents, uvs, indices);
 */
pc.calculateTangents = function (positions, normals, uvs, indices) {
    var triangleCount = indices.length / 3;
    var vertexCount   = positions.length / 3;
    var i1, i2, i3;
    var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
    var sdir = new pc.Vec3();
    var tdir = new pc.Vec3();
    var v1   = new pc.Vec3();
    var v2   = new pc.Vec3();
    var v3   = new pc.Vec3();
    var w1   = new pc.Vec2();
    var w2   = new pc.Vec2();
    var w3   = new pc.Vec2();
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

        // Area can 0.0 for degenerate triangles or bad uv coordinates
        if (area == 0.0) {
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

    t1 = new pc.Vec3();
    t2 = new pc.Vec3();
    var n = new pc.Vec3();
    var temp = new pc.Vec3();

    for (i = 0; i < vertexCount; i++) {
        n.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        t1.set(tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
        t2.set(tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);

        // Gram-Schmidt orthogonalize
        var ndott = n.dot(t1);
        temp.copy(n).scale(ndott);
        temp.sub2(t1, temp).normalize();

        tangents[i * 4]     = temp.x;
        tangents[i * 4 + 1] = temp.y;
        tangents[i * 4 + 2] = temp.z;

        // Calculate handedness
        temp.cross(n, t1);
        tangents[i * 4 + 3] = (temp.dot(t2) < 0.0) ? -1.0 : 1.0;
    }

    return tangents;
};

/**
 * @function
 * @name pc.createMesh
 * @description Creates a new mesh object from the supplied vertex information and topology.
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Number[]} positions An array of 3-dimensional vertex positions.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number[]} opts.normals An array of 3-dimensional vertex normals.
 * @param {Number[]} opts.tangents An array of 3-dimensional vertex tangents.
 * @param {Number[]} opts.colors An array of 4-dimensional vertex colors.
 * @param {Number[]} opts.uvs An array of 2-dimensional vertex texture coordinates.
 * @param {Number[]} opts.uvs1 Same as opts.uvs, but for additional UV set
 * @param {Number[]} opts.indices An array of triangle indices.
 * @returns {pc.Mesh} A new Geometry constructed from the supplied vertex and triangle data.
 * @example
 * // Create a new mesh supplying optional parameters using object literal notation
 * var mesh = pc.createMesh(
 *     graphicsDevice,
 *     positions,
 *     {
 *         normals: treeNormals,
 *         uvs: treeUvs,
 *         indices: treeIndices
 *     });
 */
pc.createMesh = function (device, positions, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var normals      = opts && opts.normals !== undefined ? opts.normals : null;
    var tangents     = opts && opts.tangents !== undefined ? opts.tangents : null;
    var colors       = opts && opts.colors !== undefined ? opts.colors : null;
    var uvs          = opts && opts.uvs !== undefined ? opts.uvs : null;
    var uvs1         = opts && opts.uvs1 !== undefined ? opts.uvs1 : null;
    var indices      = opts && opts.indices !== undefined ? opts.indices : null;
    var blendIndices = opts && opts.blendIndices !== undefined ? opts.blendIndices : null;
    var blendWeights = opts && opts.blendWeights !== undefined ? opts.blendWeights : null;

    var vertexDesc = [
        { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
    ];
    if (normals !== null) {
        vertexDesc.push({ semantic: pc.SEMANTIC_NORMAL, components: 3, type: pc.TYPE_FLOAT32 });
    }
    if (tangents !== null) {
        vertexDesc.push({ semantic: pc.SEMANTIC_TANGENT, components: 4, type: pc.TYPE_FLOAT32 });
    }
    if (colors !== null) {
        vertexDesc.push({ semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true });
    }
    if (uvs !== null) {
        vertexDesc.push({ semantic: pc.SEMANTIC_TEXCOORD0, components: 2, type: pc.TYPE_FLOAT32 });
    }
    if (uvs1 !== null) {
        vertexDesc.push({ semantic: pc.SEMANTIC_TEXCOORD1, components: 2, type: pc.TYPE_FLOAT32 });
    }
    if (blendIndices !== null) {
        vertexDesc.push({ semantic: pc.SEMANTIC_BLENDINDICES, components: 2, type: pc.TYPE_UINT8 });
    }
    if (blendWeights !== null) {
        vertexDesc.push({ semantic: pc.SEMANTIC_BLENDWEIGHT, components: 2, type: pc.TYPE_FLOAT32 });
    }

    var vertexFormat = new pc.VertexFormat(device, vertexDesc);

    // Create the vertex buffer
    var numVertices  = positions.length / 3;
    var vertexBuffer = new pc.VertexBuffer(device, vertexFormat, numVertices);

    // Write the vertex data into the vertex buffer
    var iterator = new pc.VertexIterator(vertexBuffer);
    for (var i = 0; i < numVertices; i++) {
        iterator.element[pc.SEMANTIC_POSITION].set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        if (normals !== null) {
            iterator.element[pc.SEMANTIC_NORMAL].set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        }
        if (tangents !== null) {
            iterator.element[pc.SEMANTIC_TANGENT].set(tangents[i * 4], tangents[i * 4 + 1], tangents[i * 4 + 2], tangents[i * 4 + 3]);
        }
        if (colors !== null) {
            iterator.element[pc.SEMANTIC_COLOR].set(colors[i * 4], colors[i * 4 + 1], colors[i * 4 + 2], colors[i * 4 + 3]);
        }
        if (uvs !== null) {
            iterator.element[pc.SEMANTIC_TEXCOORD0].set(uvs[i * 2], uvs[i * 2 + 1]);
        }
        if (uvs1 !== null) {
            iterator.element[pc.SEMANTIC_TEXCOORD1].set(uvs1[i * 2], uvs1[i * 2 + 1]);
        }
        if (blendIndices !== null) {
            iterator.element[pc.SEMANTIC_BLENDINDICES].set(blendIndices[i * 2], blendIndices[i * 2 + 1]);
        }
        if (blendWeights !== null) {
            iterator.element[pc.SEMANTIC_BLENDWEIGHT].set(blendWeights[i * 2], blendWeights[i * 2 + 1]);
        }
        iterator.next();
    }
    iterator.end();

    // Create the index buffer
    var indexBuffer = null;
    var indexed = (indices !== null);
    if (indexed) {
        indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);

        // Read the indicies into the index buffer
        var dst = new Uint16Array(indexBuffer.lock());
        dst.set(indices);
        indexBuffer.unlock();
    }

    var aabb = new pc.BoundingBox();
    aabb.compute(positions);

    var mesh = new pc.Mesh();
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = indexBuffer;
    mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = indexed ? indices.length : numVertices;
    mesh.primitive[0].indexed = indexed;
    mesh.aabb = aabb;
    return mesh;
};

/**
 * @function
 * @name pc.createTorus
 * @description Creates a procedural torus-shaped mesh.
 * The size, shape and tesselation properties of the torus can be controlled via function parameters.
 * By default, the function will create a torus in the XZ-plane with a tube radius of 0.2, a ring radius
 * of 0.3, 20 segments and 30 sides.<br />
 * Note that the torus is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the torus's mesh.<br />
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.tubeRadius The radius of the tube forming the body of the torus (defaults to 0.2).
 * @param {Number} opts.ringRadius The radius from the centre of the torus to the centre of the tube (defaults to 0.3).
 * @param {Number} opts.segments The number of radial divisions forming cross-sections of the torus ring (defaults to 20).
 * @param {Number} opts.sides The number of divisions around the tubular body of the torus ring (defaults to 30).
 * @returns {pc.Mesh} A new torus-shaped mesh.
 */
pc.createTorus = function (device, opts) {
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
            uvs.push(u, v);

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
        options.tangents = pc.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.createMesh(device, positions, options);
};

pc._createConeData = function (baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
    // Variable declarations
    var i, j;
    var x, y, z, u, v;
    var pos = new pc.Vec3();
    var bottomToTop = new pc.Vec3();
    var norm = new pc.Vec3();
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
                bottom = new pc.Vec3(sinTheta * baseRadius, -height / 2.0, cosTheta * baseRadius);
                top    = new pc.Vec3(sinTheta * peakRadius,  height / 2.0, cosTheta * peakRadius);
                pos.lerp(bottom, top, i / heightSegments);
                bottomToTop.sub2(top, bottom).normalize();
                tangent = new pc.Vec3(cosTheta, 0.0, -sinTheta);
                norm.cross(tangent, bottomToTop).normalize();

                positions.push(pos.x, pos.y, pos.z);
                normals.push(norm.x, norm.y, norm.z);
                u = j / capSegments;
                v = i / heightSegments;
                uvs.push(u, v);

                // Pack UV1 to 1st third
                var _v = v;
                v = u;
                u = _v;
                u /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                uvs1.push(u, v);

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
                uvs.push(u, v);

                // Pack UV1 to 2nd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 1.0 / 3;
                uvs1.push(u, v);
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
                uvs.push(u, v);

                // Pack UV1 to 3rd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 2.0 / 3;
                uvs1.push(u, v);
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
                uvs.push(u, v);

                // Pack UV1 to 2nd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 1.0 / 3;
                uvs1.push(u, v);

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
                uvs.push(u, v);

                // Pack UV1 to 3rd third
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += 2.0 / 3;
                uvs1.push(u, v);

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
};

/**
 * @function
 * @name pc.createCylinder
 * @description Creates a procedural cylinder-shaped mesh.
 * The size, shape and tesselation properties of the cylinder can be controlled via function parameters.
 * By default, the function will create a cylinder standing vertically centred on the XZ-plane with a radius
 * of 0.5, a height of 1.0, 1 height segment and 20 cap segments.<br />
 * Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cylinder's mesh.<br />
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.radius The radius of the tube forming the body of the cylinder (defaults to 0.5).
 * @param {Number} opts.height The length of the body of the cylinder (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the length of the cylinder (defaults to 5).
 * @param {Number} opts.capSegments The number of divisions around the tubular body of the cylinder (defaults to 20).
 * @returns {pc.Mesh} A new cylinder-shaped mesh.
 */
pc.createCylinder = function (device, opts) {
    // #ifdef DEBUG
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
    var options = pc._createConeData(radius, radius, height, heightSegments, capSegments, false);

    if (calculateTangents) {
        options.tangents = pc.calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return pc.createMesh(device, options.positions, options);
};

/**
 * @function
 * @name pc.createCapsule
 * @description Creates a procedural capsule-shaped mesh.
 * The size, shape and tesselation properties of the capsule can be controlled via function parameters.
 * By default, the function will create a capsule standing vertically centred on the XZ-plane with a radius
 * of 0.25, a height of 1.0, 1 height segment and 10 cap segments.<br />
 * Note that the capsule is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the capsule's mesh.<br />
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.radius The radius of the tube forming the body of the capsule (defaults to 0.3).
 * @param {Number} opts.height The length of the body of the capsule from tip to tip (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the tubular length of the capsule (defaults to 1).
 * @param {Number} opts.sides The number of divisions around the tubular body of the capsule (defaults to 20).
 * @returns {pc.Mesh} A new cylinder-shaped mesh.
 */
pc.createCapsule = function (device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var radius = opts && opts.radius !== undefined ? opts.radius : 0.3;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
    var sides = opts && opts.sides !== undefined ? opts.sides : 20;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    var options = pc._createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);

    if (calculateTangents) {
        options.tangents = pc.calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return pc.createMesh(device, options.positions, options);
};

/**
 * @function
 * @name pc.createCone
 * @description Creates a procedural cone-shaped mesh.</p>
 * The size, shape and tesselation properties of the cone can be controlled via function parameters.
 * By default, the function will create a cone standing vertically centred on the XZ-plane with a base radius
 * of 0.5, a height of 1.0, 5 height segments and 20 cap segments.<br />
 * Note that the cone is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cone's mesh.<br />
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.baseRadius The base radius of the cone (defaults to 0.5).
 * @param {Number} opts.peakRadius The peak radius of the cone (defaults to 0.0).
 * @param {Number} opts.height The length of the body of the cone (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the length of the cone (defaults to 5).
 * @param {Number} opts.capSegments The number of divisions around the tubular body of the cone (defaults to 18).
 * @returns {pc.Mesh} A new cone-shaped mesh.
 */
pc.createCone = function (device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
    var peakRadius = opts && opts.peakRadius !== undefined ? opts.peakRadius : 0.0;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    var options = pc._createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);

    if (calculateTangents) {
        options.tangents = pc.calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return pc.createMesh(device, options.positions, options);
};

/**
 * @function
 * @name pc.createSphere
 * @description Creates a procedural sphere-shaped mesh.
 * The size and tesselation properties of the sphere can be controlled via function parameters. By
 * default, the function will create a sphere centred on the object space origin with a radius of 0.5
 * and 16 segments in both longitude and latitude.<br />
 * Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the sphere's mesh.<br />
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.radius The radius of the sphere (defaults to 0.5).
 * @param {Number} opts.segments The number of divisions along the longitudinal and latitudinal axes of the sphere (defaults to 16).
 * @returns {pc.Mesh} A new sphere-shaped mesh.
 */
pc.createSphere = function (device, opts) {
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
            uvs.push(u, v);
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
        options.tangents = pc.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.createMesh(device, positions, options);
};

/**
 * @function
 * @name pc.createPlane
 * @description Creates a procedural plane-shaped mesh.
 * The size and tesselation properties of the plane can be controlled via function parameters. By
 * default, the function will create a plane centred on the object space origin with a width and
 * length of 1.0 and 5 segments in either axis (50 triangles). The normal vector of the plane is aligned
 * along the positive Y axis.<br />
 * Note that the plane is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the plane's mesh.<br />
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {pc.Vec2} opts.halfExtents The half dimensions of the plane in the X and Z axes (defaults to [0.5, 0.5]).
 * @param {Number} opts.widthSegments The number of divisions along the X axis of the plane (defaults to 5).
 * @param {Number} opts.lengthSegments The number of divisions along the Z axis of the plane (defaults to 5).
 * @returns {pc.Mesh} A new plane-shaped mesh.
 */
pc.createPlane = function (device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new pc.Vec2(0.5, 0.5);
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
            uvs.push(u, v);

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
        options.tangents = pc.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.createMesh(device, positions, options);
};

/**
 * @function
 * @name pc.createBox
 * @description Creates a procedural box-shaped mesh.
 * The size, shape and tesselation properties of the box can be controlled via function parameters. By
 * default, the function will create a box centred on the object space origin with a width, length and
 * height of 1.0 unit and 10 segments in either axis (50 triangles per face).<br />
 * Note that the box is created with UVs in the range of 0 to 1 on each face. Additionally, tangent
 * information is generated into the vertex buffer of the box's mesh.<br />
 * @param {pc.GraphicsDevice} device The graphics device used to manage the mesh.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {pc.Vec3} opts.halfExtents The half dimensions of the box in each axis (defaults to [0.5, 0.5, 0.5]).
 * @param {Number} opts.widthSegments The number of divisions along the X axis of the box (defaults to 1).
 * @param {Number} opts.lengthSegments The number of divisions along the Z axis of the box (defaults to 1).
 * @param {Number} opts.heightSegments The number of divisions along the Y axis of the box (defaults to 1).
 * @returns {pc.Mesh} A new box-shaped mesh.
 */
pc.createBox = function (device, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new pc.Vec3(0.5, 0.5, 0.5);
    var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 1;
    var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 1;
    var hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
    var calculateTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

    var corners = [
        new pc.Vec3(-he.x, -he.y,  he.z),
        new pc.Vec3( he.x, -he.y,  he.z),
        new pc.Vec3( he.x,  he.y,  he.z),
        new pc.Vec3(-he.x,  he.y,  he.z),
        new pc.Vec3( he.x, -he.y, -he.z),
        new pc.Vec3(-he.x, -he.y, -he.z),
        new pc.Vec3(-he.x,  he.y, -he.z),
        new pc.Vec3( he.x,  he.y, -he.z)
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
                var temp1 = new pc.Vec3();
                var temp2 = new pc.Vec3();
                var temp3 = new pc.Vec3();
                var r = new pc.Vec3();
                temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
                temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
                temp3.sub2(temp2, corners[faceAxes[side][0]]);
                r.add2(temp1, temp3);
                u = i / uSegments;
                v = j / vSegments;

                positions.push(r.x, r.y, r.z);
                normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
                uvs.push(u, v);
                // pack as 3x2
                // 1/3 will be empty, but it's either that or stretched pixels
                // TODO: generate non-rectangular lightMaps, so we could use space without stretching
                u /= 3;
                v /= 3;
                u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                u += (side % 3) / 3;
                v += Math.floor(side / 3) / 3;
                uvs1.push(u, v);

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
        options.tangents = pc.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.createMesh(device, positions, options);
};
