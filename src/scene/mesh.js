import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../math/vec3.js';

import { BoundingBox } from '../shape/bounding-box.js';

import {
    BUFFER_DYNAMIC, BUFFER_STATIC,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_LINES, PRIMITIVE_TRIANGLES,
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TEXCOORD,
    TYPE_FLOAT32, TYPE_UINT8
} from '../graphics/constants.js';
import { IndexBuffer } from '../graphics/index-buffer.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';
import { VertexIterator } from '../graphics/vertex-iterator.js';

import { RENDERSTYLE_SOLID, RENDERSTYLE_WIREFRAME } from './constants.js';

import { getApplication } from '../framework/globals.js';

var id = 0;

// Helper class used to store vertex / index data streams and related properties, when mesh is programatically modified
class GeometryData {
    constructor() {
        this.initDefaults();
    }

    initDefaults() {

        // by default, existing mesh is updated but not recreated, until .clear function is called
        this.recreate = false;

        // usage for buffers
        this.verticesUsage = BUFFER_STATIC;
        this.indicesUsage = BUFFER_STATIC;

        // vertex and index buffer allocated size (maximum number of vertices / indices that can be stored in those without the need to reallocate them)
        this.maxVertices = 0;
        this.maxIndices = 0;

        // current number of vertices and indices in use
        this.vertexCount = 0;
        this.indexCount = 0;

        // dirty flags representing what needs be updated
        this.vertexStreamsUpdated = false;
        this.indexStreamUpdated = false;

        // dictionary of vertex streams that need to be updated, looked up by semantic
        this.vertexStreamDictionary = {};

        // index stream data that needs to be updated
        this.indices = null;
    }

    _validateVertexCount(count, semantic) {

        // #ifdef DEBUG
        if (this.vertexCount !== count) {
            console.error("Vertex stream " + semantic + " has " + count + " vertices, which does not match already set streams with " + this.vertexCount + " vertices.");
        }
        // #endif
    }

    // function called when vertex stream is requested to be updated, and validates / updates currently used vertex count
    _changeVertexCount(count, semantic) {

        // update vertex count and validate it with existing streams
        if (!this.vertexCount) {
            this.vertexCount = count;
        } else {
            this._validateVertexCount(count, semantic);
        }
    }

    // default counts for vertex components
    static DEFAULT_COMPONENTS_POSITION = 3;

    static DEFAULT_COMPONENTS_NORMAL = 3;

    static DEFAULT_COMPONENTS_UV = 2;

    static DEFAULT_COMPONENTS_COLORS = 4;
}

// class storing information about single vertex data stream
class GeometryVertexStream {
    constructor(data, componentCount, dataType, dataTypeNormalize) {
        this.data = data;                           // array of data
        this.componentCount = componentCount;       // number of components
        this.dataType = dataType;                   // format of elements (pc.TYPE_FLOAT32 ..)
        this.dataTypeNormalize = dataTypeNormalize; // normalize element (divide by 255)
    }
}

/**
 * @class
 * @name pc.Mesh
 * @classdesc A graphical primitive. The mesh is defined by a {@link pc.VertexBuffer} and an optional
 * {@link pc.IndexBuffer}. It also contains a primitive definition which controls the type of the
 * primitive and the portion of the vertex or index buffer to use.
 * ***
 * Mesh APIs
 * =========
 * There are two ways a mesh can be generated or updated.
 *
 * Simple Mesh API
 * ---------
 * {@link pc.Mesh} class provides interfaces such as {@link pc.Mesh#setPositions} and {@link pc.Mesh#setUvs} that provide a simple way to provide
 * vertex and index data for the Mesh, and hiding the complexity of creating the {@link pc.VertexFormat}. This is the recommended interface to use.
 *
 * A simple example which creates a Mesh with 3 vertices, containing position coordinates only, to form a single triangle.
 * ~~~
 * var mesh = new pc.Mesh(device);
 * var positions = [0, 0, 0,     1, 0, 0,     1, 1, 0];
 * mesh.setPositions(positions);
 * mesh.update();
 * ~~~
 *
 * An example which creates a Mesh with 4 vertices, containing position and uv coordinates in channel 0, and an index buffer to form two triangles.
 * Float32Array is used for positions and uvs.
 * ~~~
 * var mesh = new pc.Mesh(device);
 * var positions = new Float32Array([0, 0, 0,     1, 0, 0,     1, 1, 0,      0, 1, 0]);
 * var uvs = new Float32Array([0, 0,     1, 0,     1, 1,     0, 1]);
 * var indices = [0, 1, 2,    0, 2, 3];
 * mesh.setPositions(positions);
 * mesh.setUvs(0, uvs);
 * mesh.setIndices(indices);
 * mesh.update();
 * ~~~
 *
 * This example demonstrated that vertex attributes such as position and normals, and also indices can be provided using Arrays ([]) and also Typed Arrays
 * (Float32Array and similar). Note that typed arrays have higher performance, and are generaly recommended for per-frame operations or larger meshes,
 * but their construction using new operator is costly operation. If you only need to operate on small number of vertices or indices, consider using the
 * Arrays instead to avoid Type Array allocation overhead.
 *
 * Follow these links for more complex examples showing the functionality.
 * * {@link http://playcanvas.github.io/#graphics/mesh-decals.html}
 * * {@link http://playcanvas.github.io/#graphics/mesh-deformation.html}
 * * {@link http://playcanvas.github.io/#graphics/mesh-generation.html}
 * * {@link http://playcanvas.github.io/#graphics/point-cloud-simulation.html}
 *
 * Update Vertex and Index buffers.
 * ---------
 * This allows greater flexibility, but is more complex to use. It allows more advanced setups, for example sharing a Vertex or Index Buffer between multiple meshes.
 * See {@link pc.VertexBuffer}, {@link pc.IndexBuffer} and {@link pc.VertexFormat} for details.
 * ***
 * @description Create a new mesh.
 * @param {pc.GraphicsDevice} [graphicsDevice] - The graphics device used to manage this mesh. If it is not provided, a device is obtained
 * from the {@link pc.Application}.
 * @property {pc.VertexBuffer} vertexBuffer The vertex buffer holding the vertex data of the mesh.
 * @property {pc.IndexBuffer[]} indexBuffer An array of index buffers. For unindexed meshes, this array can
 * be empty. The first index buffer in the array is used by {@link pc.MeshInstance}s with a renderStyle
 * property set to pc.RENDERSTYLE_SOLID. The second index buffer in the array is used if renderStyle is
 * set to pc.RENDERSTYLE_WIREFRAME.
 * @property {object[]} primitive Array of primitive objects defining how vertex (and index) data in the
 * mesh should be interpreted by the graphics device. For details on the primitive object, see.
 * @property {number} primitive[].type The type of primitive to render. Can be:
 *
 * * {@link pc.PRIMITIVE_POINTS}
 * * {@link pc.PRIMITIVE_LINES}
 * * {@link pc.PRIMITIVE_LINELOOP}
 * * {@link pc.PRIMITIVE_LINESTRIP}
 * * {@link pc.PRIMITIVE_TRIANGLES}
 * * {@link pc.PRIMITIVE_TRISTRIP}
 * * {@link pc.PRIMITIVE_TRIFAN}
 *
 * @property {number} primitive[].base The offset of the first index or vertex to dispatch in the draw call.
 * @property {number} primitive[].count The number of indices or vertices to dispatch in the draw call.
 * @property {boolean} [primitive[].indexed] True to interpret the primitive as indexed, thereby using the currently set index buffer and false otherwise.
 * {@link pc.GraphicsDevice#draw}. The primitive is ordered based on render style like the indexBuffer property.
 * @property {pc.BoundingBox} aabb The axis-aligned bounding box for the object space vertices of this mesh.
 * @property {pc.Skin} [skin] The skin data (if any) that drives skinned mesh animations for this mesh.
 * @property {pc.Morph} [morph] The morph data (if any) that drives morph target animations for this mesh.
 */
class Mesh extends RefCountedObject {
    constructor(graphicsDevice) {
        super();
        this.id = id++;
        this.device = graphicsDevice || getApplication().graphicsDevice;
        this.vertexBuffer = null;
        this.indexBuffer = [null];
        this.primitive = [{
            type: 0,
            base: 0,
            count: 0
        }];
        this.skin = null;
        this.morph = null;
        this._geometryData = null;

        // AABB for object space mesh vertices
        this._aabb = new BoundingBox();

        // Array of object space AABBs of vertices affected by each bone
        this.boneAabb = null;
    }

    get aabb() {
        return this._aabb;
    }

    set aabb(aabb) {
        this._aabb = aabb;
    }

    /**
     * @function
     * @name pc.Mesh#destroy
     * @description Destroys {@link pc.VertexBuffer} and {@link pc.IndexBuffer} associate with the mesh.
     * This is normally called by {@link pc.Model#destroy} and does not need to be called manually.
     */
    destroy() {

        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            this.vertexBuffer = null;
        }

        var j, ib;
        for (j = 0; j < this.indexBuffer.length; j++) {
            ib = this.indexBuffer[j];
            if (ib)
                ib.destroy();
        }

        this.indexBuffer.length = 0;
        this._geometryData = null;
    }

    // initializes local bounding boxes for each bone based on vertices affected by the bone
    // if morph targets are provided, it also adjusts local bone bounding boxes by maximum morph displacement
    _initBoneAabbs(morphTargets) {

        this.boneAabb = [];
        this.boneUsed = [];
        var numVerts = this.vertexBuffer.numVertices;
        var i, j, k, l;
        var x, y, z;
        var bMax, bMin;
        var boneMin = [];
        var boneMax = [];
        var boneUsed = this.boneUsed;
        var numBones = this.skin.boneNames.length;
        var aabb;
        var boneWeight, boneIndex;
        var minMorphX, minMorphY, minMorphZ;
        var maxMorphX, maxMorphY, maxMorphZ;
        var dx, dy, dz;
        var target;

        // start with empty bone bounds
        for (i = 0; i < numBones; i++) {
            boneMin[i] = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            boneMax[i] = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
        }

        // access to mesh from vertex buffer
        var iterator = new VertexIterator(this.vertexBuffer);
        var posElement = iterator.element[SEMANTIC_POSITION];
        var weightsElement = iterator.element[SEMANTIC_BLENDWEIGHT];
        var indicesElement = iterator.element[SEMANTIC_BLENDINDICES];


        // Find bone AABBs of attached vertices
        for (j = 0; j < numVerts; j++) {
            for (k = 0; k < 4; k++) {
                boneWeight = weightsElement.array[weightsElement.index + k];
                if (boneWeight > 0) {
                    boneIndex = indicesElement.array[indicesElement.index + k];
                    boneUsed[boneIndex] = true;

                    x = posElement.array[posElement.index];
                    y = posElement.array[posElement.index + 1];
                    z = posElement.array[posElement.index + 2];

                    // adjust bounds of a bone by the vertex
                    bMax = boneMax[boneIndex];
                    bMin = boneMin[boneIndex];

                    if (bMin.x > x) bMin.x = x;
                    if (bMin.y > y) bMin.y = y;
                    if (bMin.z > z) bMin.z = z;

                    if (bMax.x < x) bMax.x = x;
                    if (bMax.y < y) bMax.y = y;
                    if (bMax.z < z) bMax.z = z;

                    if (morphTargets) {

                        // find maximum displacement of the vertex by all targets
                        minMorphX = maxMorphX = x;
                        minMorphY = maxMorphY = y;
                        minMorphZ = maxMorphZ = z;

                        // morph this vertex by all morph targets
                        for (l = 0; l < morphTargets.length; l++) {
                            target = morphTargets[l];

                            dx = target.deltaPositions[j * 3];
                            dy = target.deltaPositions[j * 3 + 1];
                            dz = target.deltaPositions[j * 3 + 2];

                            if (dx < 0) {
                                minMorphX += dx;
                            } else {
                                maxMorphX += dx;
                            }

                            if (dy < 0) {
                                minMorphY += dy;
                            } else {
                                maxMorphY += dy;
                            }

                            if (dz < 0) {
                                minMorphZ += dz;
                            } else {
                                maxMorphZ += dz;
                            }
                        }

                        if (bMin.x > minMorphX) bMin.x = minMorphX;
                        if (bMin.y > minMorphY) bMin.y = minMorphY;
                        if (bMin.z > minMorphZ) bMin.z = minMorphZ;

                        if (bMax.x < maxMorphX) bMax.x = maxMorphX;
                        if (bMax.y < maxMorphY) bMax.y = maxMorphY;
                        if (bMax.z < maxMorphZ) bMax.z = maxMorphZ;
                    }
                }
            }
            iterator.next();
        }

        // store bone bounding boxes
        for (i = 0; i < numBones; i++) {
            aabb = new BoundingBox();
            aabb.setMinMax(boneMin[i], boneMax[i]);
            this.boneAabb.push(aabb);
        }
    }

    // when mesh API to modify vertex / index data are used, this allocates structure to store the data
    _initGeometryData() {
        if (!this._geometryData) {
            this._geometryData = new GeometryData();

            // if vertex buffer exists aleady, store the sizes
            if (this.vertexBuffer) {
                this._geometryData.vertexCount = this.vertexBuffer.numVertices;
                this._geometryData.maxVertices = this.vertexBuffer.numVertices;
            }

            // if index buffer exists aleady, store the sizes
            if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
                this._geometryData.indexCount = this.indexBuffer[0].numIndices;
                this._geometryData.maxIndices = this.indexBuffer[0].numIndices;
            }
        }
    }

    /**
     * @function
     * @name pc.Mesh#clear
     * @description Clears the mesh of existing vertices and indices and resets the
     * {@link pc.VertexFormat} associated with the mesh. This call is typically followed by calls
     * to methods such as {@link pc.Mesh#setPositions}, {@link pc.Mesh#setVertexStream} or {@link pc.Mesh#setIndices} and
     * finally {@link pc.Mesh#update} to rebuild the mesh, allowing different {@link pc.VertexFormat}.
     * @param {boolean} [verticesDynamic] - Indicates the {@link pc.VertexBuffer} should be created with {@link pc.BUFFER_DYNAMIC} usage. If not specified, {@link pc.BUFFER_STATIC} is used.
     * @param {boolean} [indicesDynamic] - Indicates the {@link pc.IndexBuffer} should be created with {@link pc.BUFFER_DYNAMIC} usage. If not specified, {@link pc.BUFFER_STATIC} is used.
     * @param {number} [maxVertices] - {@link pc.VertexBuffer} will be allocated with at least maxVertices, allowing additional vertices to be added to it without the allocation. If
     * no value is provided, a size to fit the provided vertices will be allocated.
     * @param {number} [maxIndices] - {@link pc.IndexBuffer} will be allocated with at least maxIndices, allowing additional indices to be added to it without the allocation. If
     * no value is provided, a size to fit the provided indices will be allocated.
     */
    clear(verticesDynamic, indicesDynamic, maxVertices = 0, maxIndices = 0) {
        this._initGeometryData();
        this._geometryData.initDefaults();

        this._geometryData.recreate = true;
        this._geometryData.maxVertices = maxVertices;
        this._geometryData.maxIndices = maxIndices;
        this._geometryData.verticesUsage = verticesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
        this._geometryData.indicesUsage = indicesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
    }

    /**
     * @function
     * @name pc.Mesh#setVertexStream
     * @description Sets the vertex data for any supported semantic.
     * @param {string} semantic - The meaning of the vertex element. For supported semantics, see pc.SEMANTIC_* in {@link pc.VertexFormat}.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - Vertex data for the specified semantic.
     * @param {number} componentCount - The number of values that form a single Vertex element. For example when setting a 3D position represented by 3 numbers
     * per vertex, number 3 should be specified.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not provided, the whole data array is used. This allows to use only part of the data array.
     * @param {number} [dataType] - The format of data when stored in the {@link pc.VertexBuffer}, see pc.TYPE_* in {@link pc.VertexFormat}. When not specified, pc.TYPE_FLOAT32 is used.
     * @param {boolean} [dataTypeNormalize] - If true, vertex attribute data will be mapped from a 0 to 255 range down to 0 to 1 when fed to a shader.
     * If false, vertex attribute data is left unchanged. If this property is unspecified, false is assumed.
     */
    setVertexStream(semantic, data, componentCount, numVertices, dataType = TYPE_FLOAT32, dataTypeNormalize = false) {
        this._initGeometryData();
        var vertexCount = numVertices || data.length / componentCount;
        this._geometryData._changeVertexCount(vertexCount, semantic);
        this._geometryData.vertexStreamsUpdated = true;

        this._geometryData.vertexStreamDictionary[semantic] = new GeometryVertexStream(
            data,
            componentCount,
            dataType,
            dataTypeNormalize
        );
    }

    /**
     * @function
     * @name pc.Mesh#getVertexStream
     * @description Gets the vertex data corresponding to a semantic.
     * @param {string} semantic - The semantic of the vertex element to get. For supported semantics, see pc.SEMANTIC_* in {@link pc.VertexFormat}.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - An array to populate with the vertex data.
     * When typed array is supplied, enough space needs to be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getVertexStream(semantic, data) {
        var count = 0;
        var done = false;

        // see if we have un-applied stream
        if (this._geometryData) {
            var stream = this._geometryData.vertexStreamDictionary[semantic];
            if (stream) {
                done = true;
                count = this._geometryData.vertexCount;

                if (ArrayBuffer.isView(data)) {
                    // destination data is typed array
                    data.set(stream.data);
                } else {
                    // destination data is array
                    data.length = 0;
                    data.push(stream.data);
                }
            }
        }

        if (!done) {
            // get stream from VertexBuffer
            if (this.vertexBuffer) {
                // note: there is no need to .end the iterator, as we are only reading data from it
                var iterator = new VertexIterator(this.vertexBuffer);
                count = iterator.readData(semantic, data);
            }
        }

        return count;
    }

    /**
     * @function
     * @name pc.Mesh#setPositions
     * @description Sets the vertex positions array. Vertices are stored using pc.TYPE_FLOAT32 format.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} positions - Vertex data containing positions.
     * @param {number} [componentCount] - The number of values that form a single position element. Defaults to 3 if not specified, corresponding to x, y and z coordinates.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not provided, the whole data array is used. This allows to use only part of the data array.
     */
    setPositions(positions, componentCount = GeometryData.DEFAULT_COMPONENTS_POSITION, numVertices) {
        this.setVertexStream(SEMANTIC_POSITION, positions, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * @function
     * @name pc.Mesh#setNormals
     * @description Sets the vertex normals array. Normals are stored using pc.TYPE_FLOAT32 format.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} normals - Vertex data containing normals.
     * @param {number} [componentCount] - The number of values that form a single normal element. Defaults to 3 if not specified, corresponding to x, y and z direction.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not provided, the whole data array is used. This allows to use only part of the data array.
     */
    setNormals(normals, componentCount = GeometryData.DEFAULT_COMPONENTS_NORMAL, numVertices) {
        this.setVertexStream(SEMANTIC_NORMAL, normals, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * @function
     * @name pc.Mesh#setUvs
     * @description Sets the vertex uv array. Uvs are stored using pc.TYPE_FLOAT32 format.
     * @param {number} channel - The uv channel in [0..7] range.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} uvs - Vertex data containing uv-coordinates.
     * @param {number} [componentCount] - The number of values that form a single uv element. Defaults to 2 if not specified, corresponding to u and v coordinates.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not provided, the whole data array is used. This allows to use only part of the data array.
     */
    setUvs(channel, uvs, componentCount = GeometryData.DEFAULT_COMPONENTS_UV, numVertices) {
        this.setVertexStream(SEMANTIC_TEXCOORD + channel, uvs, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * @function
     * @name pc.Mesh#setColors
     * @description Sets the vertex color array. Colors are stored using pc.TYPE_FLOAT32 format, which is useful for HDR colors.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - Vertex data containing colors.
     * @param {number} [componentCount] - The number of values that form a single color element. Defaults to 4 if not specified, corresponding to r, g, b and a.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not provided, the whole data array is used. This allows to use only part of the data array.
     */
    setColors(colors, componentCount = GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices) {
        this.setVertexStream(SEMANTIC_COLOR, colors, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * @function
     * @name pc.Mesh#setColors32
     * @description Sets the vertex color array. Colors are stored using pc.TYPE_UINT8 format, which is useful for LDR colors. Values in the array are expected in
     * [0..255] range, and are mapped to [0..1] range in the shader.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - Vertex data containing colors. The array is
     * expected to contain 4 components per vertex, corresponding to r, g, b and a.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not provided, the whole data array is used. This allows to use only part of the data array.
     */
    setColors32(colors, numVertices) {
        this.setVertexStream(SEMANTIC_COLOR, colors, GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices, TYPE_UINT8, true);
    }

    /**
     * @function
     * @name pc.Mesh#setIndices
     * @description Sets the index array. Indices are stored using 16-bit format by default, unless more than 65535 vertices are specified, in which case 32-bit format is used.
     * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - The array of indicies that define primitives (lines, triangles, etc.).
     * @param {number} [numIndices] - The number of indices to be used from data array. If not provided, the whole data array is used. This allows to use only part of the data array.
     */
    setIndices(indices, numIndices) {
        this._initGeometryData();
        this._geometryData.indexStreamUpdated = true;
        this._geometryData.indices = indices;
        this._geometryData.indexCount = numIndices || indices.length;
    }

    /**
     * @function
     * @name pc.Mesh#getPositions
     * @description Gets the vertex positions data.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} positions - An array to populate with the vertex data.
     * When typed array is supplied, enough space needs to be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getPositions(positions) {
        return this.getVertexStream(SEMANTIC_POSITION, positions);
    }

    /**
     * @function
     * @name pc.Mesh#getNormals
     * @description Gets the vertex normals data.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} normals - An array to populate with the vertex data.
     * When typed array is supplied, enough space needs to be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getNormals(normals) {
        return this.getVertexStream(SEMANTIC_NORMAL, normals);
    }

    /**
     * @function
     * @name pc.Mesh#getUvs
     * @description Gets the vertex uv data.
     * @param {number} channel - The uv channel in [0..7] range.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} uvs - An array to populate with the vertex data.
     * When typed array is supplied, enough space needs to be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getUvs(channel, uvs) {
        return this.getVertexStream(SEMANTIC_TEXCOORD + channel, uvs);
    }

    /**
     * @function
     * @name pc.Mesh#getColors
     * @description Gets the vertex color data.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - An array to populate with the vertex data.
     * When typed array is supplied, enough space needs to be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getColors(colors) {
        return this.getVertexStream(SEMANTIC_COLOR, colors);
    }

    /**
     * @function
     * @name pc.Mesh#getIndices
     * @description Gets the index data.
     * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - An array to populate with the index data.
     * When a typed array is supplied, enough space needs to be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of indices populated.
     */
    getIndices(indices) {
        var count = 0;

        // see if we have un-applied indices
        if (this._geometryData && this._geometryData.indices) {
            var streamIndices = this._geometryData.indices;
            count = this._geometryData.indexCount;

            if (ArrayBuffer.isView(indices)) {
                // destination data is typed array
                indices.set(streamIndices);
            } else {
                // destination data is array
                indices.length = 0;
                indices.push(streamIndices);
            }
        } else {
            // get data from IndexBuffer
            if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
                var indexBuffer = this.indexBuffer[0];
                count = indexBuffer.readData(indices);
            }
        }

        return count;
    }

    /**
     * @function
     * @name pc.Mesh#update
     * @description Applies any changes to vertex stream and indices to mesh. This allocates or reallocates {@link pc.vertexBuffer} or {@link pc.IndexBuffer}
     * to fit all provided vertices and indices, and fills them with data.
     * @param {number} [primitiveType] - The type of primitive to render. Can be one of pc.PRIMITIVE_* - see primitive[].type section above. Defaults
     * to pc.PRIMITIVE_TRIANGLES if unspecified.
     * @param {boolean} [updateBoundingBox] - True to update bounding box. Bounding box is updated only if positions were set since last time update
     * was called, and componentCount for position was 3, otherwise bounding box is not updated. See {@link pc.Mesh#setPositions}. Defaults to true if unspecified.
     * Set this to false to avoid update of the bounding box and use aabb property to set it instead.
     */
    update(primitiveType = PRIMITIVE_TRIANGLES, updateBoundingBox = true) {

        if (this._geometryData) {

            // update bounding box if needed
            if (updateBoundingBox) {

                // find vec3 position stream
                var stream = this._geometryData.vertexStreamDictionary[SEMANTIC_POSITION];
                if (stream) {
                    if (stream.componentCount == 3) {
                        this._aabb.compute(stream.data, this._geometryData.vertexCount);
                    }
                }
            }

            // destroy vertex buffer if recreate was requested or if vertices don't fit
            var destroyVB = this._geometryData.recreate;
            if (this._geometryData.vertexCount > this._geometryData.maxVertices) {
                destroyVB = true;
                this._geometryData.maxVertices = this._geometryData.vertexCount;
            }

            if (destroyVB) {
                if (this.vertexBuffer) {
                    this.vertexBuffer.destroy();
                    this.vertexBuffer = null;
                }
            }

            // destroy index buffer if recreate was requested or if indices don't fit
            var destroyIB = this._geometryData.recreate;
            if (this._geometryData.indexCount > this._geometryData.maxIndices) {
                destroyIB = true;
                this._geometryData.maxIndices = this._geometryData.indexCount;
            }

            if (destroyIB) {
                if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
                    this.indexBuffer[0].destroy();
                    this.indexBuffer[0] = null;
                }
            }

            // update vertices if needed
            if (this._geometryData.vertexStreamsUpdated) {
                this._updateVertexBuffer();
            }

            // update indices if needed
            if (this._geometryData.indexStreamUpdated) {
                this._updateIndexBuffer();
            }

            // set up primitive parameters
            this.primitive[0].type = primitiveType;

            if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {      // indexed
                if (this._geometryData.indexStreamUpdated) {
                    this.primitive[0].count = this._geometryData.indexCount;
                    this.primitive[0].indexed = true;
                }
            } else {        // non-indexed
                if (this._geometryData.vertexStreamsUpdated) {
                    this.primitive[0].count = this._geometryData.vertexCount;
                    this.primitive[0].indexed = false;
                }
            }

            // counts can be changed on next frame, so set them to 0
            this._geometryData.vertexCount = 0;
            this._geometryData.indexCount = 0;

            this._geometryData.vertexStreamsUpdated = false;
            this._geometryData.indexStreamUpdated = false;
            this._geometryData.recreate = false;
        }
    }

    // builds vertex format based on attached vertex streams
    _buildVertexFormat(vertexCount) {

        var vertexDesc = [];

        for (var semantic in this._geometryData.vertexStreamDictionary) {
            var stream = this._geometryData.vertexStreamDictionary[semantic];
            vertexDesc.push({
                semantic: semantic,
                components: stream.componentCount,
                type: stream.dataType,
                normalize: stream.dataTypeNormalize
            });
        }

        return new VertexFormat(this.device, vertexDesc, vertexCount);
    }

    // copy attached data into vertex buffer
    _updateVertexBuffer() {

        // if we don't have vertex buffer, create new one, otherwise update existing one
        if (!this.vertexBuffer) {
            var allocateVertexCount = this._geometryData.maxVertices;
            var format = this._buildVertexFormat(allocateVertexCount);
            this.vertexBuffer = new VertexBuffer(this.device, format, allocateVertexCount, this._geometryData.verticesUsage);
        }

        // lock vertex buffer and create typed access arrays for individual elements
        var iterator = new VertexIterator(this.vertexBuffer);

        // copy all stream data into vertex buffer
        var numVertices = this._geometryData.vertexCount;
        for (var semantic in this._geometryData.vertexStreamDictionary) {
            var stream = this._geometryData.vertexStreamDictionary[semantic];
            iterator.writeData(semantic, stream.data, numVertices);

            // remove stream
            delete this._geometryData.vertexStreamDictionary[semantic];
        }

        iterator.end();
    }

    // copy attached data into index buffer
    _updateIndexBuffer() {

        // if we don't have index buffer, create new one, otherwise update existing one
        if (this.indexBuffer.length <= 0 || !this.indexBuffer[0]) {
            var createFormat = this._geometryData.maxVertices > 0xffff ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
            this.indexBuffer[0] = new IndexBuffer(this.device, createFormat, this._geometryData.maxIndices, this._geometryData.indicesUsage);
        }

        var srcIndices = this._geometryData.indices;
        if (srcIndices) {

            var indexBuffer = this.indexBuffer[0];
            indexBuffer.writeData(srcIndices, this._geometryData.indexCount);

            // remove data
            this._geometryData.indices = null;
        }
    }

    generateWireframe() {
        var typedArray = function (indexBuffer) {
            switch (indexBuffer.format) {
                case INDEXFORMAT_UINT8:
                    return new Uint8Array(indexBuffer.storage);
                case INDEXFORMAT_UINT16:
                    return new Uint16Array(indexBuffer.storage);
                case INDEXFORMAT_UINT32:
                    return new Uint32Array(indexBuffer.storage);
                default:
                    return null;
            }
        };

        var lines = [];
        var format;
        if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
            var offsets = [[0, 1], [1, 2], [2, 0]];

            var base = this.primitive[RENDERSTYLE_SOLID].base;
            var count = this.primitive[RENDERSTYLE_SOLID].count;
            var indexBuffer = this.indexBuffer[RENDERSTYLE_SOLID];
            var srcIndices = typedArray(indexBuffer);

            var uniqueLineIndices = {};

            for (var j = base; j < base + count; j += 3) {
                for (var k = 0; k < 3; k++) {
                    var i1 = srcIndices[j + offsets[k][0]];
                    var i2 = srcIndices[j + offsets[k][1]];
                    var line = (i1 > i2) ? ((i2 << 16) | i1) : ((i1 << 16) | i2);
                    if (uniqueLineIndices[line] === undefined) {
                        uniqueLineIndices[line] = 0;
                        lines.push(i1, i2);
                    }
                }
            }
            format = indexBuffer.format;
        } else {
            for (var i = 0; i < this.vertexBuffer.numVertices; i += 3) {
                lines.push(i, i + 1, i + 1, i + 2, i + 2, i);
            }
            format = lines.length > 65535 ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
        }

        var wireBuffer = new IndexBuffer(this.vertexBuffer.device, format, lines.length);
        var dstIndices = typedArray(wireBuffer);
        dstIndices.set(lines);
        wireBuffer.unlock();

        this.primitive[RENDERSTYLE_WIREFRAME] = {
            type: PRIMITIVE_LINES,
            base: 0,
            count: lines.length,
            indexed: true
        };
        this.indexBuffer[RENDERSTYLE_WIREFRAME] = wireBuffer;
    }
}

export { Mesh };
