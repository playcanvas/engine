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
 * var geometry = pc.scene.procedural.createGeometry(vertices, normals, tangents, uvs, indices);
 * @see pc.scene.procedural.createGeometry
 * @author Will Eastcott
 */
pc.scene.procedural.calculateTangents = function (vertices, normals, uvs, indices) {
    var triangleCount = indices.length / 3;
    var vertexCount   = vertices.length / 3;
    var i1, i2, i3;
    var v1, v2, v3;
    var w1, w2, w3;
    var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
    var temp  = pc.math.vec3.create(0, 0, 0);
    var i; // Loop counter
    var tan1 = [];
    var tan2 = [];
    for (var i = 0; i < vertices.length / 3; i++) {
        tan1[i] = pc.math.vec3.create(0, 0, 0);
        tan2[i] = pc.math.vec3.create(0, 0, 0);
    }
    var tangents = [];
    var sdir, tdir;

    for (i = 0; i < triangleCount; i++) {
        i1 = indices[i * 3];
        i2 = indices[i * 3 + 1];
        i3 = indices[i * 3 + 2];

        v1 = pc.math.vec3.create(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
        v2 = pc.math.vec3.create(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);
        v3 = pc.math.vec3.create(vertices[i3 * 3], vertices[i3 * 3 + 1], vertices[i3 * 3 + 2]);

        w1 = pc.math.vec2.create(uvs[i1 * 2], uvs[i1 * 2 + 1]);
        w2 = pc.math.vec2.create(uvs[i2 * 2], uvs[i2 * 2 + 1]);
        w3 = pc.math.vec2.create(uvs[i3 * 2], uvs[i3 * 2 + 1]);

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
        sdir = pc.math.vec3.create((t2 * x1 - t1 * x2) * r, 
                                   (t2 * y1 - t1 * y2) * r,
                                   (t2 * z1 - t1 * z2) * r);
        tdir = pc.math.vec3.create((s1 * x2 - s2 * x1) * r,
                                   (s1 * y2 - s2 * y1) * r,
                                   (s1 * z2 - s2 * z1) * r);
        
        pc.math.vec3.add(tan1[i1], sdir, tan1[i1]);
        pc.math.vec3.add(tan1[i2], sdir, tan1[i2]);
        pc.math.vec3.add(tan1[i3], sdir, tan1[i3]);
        
        pc.math.vec3.add(tan2[i1], tdir, tan2[i1]);
        pc.math.vec3.add(tan2[i2], tdir, tan2[i2]);
        pc.math.vec3.add(tan2[i3], tdir, tan2[i3]);
    }

    for (i = 0; i < vertexCount; i++) {
        var n = pc.math.vec3.create(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        var t = tan1[i];
        
        // Gram-Schmidt orthogonalize
        var ndott = pc.math.vec3.dot(n, t);
        pc.math.vec3.scale(n, ndott, temp);
        pc.math.vec3.subtract(t, temp, temp);
        pc.math.vec3.normalize(temp, temp);

        tangents[i * 4]     = temp[0];
        tangents[i * 4 + 1] = temp[1];
        tangents[i * 4 + 2] = temp[2];

        // Calculate handedness
        pc.math.vec3.cross(n, t, temp);
        tangents[i * 4 + 3] = (pc.math.vec3.dot(temp, tan2[i]) < 0.0) ? -1.0 : 1.0;
    }
    
    return tangents;
}

/**
 * @function
 * @name pc.scene.procedural.createGeometry
 * @description <p>Creates a Geometry object from the supplied vertex information and topology.</p>
 * <p>Note that the geometry will be created with a single submesh that will be in a triangle
 * list format. This submesh will have the supplied material assigned to it.</p>
 * @param {Array} positions An array of 3-dimensional vertex positions.
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {pc.scene.Material} opts.material The material to assign to the generated geometry's submesh.
 * @param {Boolean} opts.wireframe true to generate a wireframe representation, false for solid.
 * @param {Array} opts.normals An array of 3-dimensional vertex normals.
 * @param {Array} opts.tangents An array of 3-dimensional vertex tangents.
 * @param {Array} opts.uvs An array of 2-dimensional vertex texture coordinates.
 * @param {Array} opts.indices An array of triangle indices.
 * @returns {pc.scene.Geometry} A new Geometry constructed from the supplied vertex and triangle data.
 * @example
 * // Create a new geometry supplying optional parameters using object literal notation
 * var geometry = pc.scene.procedural.createGeometry(positions, {
 *         material: woodMaterial,
 *         normals: treeNormals,
 *         uvs: treeUvs,
 *         indices: treeIndices
 *     });
 * @author Will Eastcott
 */
pc.scene.procedural.createGeometry = function (positions, opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var material = opts && opts.material !== undefined ? opts.material : null;
    var wireframe = opts && opts.wireframe !== undefined ? opts.wireframe : false;
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
        indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, indices.length);

        // Read the indicies into the index buffer
        var dst = new Uint16Array(indexBuffer.lock());
        dst.set(indices);
        indexBuffer.unlock();
    }

    var submesh = {
        material: material,
        primitive: {
            type: wireframe ? pc.gfx.PrimType.LINES : pc.gfx.PrimType.TRIANGLES,
            base: 0,
            count: indexed ? indices.length : numVertices,
            indexed: indexed
        }
    };

    var boundingSphere = new pc.shape.Sphere();
    boundingSphere.compute(positions);
    
    var geometry = new pc.scene.Geometry();
    geometry.getVertexBuffers().push(vertexBuffer);
    geometry.setIndexBuffer(indexBuffer);
    geometry.getSubMeshes().push(submesh);
    geometry.setVolume(boundingSphere);
    return geometry;
}

/**
 * @function
 * @name pc.scene.procedural.createTorus
 * @description <p>Creates a procedural torus-shaped geometry.</p>
 * <p>The size, shape and tesselation properties of the torus can be controlled via function parameters.
 * By default, the function will create a torus in the XZ-plane with a tube radius of 0.2, a ring radius
 * of 0.3, 20 segments and 30 sides.</p>
 * <p>Note that the torus is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the torus's geometry.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {pc.scene.Material} opts.material The material to assign to the generated torus's submesh.
 * @param {Boolean} opts.wireframe true for a wireframe torus and false otherwise.
 * @param {Number} opts.tubeRadius The radius of the tube forming the body of the torus (defaults to 0.2).
 * @param {Number} opts.ringRadius The radius from the centre of the torus to the centre of the tube (defaults to 0.3).
 * @param {Number} opts.segments The number of radial divisions forming cross-sections of the torus ring (defaults to 20).
 * @param {Number} opts.sides The number of divisions around the tubular body of the torus ring (defaults to 30).
 * @returns {pc.scene.Geometry} A new torus-shaped geometry.
 * @author Will Eastcott
 */
pc.scene.procedural.createTorus = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var material = opts && opts.material !== undefined ? opts.material : null;
    var wireframe = opts && opts.wireframe !== undefined ? opts.wireframe : false;
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

    for (var i = 0; i <= sides; i++) {
        for (var j = 0; j <= segments; j++) {
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
                if (wireframe) {
                    indices.push(first, second);
                    indices.push(second, third);
                    indices.push(third, first);
                } else {
                    indices.push(first, second, third); 
                    indices.push(second, fourth, third); 
                }
            }
        }
    }

    var tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);

    return pc.scene.procedural.createGeometry(positions, {
        material:  material,
        wireframe: wireframe,
        normals:   normals,
        tangents:  tangents,
        uvs:       uvs,
        indices:   indices
    });
}

pc.scene.procedural._createConeData = function (baseRadius, peakRadius, height, heightSegments, capSegments, wireframe) {
    // Variable declarations
    var i, j;
    var x, y, z, u, v;
    var pos = pc.math.vec3.create()
    var bottomToTop = pc.math.vec3.create();
    var norm = pc.math.vec3.create();
    var top, bottom, tangent;
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];
    var cosTheta, sinTheta;

    // Define the body of the cone/cylinder
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
                var first, second, third, fourth;
                first   = ((i))     * (capSegments + 1) + ((j));
                second  = ((i))     * (capSegments + 1) + ((j + 1));
                third   = ((i + 1)) * (capSegments + 1) + ((j));
                fourth  = ((i + 1)) * (capSegments + 1) + ((j + 1));
                if (wireframe) {
                    indices.push(first, second, second, third, third, first);
                    indices.push(second, fourth, fourth, third, third, second); 
                } else {
                    indices.push(first, second, third); 
                    indices.push(second, fourth, third); 
                }
            }
        }
    }

    // Generate bottom cap
    var offset = (heightSegments + 1) * (capSegments + 1);
    if (baseRadius > 0.0) {
        for (i = 0; i <= capSegments; i++) {
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
    offset += (capSegments + 1);
    if (peakRadius > 0.0) {
        for (i = 0; i <= capSegments; i++) {
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
    
    return {
        positions: positions,
        normals: normals,
        uvs: uvs,
        indices: indices
    };
}

/**
 * @function
 * @name pc.scene.procedural.createCylinder
 * @description <p>Creates a procedural cylinder-shaped geometry.</p>
 * <p>The size, shape and tesselation properties of the cylinder can be controlled via function parameters.
 * By default, the function will create a cylinder standing vertically centred on the XZ-plane with a radius
 * of 0.5, a height of 1.0, 1 height segment and 20 cap segments.</p>
 * <p>Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cylinder's geometry.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {pc.scene.Material} opts.material The material to assign to the generated cylinder's submesh.
 * @param {Boolean} opts.wireframe true for a wireframe cone and false otherwise.
 * @param {Number} opts.radius The radius of the tube forming the body of the cylinder (defaults to 0.5).
 * @param {Number} opts.height The length of the body of the cylinder (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the length of the cylinder (defaults to 5).
 * @param {Number} opts.capSegments The number of divisions around the tubular body of the cylinder (defaults to 18).
 * @returns {pc.scene.Geometry} A new cylinder-shaped geometry.
 * @author Will Eastcott
 */
pc.scene.procedural.createCylinder = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var material = opts && opts.material !== undefined ? opts.material : null;
    var wireframe = opts && opts.wireframe !== undefined ? opts.wireframe : false;
    var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;

    // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
    var vertexData = pc.scene.procedural._createConeData(baseRadius, baseRadius, height, heightSegments, capSegments, wireframe);

    var tangents = pc.scene.procedural.calculateTangents(vertexData.positions, vertexData.normals, vertexData.uvs, vertexData.indices);

    return pc.scene.procedural.createGeometry(vertexData.positions, {
        material:  material,
        wireframe: wireframe,
        normals:   vertexData.normals,
        tangents:  tangents,
        uvs:       vertexData.uvs,
        indices:   vertexData.indices
    });
}

/**
 * @function
 * @name pc.scene.procedural.createCone
 * @description <p>Creates a procedural cone-shaped geometry.</p>
 * <p>The size, shape and tesselation properties of the cone can be controlled via function parameters.
 * By default, the function will create a cone standing vertically centred on the XZ-plane with a base radius
 * of 0.5, a height of 1.0, 5 height segments and 20 cap segments.</p>
 * <p>Note that the cone is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cone's geometry.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Boolean} opts.wireframe true for a wireframe cone and false otherwise.
 * @param {pc.scene.Material} opts.material The material to assign to the generated cone's submesh.
 * @param {Number} opts.baseRadius The base radius of the cone (defaults to 0.5).
 * @param {Number} opts.peakRadius The peak radius of the cone (defaults to 0.0).
 * @param {Number} opts.height The length of the body of the cone (defaults to 1.0).
 * @param {Number} opts.heightSegments The number of divisions along the length of the cone (defaults to 5).
 * @param {Number} opts.capSegments The number of divisions around the tubular body of the cone (defaults to 18).
 * @returns {pc.scene.Geometry} A new cone-shaped geometry.
 * @author Will Eastcott
 */
pc.scene.procedural.createCone = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var material = opts && opts.material !== undefined ? opts.material : null;
    var wireframe = opts && opts.wireframe !== undefined ? opts.wireframe : false;
    var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
    var peakRadius = opts && opts.peakRadius !== undefined ? opts.peakRadius : 0.0;
    var height = opts && opts.height !== undefined ? opts.height : 1.0;
    var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
    var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;

    var vertexData = pc.scene.procedural._createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, wireframe);

    var tangents = pc.scene.procedural.calculateTangents(vertexData.positions, vertexData.normals, vertexData.uvs, vertexData.indices);

    return pc.scene.procedural.createGeometry(vertexData.positions, {
        material:  material,
        wireframe: wireframe,
        normals:   vertexData.normals,
        tangents:  tangents,
        uvs:       vertexData.uvs,
        indices:   vertexData.indices
    });
}

/**
 * @function
 * @name pc.scene.procedural.createSphere
 * @description <p>Creates a procedural sphere-shaped geometry.</p>
 * <p>The size and tesselation properties of the sphere can be controlled via function parameters. By
 * default, the function will create a sphere centred on the object space origin with a radius of 0.5
 * and 16 segments in both longitude and latitude.</p>
 * <p>Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the sphere's geometry.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Boolean} opts.wireframe true for a wireframe sphere and false otherwise.
 * @param {pc.scene.Material} opts.material The material to assign to the generated sphere's submesh.
 * @param {Number} opts.radius The radius of the sphere (defaults to 0.5).
 * @param {Number} opts.segments The number of divisions along the longitudinal and latitudinal axes of the sphere (defaults to 16).
 * @returns {pc.scene.Geometry} A new sphere-shaped geometry.
 * @author Will Eastcott
 */
pc.scene.procedural.createSphere = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var material = opts && opts.material !== undefined ? opts.material : null;
    var wireframe = opts && opts.wireframe !== undefined ? opts.wireframe : false;
    var radius = opts && opts.radius !== undefined ? opts.radius : 0.5;
    var latitudeBands = opts && opts.latitudeBands !== undefined ? opts.latitudeBands : 16;
    var longitudeBands = opts && opts.longitudeBands !== undefined ? opts.longitudeBands : 16;

    // Variable declarations
    var theta, sinTheta, cosTheta, phi, sinPhi, cosPhi;
    var first, second;
    var x, y, z, u, v;
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    for (var lat = 0; lat <= latitudeBands; lat++) {
        theta = lat * Math.PI / latitudeBands;
        sinTheta = Math.sin(theta);
        cosTheta = Math.cos(theta);

        for (var lon = 0; lon <= longitudeBands; lon++) {
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

            if (wireframe) {
                indices.push(first + 1, second);
                indices.push(second, first);
                indices.push(first, first + 1);
            } else {
                indices.push(first + 1, second, first);
                indices.push(first + 1, second + 1, second);
            }
        }
    }

    var tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);

    return pc.scene.procedural.createGeometry(positions, {
        material:  material,
        wireframe: wireframe,
        normals:   normals,
        tangents:  tangents,
        uvs:       uvs,
        indices:   indices
    });
}

/**
 * @function
 * @name pc.scene.procedural.createPlane
 * @description <p>Creates a procedural plane-shaped geometry.</p>
 * <p>The size and tesselation properties of the plane can be controlled via function parameters. By
 * default, the function will create a plane centred on the object space origin with a width and
 * length of 1.0 and 5 segments in either axis (50 triangles). The normal vector of the plane is aligned
 * along the positive Y axis.</p>
 * <p>Note that the plane is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the plane's geometry.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Boolean} opts.wireframe true for a wireframe plane and false otherwise.
 * @param {pc.scene.Material} opts.material The material to assign to the generated plane's submesh.
 * @param {Array} opts.halfExtents The half dimensions of the plane in the X and Z axes (defaults to [0.5, 0.5]).
 * @param {Number} opts.widthSegments The number of divisions along the X axis of the plane (defaults to 5).
 * @param {Number} opts.lengthSegments The number of divisions along the Z axis of the plane (defaults to 5).
 * @returns {pc.scene.Geometry} A new plane-shaped geometry.
 * @author Will Eastcott
 */
pc.scene.procedural.createPlane = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var material = opts && opts.material !== undefined ? opts.material : null;
    var wireframe = opts && opts.wireframe !== undefined ? opts.wireframe : false;
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
                if (wireframe) {
                    indices.push(j + i * (ws + 1),       j + (i + 1) * (ws + 1));
                    indices.push(j + (i + 1) * (ws + 1), j + i * (ws + 1) + 1);
                    indices.push(j + i * (ws + 1) + 1,   j + i * (ws + 1));
                    indices.push(j + (i + 1) * (ws + 1),     j + (i + 1) * (ws + 1) + 1);
                    indices.push(j + (i + 1) * (ws + 1) + 1, j + i * (ws + 1) + 1);
                    indices.push(j + i * (ws + 1) + 1,       j + (i + 1) * (ws + 1));
                } else {
                    indices.push(j + i * (ws + 1),       j + (i + 1) * (ws + 1),     j + i * (ws + 1) + 1);
                    indices.push(j + (i + 1) * (ws + 1), j + (i + 1) * (ws + 1) + 1, j + i * (ws + 1) + 1);
                }
            }
        }
    }

    var tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);

    return pc.scene.procedural.createGeometry(positions, {
        material:  material,
        wireframe: wireframe,
        normals:   normals,
        tangents:  tangents,
        uvs:       uvs,
        indices:   indices
    });
}

/**
 * @function
 * @name pc.scene.procedural.createBox
 * @description <p>Creates a procedural box-shaped geometry.</p>
 * <p>The size, shape and tesselation properties of the box can be controlled via function parameters. By
 * default, the function will create a box centred on the object space origin with a width, length and
 * height of 1.0 unit and 10 segments in either axis (50 triangles per face).</p>
 * <p>Note that the box is created with UVs in the range of 0 to 1 on each face. Additionally, tangent 
 * information is generated into the vertex buffer of the box's geometry.</p>
 * @param {Object} opts An object that specifies optional inputs for the function as follows:
 * @param {Boolean} opts.wireframe true for a wireframe box and false otherwise.
 * @param {pc.scene.Material} opts.material The material to assign to the generated plane's submesh.
 * @param {Array} opts.halfExtents The half dimensions of the box in each axis (defaults to [0.5, 0.5, 0.5]).
 * @param {Number} opts.widthSegments The number of divisions along the X axis of the box (defaults to 5).
 * @param {Number} opts.lengthSegments The number of divisions along the Z axis of the box (defaults to 5).
 * @param {Number} opts.heightSegments The number of divisions along the Y axis of the box (defaults to 5).
 * @return {pc.scene.Geometry} A new box-shaped geometry.
 * @author Will Eastcott
 */
pc.scene.procedural.createBox = function (opts) {
    // Check the supplied options and provide defaults for unspecified ones
    var material = opts && opts.material !== undefined ? opts.material : null;
    var wireframe = opts && opts.wireframe !== undefined ? opts.wireframe : false;
    var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : [0.5, 0.5, 0.5];
    var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 5;
    var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 5;
    var hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;

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
                    if (wireframe) {
                        indices.push(offset + j + i * (uSegments + 1),       offset + j + (i + 1) * (uSegments + 1));
                        indices.push(offset + j + (i + 1) * (uSegments + 1), offset + j + i * (uSegments + 1) + 1);
                        indices.push(offset + j + i * (uSegments + 1) + 1,   offset + j + i * (uSegments + 1));
                        indices.push(offset + j + (i + 1) * (uSegments + 1),     offset + j + (i + 1) * (uSegments + 1) + 1);
                        indices.push(offset + j + (i + 1) * (uSegments + 1) + 1, offset + j + i * (uSegments + 1) + 1);
                        indices.push(offset + j + i * (uSegments + 1) + 1,       offset + j + (i + 1) * (uSegments + 1));
                    } else {
                        indices.push(offset + j + i * (uSegments + 1),       offset + j + (i + 1) * (uSegments + 1),     offset + j + i * (uSegments + 1) + 1);
                        indices.push(offset + j + (i + 1) * (uSegments + 1), offset + j + (i + 1) * (uSegments + 1) + 1, offset + j + i * (uSegments + 1) + 1);
                    }
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

    var tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, indices);

    return pc.scene.procedural.createGeometry(positions, {
        material:  material,
        wireframe: wireframe,
        normals:   normals,
        tangents:  tangents,
        uvs:       uvs,
        indices:   indices
    });
}