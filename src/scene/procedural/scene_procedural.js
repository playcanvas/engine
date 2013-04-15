/**
 * @namespace Namespace for functionality related to procedural generation and processing of geometries
 * @name pc.scene.procedural
 */
pc.scene.procedural = {};

/**
 * @function
 * @name pc.scene.procedural.calculateTangents
 * @description Generates tangent information from the specified vertices, normals, texture coordinates
 * and triangle indices.
 * @param {Array} vertices An array of 3-dimensional vertex positions.
 * @param {Array} normals An array of 3-dimensional vertex normals.
 * @param {Array} uvs An array of 2-dimensional vertex texture coordinates.
 * @param {Array} indices An array of triangle indices.
 * @returns {Array} An array of 3-dimensional vertex tangents.
 * @example
 * var tangents = pc.scene.procedural.calculateTangents(vertices, normals, uvs, indices);
 * var mesh = pc.scene.procedural.createMesh(vertices, normals, tangents, uvs, indices);
 * @see pc.scene.procedural.createMesh
 * @author Will Eastcott
 */
pc.scene.procedural.calculateTangents = function (vertices, normals, uvs, indices) {
    var triangleCount = indices.length / 3;
    var vertexCount   = vertices.length / 3;
    var i1, i2, i3;
    var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
    var sdir = pc.math.vec3.create(0, 0, 0);
    var tdir = pc.math.vec3.create(0, 0, 0);
    var v1   = pc.math.vec3.create(0, 0, 0);
    var v2   = pc.math.vec3.create(0, 0, 0);
    var v3   = pc.math.vec3.create(0, 0, 0);
    var w1   = pc.math.vec2.create(0, 0);
    var w2   = pc.math.vec2.create(0, 0);
    var w3   = pc.math.vec2.create(0, 0);
    var i; // Loop counter
    var tan1 = new Float32Array(vertexCount * 3);
    var tan2 = new Float32Array(vertexCount * 3);

    var tangents = [];

    for (i = 0; i < triangleCount; i++) {
        i1 = indices[i * 3];
        i2 = indices[i * 3 + 1];
        i3 = indices[i * 3 + 2];

        pc.math.vec3.set(v1, vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
        pc.math.vec3.set(v2, vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);
        pc.math.vec3.set(v3, vertices[i3 * 3], vertices[i3 * 3 + 1], vertices[i3 * 3 + 2]);

        pc.math.vec2.set(w1, uvs[i1 * 2], uvs[i1 * 2 + 1]);
        pc.math.vec2.set(w2, uvs[i2 * 2], uvs[i2 * 2 + 1]);
        pc.math.vec2.set(w3, uvs[i3 * 2], uvs[i3 * 2 + 1]);

        x1 = v2[0] - v1[0];
        x2 = v3[0] - v1[0];
        y1 = v2[1] - v1[1];
        y2 = v3[1] - v1[1];
        z1 = v2[2] - v1[2];
        z2 = v3[2] - v1[2];

        s1 = w2[0] - w1[0];
        s2 = w3[0] - w1[0];
        t1 = w2[1] - w1[1];
        t2 = w3[1] - w1[1];

        r = 1.0 / (s1 * t2 - s2 * t1);
        pc.math.vec3.set(sdir, (t2 * x1 - t1 * x2) * r, 
                               (t2 * y1 - t1 * y2) * r,
                               (t2 * z1 - t1 * z2) * r);
        pc.math.vec3.set(tdir, (s1 * x2 - s2 * x1) * r,
                               (s1 * y2 - s2 * y1) * r,
                               (s1 * z2 - s2 * z1) * r);

        tan1[i1 * 3 + 0] += sdir[0];
        tan1[i1 * 3 + 1] += sdir[1];
        tan1[i1 * 3 + 2] += sdir[2];
        tan1[i2 * 3 + 0] += sdir[0];
        tan1[i2 * 3 + 1] += sdir[1];
        tan1[i2 * 3 + 2] += sdir[2];
        tan1[i3 * 3 + 0] += sdir[0];
        tan1[i3 * 3 + 1] += sdir[1];
        tan1[i3 * 3 + 2] += sdir[2];

        tan2[i1 * 3 + 0] += tdir[0];
        tan2[i1 * 3 + 1] += tdir[1];
        tan2[i1 * 3 + 2] += tdir[2];
        tan2[i2 * 3 + 0] += tdir[0];
        tan2[i2 * 3 + 1] += tdir[1];
        tan2[i2 * 3 + 2] += tdir[2];
        tan2[i3 * 3 + 0] += tdir[0];
        tan2[i3 * 3 + 1] += tdir[1];
        tan2[i3 * 3 + 2] += tdir[2];
    }

    t1 = pc.math.vec3.create(0, 0, 0);
    t2 = pc.math.vec3.create(0, 0, 0);
    var n    = pc.math.vec3.create(0, 0, 0);
    var temp = pc.math.vec3.create(0, 0, 0);

    for (i = 0; i < vertexCount; i++) {
        pc.math.vec3.set(n, normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        pc.math.vec3.set(t1, tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
        pc.math.vec3.set(t2, tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);

        // Gram-Schmidt orthogonalize
        var ndott = pc.math.vec3.dot(n, t1);
        pc.math.vec3.scale(n, ndott, temp);
        pc.math.vec3.subtract(t1, temp, temp);
        pc.math.vec3.normalize(temp, temp);

        tangents[i * 4]     = temp[0];
        tangents[i * 4 + 1] = temp[1];
        tangents[i * 4 + 2] = temp[2];

        // Calculate handedness
        pc.math.vec3.cross(n, t1, temp);
        tangents[i * 4 + 3] = (pc.math.vec3.dot(temp, t2) < 0.0) ? -1.0 : 1.0;
    }
    
    return tangents;
};

/**
 * @function
 * @name pc.scene.procedural.createMesh
 * @description Creates a pc.scene.Mesh object from the supplied vertex information and topology.
 * @param {Array} positions An array of 3-dimensional vertex positions.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Array} opts.normals An array of 3-dimensional vertex normals.
 * @param {Array} opts.tangents An array of 3-dimensional vertex tangents.
 * @param {Array} opts.uvs An array of 2-dimensional vertex texture coordinates.
 * @param {Array} opts.indices An array of triangle indices.
 * @returns {pc.scene.Mesh} A new Geometry constructed from the supplied vertex and triangle data.
 * @example
 * // Create a new mesh supplying optional parameters using object literal notation
 * var mesh = pc.scene.procedural.createMesh(positions, {
 *         normals: treeNormals,
 *         uvs: treeUvs,
 *         indices: treeIndices
 *     });
 * @author Will Eastcott
 */
pc.scene.procedural.createMesh = function (positions, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var normals = opts && opts.normals !== undefined ? opts.normals : null;
    var tangents = opts && opts.tangents !== undefined ? opts.tangents : null;
    var uvs = opts && opts.uvs !== undefined ? opts.uvs : null;
    var indices = opts && opts.indices !== undefined ? opts.indices : null;

    var vertexFormat = new pc.gfx.VertexFormat();
    vertexFormat.begin();
    vertexFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
    if (normals !== null) {
        vertexFormat.addElement(new pc.gfx.VertexElement("vertex_normal", 3, pc.gfx.VertexElementType.FLOAT32));
    }
    if (tangents !== null) {
        vertexFormat.addElement(new pc.gfx.VertexElement("vertex_tangent", 4, pc.gfx.VertexElementType.FLOAT32));
    }
    if (uvs !== null) {
        vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord0", 2, pc.gfx.VertexElementType.FLOAT32));
    }
    vertexFormat.end();

    // Create the vertex buffer
    var numVertices  = positions.length / 3;
    var vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, numVertices);

    // Write the vertex data into the vertex buffer
    var iterator = new pc.gfx.VertexIterator(vertexBuffer);
    for (var i = 0; i < numVertices; i++) {
        iterator.element.vertex_position.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
        if (normals !== null) {
            iterator.element.vertex_normal.set(normals[i*3], normals[i*3+1], normals[i*3+2]);
        }
        if (tangents !== null) {
            iterator.element.vertex_tangent.set(tangents[i*4], tangents[i*4+1], tangents[i*4+2], tangents[i*4+3]);
        }
        if (uvs !== null) {
            iterator.element.vertex_texCoord0.set(uvs[i*2], uvs[i*2+1]);
        }
        iterator.next();
    }
    iterator.end();

    // Create the index buffer
    var indexBuffer = null;
    var indexed = (indices !== null);
    if (indexed) {
        indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.INDEXFORMAT_UINT16, indices.length);

        // Read the indicies into the index buffer
        var dst = new Uint16Array(indexBuffer.lock());
        dst.set(indices);
        indexBuffer.unlock();
    }

    var aabb = new pc.shape.Aabb();
    aabb.compute(positions);

    var mesh = new pc.scene.Mesh();
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = indexBuffer;
    mesh.primitive[0].type = pc.gfx.PRIMITIVE_TRIANGLES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = indexed ? indices.length : numVertices;
    mesh.primitive[0].indexed = indexed;
    mesh.aabb = aabb;
    return mesh;
};

/**
 * @function
 * @name pc.scene.procedural.createTorus
 * @description <p>Creates a procedural torus-shaped mesh.</p>
 * <p>The size, shape and tesselation properties of the torus can be controlled via function parameters.
 * By default, the function will create a torus in the XZ-plane with a tube radius of 0.2, a ring radius
 * of 0.3, 20 segments and 30 sides.</p>
 * <p>Note that the torus is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the torus's mesh.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.tubeRadius The radius of the tube forming the body of the torus (defaults to 0.2).
 * @param {Number} opts.ringRadius The radius from the centre of the torus to the centre of the tube (defaults to 0.3).
 * @param {Number} opts.segments The number of radial divisions forming cross-sections of the torus ring (defaults to 20).
 * @param {Number} opts.sides The number of divisions around the tubular body of the torus ring (defaults to 30).
 * @returns {pc.scene.Mesh} A new torus-shaped mesh.
 * @author Will Eastcott
 */
pc.scene.procedural.createTorus = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var rc = opts && opts.tubeRadius !== undefined ? opts.tubeRadius : 0.2;
    var rt = opts && opts.ringRadius !== undefined ? opts.ringRadius : 0.3;
    var segments = opts && opts.segments !== undefined ? opts.segments : 30;
    var sides = opts && opts.sides !== undefined ? opts.sides : 20;

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
        normals:   normals,
        uvs:       uvs,
        indices:   indices
    };

    var device = pc.gfx.Device.getCurrent();
    if (device.precalculatedTangents) {
        options.tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.scene.procedural.createMesh(positions, options);
};

pc.scene.procedural._createConeData = function (baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
    // Variable declarations
    var i, j;
    var x, y, z, u, v;
    var pos = pc.math.vec3.create();
    var bottomToTop = pc.math.vec3.create();
    var norm = pc.math.vec3.create();
    var top, bottom, tangent;
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];
    var cosTheta, sinTheta;
    var sinPhi, cosPhi;
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
                bottom = pc.math.vec3.create(sinTheta * baseRadius, -height / 2.0, cosTheta * baseRadius);
                top    = pc.math.vec3.create(sinTheta * peakRadius,  height / 2.0, cosTheta * peakRadius);
                pc.math.vec3.lerp(bottom, top, i / heightSegments, pos);
                pc.math.vec3.subtract(top, bottom, bottomToTop);
                pc.math.vec3.normalize(bottomToTop, bottomToTop);
                tangent = pc.math.vec3.create(cosTheta, 0.0, -sinTheta);
                pc.math.vec3.cross(tangent, bottomToTop, norm);
                pc.math.vec3.normalize(norm, norm);

                positions.push(pos[0], pos[1], pos[2]);
                normals.push(norm[0], norm[1], norm[2]);
                uvs.push(j / capSegments, i / heightSegments);

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
            }
        }

        offset = (heightSegments + 1) * (capSegments + 1);
        for (lat = 0; lat < latitudeBands; ++lat) {
            for (lon = 0; lon < longitudeBands; ++lon) {
                first  = (lat * (longitudeBands+1)) + lon;
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
            }
        }

        offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);
        for (lat = 0; lat < latitudeBands; ++lat) {
            for (lon = 0; lon < longitudeBands; ++lon) {
                first  = (lat * (longitudeBands+1)) + lon;
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
        indices: indices
    };
};

/**
 * @function
 * @name pc.scene.procedural.createCylinder
 * @description <p>Creates a procedural cylinder-shaped mesh.</p>
 * <p>The size, shape and tesselation properties of the cylinder can be controlled via function parameters.
 * By default, the function will create a cylinder standing vertically centred on the XZ-plane with a radius
 * of 0.5, a height of 1.0, 1 height segment and 20 cap segments.</p>
 * <p>Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cylinder's mesh.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.radius The radius of the tube forming the body of the cylinder (defaults to 0.5).
 * @param {Number} opts.height The length of the body of the cylinder (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the length of the cylinder (defaults to 5).
 * @param {Number} opts.capSegments The number of divisions around the tubular body of the cylinder (defaults to 20).
 * @returns {pc.scene.Mesh} A new cylinder-shaped mesh.
 * @author Will Eastcott
 */
pc.scene.procedural.createCylinder = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 20;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    var options = pc.scene.procedural._createConeData(baseRadius, baseRadius, height, heightSegments, capSegments, false);

    var device = pc.gfx.Device.getCurrent();
    if (device.precalculatedTangents) {
        options.tangents = pc.scene.procedural.calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return pc.scene.procedural.createMesh(options.positions, options);
};

/**
 * @function
 * @name pc.scene.procedural.createCapsule
 * @description <p>Creates a procedural capsule-shaped mesh.</p>
 * <p>The size, shape and tesselation properties of the capsule can be controlled via function parameters.
 * By default, the function will create a capsule standing vertically centred on the XZ-plane with a radius
 * of 0.25, a height of 1.0, 1 height segment and 10 cap segments.</p>
 * <p>Note that the capsule is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the capsule's mesh.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.radius The radius of the tube forming the body of the capsule (defaults to 0.3).
 * @param {Number} opts.height The length of the body of the capsule from tip to tip (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the tubular length of the capsule (defaults to 1).
 * @param {Number} opts.sides The number of divisions around the tubular body of the capsule (defaults to 20).
 * @returns {pc.scene.Mesh} A new cylinder-shaped mesh.
 * @author Will Eastcott
 */
pc.scene.procedural.createCapsule = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var radius = opts && opts.radius !== undefined ? opts.radius : 0.3;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
    var sides = opts && opts.sides !== undefined ? opts.sides : 20;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    var options = pc.scene.procedural._createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);

    var device = pc.gfx.Device.getCurrent();
    if (device.precalculatedTangents) {
        options.tangents = pc.scene.procedural.calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return pc.scene.procedural.createMesh(options.positions, options);
};

/**
 * @function
 * @name pc.scene.procedural.createCone
 * @description <p>Creates a procedural cone-shaped mesh.</p>
 * <p>The size, shape and tesselation properties of the cone can be controlled via function parameters.
 * By default, the function will create a cone standing vertically centred on the XZ-plane with a base radius
 * of 0.5, a height of 1.0, 5 height segments and 20 cap segments.</p>
 * <p>Note that the cone is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cone's mesh.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.baseRadius The base radius of the cone (defaults to 0.5).
 * @param {Number} opts.peakRadius The peak radius of the cone (defaults to 0.0).
 * @param {Number} opts.height The length of the body of the cone (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the length of the cone (defaults to 5).
 * @param {Number} opts.capSegments The number of divisions around the tubular body of the cone (defaults to 18).
 * @returns {pc.scene.Mesh} A new cone-shaped mesh.
 * @author Will Eastcott
 */
pc.scene.procedural.createCone = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
    var peakRadius = opts && opts.peakRadius !== undefined ? opts.peakRadius : 0.0;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;

    var options = pc.scene.procedural._createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);

    var device = pc.gfx.Device.getCurrent();
    if (device.precalculatedTangents) {
        options.tangents = pc.scene.procedural.calculateTangents(options.positions, options.normals, options.uvs, options.indices);
    }

    return pc.scene.procedural.createMesh(options.positions, options);
};

/**
 * @function
 * @name pc.scene.procedural.createSphere
 * @description <p>Creates a procedural sphere-shaped mesh.</p>
 * <p>The size and tesselation properties of the sphere can be controlled via function parameters. By
 * default, the function will create a sphere centred on the object space origin with a radius of 0.5
 * and 16 segments in both longitude and latitude.</p>
 * <p>Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the sphere's mesh.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Number} opts.radius The radius of the sphere (defaults to 0.5).
 * @param {Number} opts.segments The number of divisions along the longitudinal and latitudinal axes of the sphere (defaults to 16).
 * @returns {pc.scene.Mesh} A new sphere-shaped mesh.
 * @author Will Eastcott
 */
pc.scene.procedural.createSphere = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var radius = opts && opts.radius !== undefined ? opts.radius : 0.5;
    var latitudeBands = opts && opts.latitudeBands !== undefined ? opts.latitudeBands : 16;
    var longitudeBands = opts && opts.longitudeBands !== undefined ? opts.longitudeBands : 16;

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
            first  = (lat * (longitudeBands+1)) + lon;
            second = first + longitudeBands + 1;

            indices.push(first + 1, second, first);
            indices.push(first + 1, second + 1, second);
        }
    }

    var options = {
        normals:   normals,
        uvs:       uvs,
        indices:   indices
    };

    var device = pc.gfx.Device.getCurrent();
    if (device.precalculatedTangents) {
        options.tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.scene.procedural.createMesh(positions, options);
};

/**
 * @function
 * @name pc.scene.procedural.createPlane
 * @description <p>Creates a procedural plane-shaped mesh.</p>
 * <p>The size and tesselation properties of the plane can be controlled via function parameters. By
 * default, the function will create a plane centred on the object space origin with a width and
 * length of 1.0 and 5 segments in either axis (50 triangles). The normal vector of the plane is aligned
 * along the positive Y axis.</p>
 * <p>Note that the plane is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the plane's mesh.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Array} opts.halfExtents The half dimensions of the plane in the X and Z axes (defaults to [0.5, 0.5]).
 * @param {Number} opts.widthSegments The number of divisions along the X axis of the plane (defaults to 5).
 * @param {Number} opts.lengthSegments The number of divisions along the Z axis of the plane (defaults to 5).
 * @returns {pc.scene.Mesh} A new plane-shaped mesh.
 * @author Will Eastcott
 */
pc.scene.procedural.createPlane = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : [0.5, 0.5];
    var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 5;
    var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 5;

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
    //         width
    for (i = 0; i <= ws; i++) {
        for (j = 0; j <= ls; j++) {
            x = -he[0] + 2.0 * he[0] * i / ws;
            y = 0.0;
            z = -(-he[1] + 2.0 * he[1] * j / ls);
            u = i / ws;
            v = j / ls;

            positions.push(x, y, z);
            normals.push(0.0, 1.0, 0.0);
            uvs.push(u, v);

            if ((i < ws) && (j < ls)) {
                indices.push(j + i * (ws + 1),       j + (i + 1) * (ws + 1),     j + i * (ws + 1) + 1);
                indices.push(j + (i + 1) * (ws + 1), j + (i + 1) * (ws + 1) + 1, j + i * (ws + 1) + 1);
            }
        }
    }

    var options = {
        normals:   normals,
        uvs:       uvs,
        indices:   indices
    };

    var device = pc.gfx.Device.getCurrent();
    if (device.precalculatedTangents) {
        options.tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.scene.procedural.createMesh(positions, options);
};

/**
 * @function
 * @name pc.scene.procedural.createBox
 * @description <p>Creates a procedural box-shaped mesh.</p>
 * <p>The size, shape and tesselation properties of the box can be controlled via function parameters. By
 * default, the function will create a box centred on the object space origin with a width, length and
 * height of 1.0 unit and 10 segments in either axis (50 triangles per face).</p>
 * <p>Note that the box is created with UVs in the range of 0 to 1 on each face. Additionally, tangent 
 * information is generated into the vertex buffer of the box's mesh.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Array} opts.halfExtents The half dimensions of the box in each axis (defaults to [0.5, 0.5, 0.5]).
 * @param {Number} opts.widthSegments The number of divisions along the X axis of the box (defaults to 1).
 * @param {Number} opts.lengthSegments The number of divisions along the Z axis of the box (defaults to 1).
 * @param {Number} opts.heightSegments The number of divisions along the Y axis of the box (defaults to 1).
 * @return {pc.scene.Mesh} A new box-shaped mesh.
 * @author Will Eastcott
 */
pc.scene.procedural.createBox = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : [0.5, 0.5, 0.5];
    var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 1;
    var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 1;
    var hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;

    var corners = [
        pc.math.vec3.create(-he[0], -he[1],  he[2]),
        pc.math.vec3.create( he[0], -he[1],  he[2]),
        pc.math.vec3.create( he[0],  he[1],  he[2]),
        pc.math.vec3.create(-he[0],  he[1],  he[2]),
        pc.math.vec3.create( he[0], -he[1], -he[2]),
        pc.math.vec3.create(-he[0], -he[1], -he[2]),
        pc.math.vec3.create(-he[0],  he[1], -he[2]),
        pc.math.vec3.create( he[0],  he[1], -he[2])
    ];

    var faceAxes = [
        [ 0, 1, 3 ], // FRONT
        [ 4, 5, 7 ], // BACK
        [ 3, 2, 6 ], // TOP
        [ 1, 0, 4 ], // BOTTOM
        [ 1, 4, 2 ], // RIGHT
        [ 5, 0, 6 ]  // LEFT
    ];

    var faceNormals = [
        [  0,  0,  1 ], // FRONT
        [  0,  0, -1 ], // BACK
        [  0,  1,  0 ], // TOP
        [  0, -1,  0 ], // BOTTOM
        [  1,  0,  0 ], // RIGHT
        [ -1,  0,  0 ]  // LEFT
    ];

    var sides = {
        FRONT  : 0,
        BACK   : 1,
        TOP    : 2,
        BOTTOM : 3,
        RIGHT  : 4,
        LEFT   : 5
    };

    var side, i, j;
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    var generateFace = function (side, uSegments, vSegments) {
        var x, y, z, u, v;
        var i, j;
        var offset = positions.length / 3;
        
        for (i = 0; i <= uSegments; i++) {
            for (j = 0; j <= vSegments; j++) {
                var temp1 = pc.math.vec3.create();
                var temp2 = pc.math.vec3.create();
                var temp3 = pc.math.vec3.create();
                var r = pc.math.vec3.create();
                pc.math.vec3.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments, temp1); 
                pc.math.vec3.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments, temp2);
                pc.math.vec3.subtract(temp2, corners[faceAxes[side][0]], temp3);
                pc.math.vec3.add(temp1, temp3, r);
                u = i / uSegments;
                v = j / vSegments;

                positions.push(r[0], r[1], r[2]);
                normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
                uvs.push(u, v);

                if ((i < uSegments) && (j < vSegments)) {
                    indices.push(offset + j + i * (uSegments + 1),       offset + j + (i + 1) * (uSegments + 1),     offset + j + i * (uSegments + 1) + 1);
                    indices.push(offset + j + (i + 1) * (uSegments + 1), offset + j + (i + 1) * (uSegments + 1) + 1, offset + j + i * (uSegments + 1) + 1);
                }
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
        normals:   normals,
        uvs:       uvs,
        indices:   indices
    };

    var device = pc.gfx.Device.getCurrent();
    if (device.precalculatedTangents) {
        options.tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);
    }

    return pc.scene.procedural.createMesh(positions, options);
};