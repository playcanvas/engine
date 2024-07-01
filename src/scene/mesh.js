import { Debug } from '../core/debug.js';
import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { BoundingBox } from '../core/shape/bounding-box.js';

import {
    BUFFER_DYNAMIC, BUFFER_STATIC,
    INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_LINES, PRIMITIVE_TRIANGLES, PRIMITIVE_POINTS,
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TEXCOORD,
    TYPE_FLOAT32, TYPE_UINT8, TYPE_INT8, TYPE_INT16, TYPE_UINT16,
    typedArrayIndexFormats,
    SEMANTIC_TANGENT
} from '../platform/graphics/constants.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { VertexIterator } from '../platform/graphics/vertex-iterator.js';

import { RENDERSTYLE_SOLID, RENDERSTYLE_WIREFRAME, RENDERSTYLE_POINTS } from './constants.js';

let id = 0;

// Helper class used to store vertex / index data streams and related properties, when mesh is programmatically modified
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

    // function called when vertex stream is requested to be updated, and validates / updates currently used vertex count
    _changeVertexCount(count, semantic) {

        // update vertex count and validate it with existing streams
        if (!this.vertexCount) {
            this.vertexCount = count;
        } else {
            Debug.assert(this.vertexCount === count, `Vertex stream ${semantic} has ${count} vertices, which does not match already set streams with ${this.vertexCount} vertices.`);
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
    constructor(data, componentCount, dataType, dataTypeNormalize, asInt) {
        this.data = data;                           // array of data
        this.componentCount = componentCount;       // number of components
        this.dataType = dataType;                   // format of elements (pc.TYPE_FLOAT32 ..)
        this.dataTypeNormalize = dataTypeNormalize; // normalize element (divide by 255)
        this.asInt = asInt;                         // treat data as integer (WebGL2 and WebGPU only)
    }
}

/**
 * A graphical primitive. The mesh is defined by a {@link VertexBuffer} and an optional
 * {@link IndexBuffer}. It also contains a primitive definition which controls the type of the
 * primitive and the portion of the vertex or index buffer to use.
 *
 * ## Mesh APIs
 * There are two ways a mesh can be generated or updated.
 *
 * ### Simple Mesh API
 * {@link Mesh} class provides interfaces such as {@link Mesh#setPositions} and {@link Mesh#setUvs}
 * that provide a simple way to provide vertex and index data for the Mesh, and hiding the
 * complexity of creating the {@link VertexFormat}. This is the recommended interface to use.
 *
 * A simple example which creates a Mesh with 3 vertices, containing position coordinates only, to
 * form a single triangle.
 *
 * ```javascript
 * const mesh = new pc.Mesh(device);
 * const positions = [
 *     0, 0, 0, // pos 0
 *     1, 0, 0, // pos 1
 *     1, 1, 0  // pos 2
 * ];
 * mesh.setPositions(positions);
 * mesh.update();
 * ```
 *
 * An example which creates a Mesh with 4 vertices, containing position and uv coordinates in
 * channel 0, and an index buffer to form two triangles. Float32Array is used for positions and uvs.
 *
 * ```javascript
 * const mesh = new pc.Mesh(device);
 * const positions = new Float32Array([
 *     0, 0, 0, // pos 0
 *     1, 0, 0, // pos 1
 *     1, 1, 0, // pos 2
 *     0, 1, 0  // pos 3
 * ]);
 * const uvs = new Float32Array([
 *     0, 1  // uv 3
 *     1, 1, // uv 2
 *     1, 0, // uv 1
 *     0, 0, // uv 0
 * ]);
 * const indices = [
 *     0, 1, 2, // triangle 0
 *     0, 2, 3  // triangle 1
 * ];
 * mesh.setPositions(positions);
 * mesh.setNormals(pc.calculateNormals(positions, indices));
 * mesh.setUvs(0, uvs);
 * mesh.setIndices(indices);
 * mesh.update();
 * ```
 *
 * This example demonstrates that vertex attributes such as position and normals, and also indices
 * can be provided using Arrays ([]) and also Typed Arrays (Float32Array and similar). Note that
 * typed arrays have higher performance, and are generally recommended for per-frame operations or
 * larger meshes, but their construction using new operator is costly operation. If you only need
 * to operate on a small number of vertices or indices, consider using Arrays to avoid the overhead
 * associated with allocating Typed Arrays.
 *
 * Follow these links for more complex examples showing the functionality.
 *
 * - {@link https://playcanvas.github.io/#graphics/mesh-decals}
 * - {@link https://playcanvas.github.io/#graphics/mesh-deformation}
 * - {@link https://playcanvas.github.io/#graphics/mesh-generation}
 * - {@link https://playcanvas.github.io/#graphics/point-cloud-simulation}
 *
 * ### Update Vertex and Index buffers
 * This allows greater flexibility, but is more complex to use. It allows more advanced setups, for
 * example sharing a Vertex or Index Buffer between multiple meshes. See {@link VertexBuffer},
 * {@link IndexBuffer} and {@link VertexFormat} for details.
 *
 * @category Graphics
 */
class Mesh extends RefCountedObject {
    /**
     * An array of index buffers. For unindexed meshes, this array can be empty. The first index
     * buffer in the array is used by {@link MeshInstance}s with a `renderStyle` property set to
     * {@link RENDERSTYLE_SOLID}. The second index buffer in the array is used if `renderStyle` is
     * set to {@link RENDERSTYLE_WIREFRAME}.
     *
     * @type {IndexBuffer[]}
     */
    indexBuffer = [null];

    /**
     * The vertex buffer holding the vertex data of the mesh.
     *
     * @type {VertexBuffer}
     */
    vertexBuffer = null;

    /**
     * Array of primitive objects defining how vertex (and index) data in the mesh should be
     * interpreted by the graphics device.
     *
     * - `type` is the type of primitive to render. Can be:
     *
     *   - {@link PRIMITIVE_POINTS}
     *   - {@link PRIMITIVE_LINES}
     *   - {@link PRIMITIVE_LINELOOP}
     *   - {@link PRIMITIVE_LINESTRIP}
     *   - {@link PRIMITIVE_TRIANGLES}
     *   - {@link PRIMITIVE_TRISTRIP}
     *   - {@link PRIMITIVE_TRIFAN}
     *
     * - `base` is the offset of the first index or vertex to dispatch in the draw call.
     * - `count` is the number of indices or vertices to dispatch in the draw call.
     * - `indexed` specifies whether to interpret the primitive as indexed, thereby using the
     * currently set index buffer.
     *
     * @type {{type: number, base: number, count: number, indexed?: boolean}[]}
     */
    primitive = [{
        type: 0,
        base: 0,
        count: 0
    }];

    /**
     * The skin data (if any) that drives skinned mesh animations for this mesh.
     *
     * @type {import('./skin.js').Skin|null}
     */
    skin = null;

    /**
     * Array of object space AABBs of vertices affected by each bone.
     *
     * @type {BoundingBox[]|null}
     * @ignore
     */
    boneAabb = null;

    /**
     * Internal version of AABB, incremented when local AABB changes.
     *
     * @ignore
     */
    _aabbVer = 0;

    /**
     * AABB representing object space bounds of the mesh.
     *
     * @type {BoundingBox}
     * @private
     */
    _aabb = new BoundingBox();

    /**
     * @type {GeometryData|null}
     * @private
     */
    _geometryData = null;

    /**
     * @type {import('./morph.js').Morph|null}
     * @private
     */
    _morph = null;

    /**
     * True if the created index buffer should be accessible as a storage buffer in compute shader.
     *
     * @type {boolean}
     * @private
     */
    _storageIndex = false;

    /**
     * True if the created vertex buffer should be accessible as a storage buffer in compute shader.
     *
     * @type {boolean}
     * @private
     */
    _storageVertex = false;

    /**
     * Create a new Mesh instance.
     *
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device used to manage this mesh.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {boolean} [options.storageVertex] - Defines if the vertex buffer can be used as
     * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
     * @param {boolean} [options.storageIndex] - Defines if the index buffer can be used as
     * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
     */
    constructor(graphicsDevice, options) {
        super();
        this.id = id++;
        Debug.assert(graphicsDevice, "Mesh constructor takes a GraphicsDevice as a parameter, and it was not provided.");
        this.device = graphicsDevice;

        this._storageIndex = options?.storageIndex || false;
        this._storageVertex = options?.storageVertex || false;
    }

    /**
     * Create a new Mesh instance from {@link Geometry} object.
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device used to manage this mesh.
     * @param {import('./geometry/geometry.js').Geometry} geometry - The geometry object to create
     * the mesh from.
     * @param {object} [options] - An object that specifies optional inputs for the function as follows:
     * @param {boolean} [options.storageVertex] - Defines if the vertex buffer of the mesh can be used as
     * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
     * @param {boolean} [options.storageIndex] - Defines if the index buffer of the mesh can be used as
     * a storage buffer by a compute shader. Defaults to false. Only supported on WebGPU.
     * @returns {Mesh} A new mesh.
     */
    static fromGeometry(graphicsDevice, geometry, options = {}) {

        const mesh = new Mesh(graphicsDevice, options);

        const { positions, normals, tangents, colors, uvs, uvs1, blendIndices, blendWeights, indices } = geometry;

        if (positions) {
            mesh.setPositions(positions);
        }

        if (normals) {
            mesh.setNormals(normals);
        }

        if (tangents) {
            mesh.setVertexStream(SEMANTIC_TANGENT, tangents, 4);
        }

        if (colors) {
            mesh.setColors32(colors);
        }

        if (uvs) {
            mesh.setUvs(0, uvs);
        }

        if (uvs1) {
            mesh.setUvs(1, uvs1);
        }

        if (blendIndices) {
            mesh.setVertexStream(SEMANTIC_BLENDINDICES, blendIndices, 4, blendIndices.length / 4, TYPE_UINT8);
        }

        if (blendWeights) {
            mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, blendWeights, 4);
        }

        if (indices) {
            mesh.setIndices(indices);
        }

        mesh.update();
        return mesh;
    }

    /**
     * Sets the morph data that drives morph target animations for this mesh. Set to null if
     * morphing is not used.
     *
     * @type {import('./morph.js').Morph|null}
     */
    set morph(morph) {

        if (morph !== this._morph) {
            if (this._morph) {
                this._morph.decRefCount();
            }

            this._morph = morph;

            if (morph) {
                morph.incRefCount();
            }
        }
    }

    /**
     * Gets the morph data that drives morph target animations for this mesh.
     *
     * @type {import('./morph.js').Morph|null}
     */
    get morph() {
        return this._morph;
    }

    /**
     * Sets the axis-aligned bounding box for the object space vertices of this mesh.
     *
     * @type {BoundingBox}
     */
    set aabb(aabb) {
        this._aabb = aabb;
        this._aabbVer++;
    }

    /**
     * Gets the axis-aligned bounding box for the object space vertices of this mesh.
     *
     * @type {BoundingBox}
     */
    get aabb() {
        return this._aabb;
    }

    /**
     * Destroys the {@link VertexBuffer} and {@link IndexBuffer}s associated with the mesh. This is
     * normally called by {@link Model#destroy} and does not need to be called manually.
     */
    destroy() {

        const morph = this.morph;
        if (morph) {

            // this decreases ref count on the morph
            this.morph = null;

            // destroy morph
            if (morph.refCount < 1) {
                morph.destroy();
            }
        }

        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            this.vertexBuffer = null;
        }

        for (let j = 0; j < this.indexBuffer.length; j++) {
            this._destroyIndexBuffer(j);
        }

        this.indexBuffer.length = 0;
        this._geometryData = null;
    }

    _destroyIndexBuffer(index) {
        if (this.indexBuffer[index]) {
            this.indexBuffer[index].destroy();
            this.indexBuffer[index] = null;
        }
    }

    // initializes local bounding boxes for each bone based on vertices affected by the bone
    // if morph targets are provided, it also adjusts local bone bounding boxes by maximum morph displacement
    _initBoneAabbs(morphTargets) {

        this.boneAabb = [];
        this.boneUsed = [];
        let x, y, z;
        let bMax, bMin;
        const boneMin = [];
        const boneMax = [];
        const boneUsed = this.boneUsed;
        const numBones = this.skin.boneNames.length;
        let maxMorphX, maxMorphY, maxMorphZ;

        // start with empty bone bounds
        for (let i = 0; i < numBones; i++) {
            boneMin[i] = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            boneMax[i] = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
        }

        // access to mesh from vertex buffer
        const iterator = new VertexIterator(this.vertexBuffer);
        const posElement = iterator.element[SEMANTIC_POSITION];
        const weightsElement = iterator.element[SEMANTIC_BLENDWEIGHT];
        const indicesElement = iterator.element[SEMANTIC_BLENDINDICES];

        // Find bone AABBs of attached vertices
        const numVerts = this.vertexBuffer.numVertices;
        for (let j = 0; j < numVerts; j++) {
            for (let k = 0; k < 4; k++) {
                const boneWeight = weightsElement.array[weightsElement.index + k];
                if (boneWeight > 0) {
                    const boneIndex = indicesElement.array[indicesElement.index + k];
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
                        let minMorphX = maxMorphX = x;
                        let minMorphY = maxMorphY = y;
                        let minMorphZ = maxMorphZ = z;

                        // morph this vertex by all morph targets
                        for (let l = 0; l < morphTargets.length; l++) {
                            const target = morphTargets[l];

                            const dx = target.deltaPositions[j * 3];
                            const dy = target.deltaPositions[j * 3 + 1];
                            const dz = target.deltaPositions[j * 3 + 2];

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

        // account for normalized positional data
        const positionElement = this.vertexBuffer.getFormat().elements.find(e => e.name === SEMANTIC_POSITION);
        if (positionElement && positionElement.normalize) {
            const func = (() => {
                switch (positionElement.dataType) {
                    case TYPE_INT8: return x => Math.max(x / 127.0, -1.0);
                    case TYPE_UINT8: return x => x / 255.0;
                    case TYPE_INT16: return x => Math.max(x / 32767.0, -1.0);
                    case TYPE_UINT16: return x => x / 65535.0;
                    default: return x => x;
                }
            })();

            for (let i = 0; i < numBones; i++) {
                if (boneUsed[i]) {
                    const min = boneMin[i];
                    const max = boneMax[i];
                    min.set(func(min.x), func(min.y), func(min.z));
                    max.set(func(max.x), func(max.y), func(max.z));
                }
            }
        }

        // store bone bounding boxes
        for (let i = 0; i < numBones; i++) {
            const aabb = new BoundingBox();
            aabb.setMinMax(boneMin[i], boneMax[i]);
            this.boneAabb.push(aabb);
        }
    }

    // when mesh API to modify vertex / index data are used, this allocates structure to store the data
    _initGeometryData() {
        if (!this._geometryData) {
            this._geometryData = new GeometryData();

            // if vertex buffer exists already, store the sizes
            if (this.vertexBuffer) {
                this._geometryData.vertexCount = this.vertexBuffer.numVertices;
                this._geometryData.maxVertices = this.vertexBuffer.numVertices;
            }

            // if index buffer exists already, store the sizes
            if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
                this._geometryData.indexCount = this.indexBuffer[0].numIndices;
                this._geometryData.maxIndices = this.indexBuffer[0].numIndices;
            }
        }
    }

    /**
     * Clears the mesh of existing vertices and indices and resets the {@link VertexFormat}
     * associated with the mesh. This call is typically followed by calls to methods such as
     * {@link Mesh#setPositions}, {@link Mesh#setVertexStream} or {@link Mesh#setIndices} and
     * finally {@link Mesh#update} to rebuild the mesh, allowing different {@link VertexFormat}.
     *
     * @param {boolean} [verticesDynamic] - Indicates the {@link VertexBuffer} should be created
     * with {@link BUFFER_DYNAMIC} usage. If not specified, {@link BUFFER_STATIC} is used.
     * @param {boolean} [indicesDynamic] - Indicates the {@link IndexBuffer} should be created with
     * {@link BUFFER_DYNAMIC} usage. If not specified, {@link BUFFER_STATIC} is used.
     * @param {number} [maxVertices] - A {@link VertexBuffer} will be allocated with at least
     * maxVertices, allowing additional vertices to be added to it without the allocation. If no
     * value is provided, a size to fit the provided vertices will be allocated.
     * @param {number} [maxIndices] - An {@link IndexBuffer} will be allocated with at least
     * maxIndices, allowing additional indices to be added to it without the allocation. If no
     * value is provided, a size to fit the provided indices will be allocated.
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
     * Sets the vertex data for any supported semantic.
     *
     * @param {string} semantic - The meaning of the vertex element. For supported semantics, see
     * SEMANTIC_* in {@link VertexFormat}.
     * @param {number[]|ArrayBufferView} data - Vertex
     * data for the specified semantic.
     * @param {number} componentCount - The number of values that form a single Vertex element. For
     * example when setting a 3D position represented by 3 numbers per vertex, number 3 should be
     * specified.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not
     * provided, the whole data array is used. This allows to use only part of the data array.
     * @param {number} [dataType] - The format of data when stored in the {@link VertexBuffer}, see
     * TYPE_* in {@link VertexFormat}. When not specified, {@link TYPE_FLOAT32} is used.
     * @param {boolean} [dataTypeNormalize] - If true, vertex attribute data will be mapped from a
     * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
     * unchanged. If this property is unspecified, false is assumed.
     * @param {boolean} [asInt] - If true, vertex attribute data will be accessible as integer
     * numbers in shader code. Defaults to false, which means that vertex attribute data will be
     * accessible as floating point numbers. Can be only used with INT and UINT data types.
     */
    setVertexStream(semantic, data, componentCount, numVertices, dataType = TYPE_FLOAT32, dataTypeNormalize = false, asInt = false) {
        this._initGeometryData();
        const vertexCount = numVertices || data.length / componentCount;
        this._geometryData._changeVertexCount(vertexCount, semantic);
        this._geometryData.vertexStreamsUpdated = true;

        this._geometryData.vertexStreamDictionary[semantic] = new GeometryVertexStream(
            data,
            componentCount,
            dataType,
            dataTypeNormalize,
            asInt
        );
    }

    /**
     * Gets the vertex data corresponding to a semantic.
     *
     * @param {string} semantic - The semantic of the vertex element to get. For supported
     * semantics, see SEMANTIC_* in {@link VertexFormat}.
     * @param {number[]|ArrayBufferView} data - An
     * array to populate with the vertex data. When typed array is supplied, enough space needs to
     * be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getVertexStream(semantic, data) {
        let count = 0;
        let done = false;

        // see if we have un-applied stream
        if (this._geometryData) {
            const stream = this._geometryData.vertexStreamDictionary[semantic];
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
                const iterator = new VertexIterator(this.vertexBuffer);
                count = iterator.readData(semantic, data);
            }
        }

        return count;
    }

    /**
     * Sets the vertex positions array. Vertices are stored using {@link TYPE_FLOAT32} format.
     *
     * @param {number[]|ArrayBufferView} positions - Vertex
     * data containing positions.
     * @param {number} [componentCount] - The number of values that form a single position element.
     * Defaults to 3 if not specified, corresponding to x, y and z coordinates.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not
     * provided, the whole data array is used. This allows to use only part of the data array.
     */
    setPositions(positions, componentCount = GeometryData.DEFAULT_COMPONENTS_POSITION, numVertices) {
        this.setVertexStream(SEMANTIC_POSITION, positions, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * Sets the vertex normals array. Normals are stored using {@link TYPE_FLOAT32} format.
     *
     * @param {number[]|ArrayBufferView} normals - Vertex
     * data containing normals.
     * @param {number} [componentCount] - The number of values that form a single normal element.
     * Defaults to 3 if not specified, corresponding to x, y and z direction.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not
     * provided, the whole data array is used. This allows to use only part of the data array.
     */
    setNormals(normals, componentCount = GeometryData.DEFAULT_COMPONENTS_NORMAL, numVertices) {
        this.setVertexStream(SEMANTIC_NORMAL, normals, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * Sets the vertex uv array. Uvs are stored using {@link TYPE_FLOAT32} format.
     *
     * @param {number} channel - The uv channel in [0..7] range.
     * @param {number[]|ArrayBufferView} uvs - Vertex
     * data containing uv-coordinates.
     * @param {number} [componentCount] - The number of values that form a single uv element.
     * Defaults to 2 if not specified, corresponding to u and v coordinates.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not
     * provided, the whole data array is used. This allows to use only part of the data array.
     */
    setUvs(channel, uvs, componentCount = GeometryData.DEFAULT_COMPONENTS_UV, numVertices) {
        this.setVertexStream(SEMANTIC_TEXCOORD + channel, uvs, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * Sets the vertex color array. Colors are stored using {@link TYPE_FLOAT32} format, which is
     * useful for HDR colors.
     *
     * @param {number[]|ArrayBufferView} colors - Vertex
     * data containing colors.
     * @param {number} [componentCount] - The number of values that form a single color element.
     * Defaults to 4 if not specified, corresponding to r, g, b and a.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not
     * provided, the whole data array is used. This allows to use only part of the data array.
     */
    setColors(colors, componentCount = GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices) {
        this.setVertexStream(SEMANTIC_COLOR, colors, componentCount, numVertices, TYPE_FLOAT32, false);
    }

    /**
     * Sets the vertex color array. Colors are stored using {@link TYPE_UINT8} format, which is
     * useful for LDR colors. Values in the array are expected in [0..255] range, and are mapped to
     * [0..1] range in the shader.
     *
     * @param {number[]|ArrayBufferView} colors - Vertex
     * data containing colors. The array is expected to contain 4 components per vertex,
     * corresponding to r, g, b and a.
     * @param {number} [numVertices] - The number of vertices to be used from data array. If not
     * provided, the whole data array is used. This allows to use only part of the data array.
     */
    setColors32(colors, numVertices) {
        this.setVertexStream(SEMANTIC_COLOR, colors, GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices, TYPE_UINT8, true);
    }

    /**
     * Sets the index array. Indices are stored using 16-bit format by default, unless more than
     * 65535 vertices are specified, in which case 32-bit format is used.
     *
     * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - The array of indices that
     * define primitives (lines, triangles, etc.).
     * @param {number} [numIndices] - The number of indices to be used from data array. If not
     * provided, the whole data array is used. This allows to use only part of the data array.
     */
    setIndices(indices, numIndices) {
        this._initGeometryData();
        this._geometryData.indexStreamUpdated = true;
        this._geometryData.indices = indices;
        this._geometryData.indexCount = numIndices || indices.length;
    }

    /**
     * Gets the vertex positions data.
     *
     * @param {number[]|ArrayBufferView} positions - An
     * array to populate with the vertex data. When typed array is supplied, enough space needs to
     * be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getPositions(positions) {
        return this.getVertexStream(SEMANTIC_POSITION, positions);
    }

    /**
     * Gets the vertex normals data.
     *
     * @param {number[]|ArrayBufferView} normals - An
     * array to populate with the vertex data. When typed array is supplied, enough space needs to
     * be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getNormals(normals) {
        return this.getVertexStream(SEMANTIC_NORMAL, normals);
    }

    /**
     * Gets the vertex uv data.
     *
     * @param {number} channel - The uv channel in [0..7] range.
     * @param {number[]|ArrayBufferView} uvs - An
     * array to populate with the vertex data. When typed array is supplied, enough space needs to
     * be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getUvs(channel, uvs) {
        return this.getVertexStream(SEMANTIC_TEXCOORD + channel, uvs);
    }

    /**
     * Gets the vertex color data.
     *
     * @param {number[]|ArrayBufferView} colors - An
     * array to populate with the vertex data. When typed array is supplied, enough space needs to
     * be reserved, otherwise only partial data is copied.
     * @returns {number} Returns the number of vertices populated.
     */
    getColors(colors) {
        return this.getVertexStream(SEMANTIC_COLOR, colors);
    }

    /**
     * Gets the index data.
     *
     * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - An array to populate with the
     * index data. When a typed array is supplied, enough space needs to be reserved, otherwise
     * only partial data is copied.
     * @returns {number} Returns the number of indices populated.
     */
    getIndices(indices) {
        let count = 0;

        // see if we have un-applied indices
        if (this._geometryData && this._geometryData.indices) {
            const streamIndices = this._geometryData.indices;
            count = this._geometryData.indexCount;

            if (ArrayBuffer.isView(indices)) {
                // destination data is typed array
                indices.set(streamIndices);
            } else {
                // destination data is array
                indices.length = 0;
                for (let i = 0, il = streamIndices.length; i < il; i++) {
                    indices.push(streamIndices[i]);
                }
            }
        } else {
            // get data from IndexBuffer
            if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
                const indexBuffer = this.indexBuffer[0];
                count = indexBuffer.readData(indices);
            }
        }

        return count;
    }

    /**
     * Applies any changes to vertex stream and indices to mesh. This allocates or reallocates
     * {@link vertexBuffer} or {@link indexBuffer} to fit all provided vertices and indices, and
     * fills them with data.
     *
     * @param {number} [primitiveType] - The type of primitive to render.  Can be:
     *
     * - {@link PRIMITIVE_POINTS}
     * - {@link PRIMITIVE_LINES}
     * - {@link PRIMITIVE_LINELOOP}
     * - {@link PRIMITIVE_LINESTRIP}
     * - {@link PRIMITIVE_TRIANGLES}
     * - {@link PRIMITIVE_TRISTRIP}
     * - {@link PRIMITIVE_TRIFAN}
     *
     * Defaults to {@link PRIMITIVE_TRIANGLES} if not specified.
     * @param {boolean} [updateBoundingBox] - True to update bounding box. Bounding box is updated
     * only if positions were set since last time update was called, and `componentCount` for
     * position was 3, otherwise bounding box is not updated. See {@link Mesh#setPositions}.
     * Defaults to true if not specified. Set this to false to avoid update of the bounding box and
     * use aabb property to set it instead.
     */
    update(primitiveType = PRIMITIVE_TRIANGLES, updateBoundingBox = true) {

        if (this._geometryData) {

            // update bounding box if needed
            if (updateBoundingBox) {

                // find vec3 position stream
                const stream = this._geometryData.vertexStreamDictionary[SEMANTIC_POSITION];
                if (stream) {
                    if (stream.componentCount === 3) {
                        this._aabb.compute(stream.data, this._geometryData.vertexCount);
                        this._aabbVer++;
                    }
                }
            }

            // destroy vertex buffer if recreate was requested or if vertices don't fit
            let destroyVB = this._geometryData.recreate;
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
            let destroyIB = this._geometryData.recreate;
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

            // update other render states
            this.updateRenderStates();
        }
    }

    // builds vertex format based on attached vertex streams
    _buildVertexFormat(vertexCount) {

        const vertexDesc = [];

        for (const semantic in this._geometryData.vertexStreamDictionary) {
            const stream = this._geometryData.vertexStreamDictionary[semantic];
            vertexDesc.push({
                semantic: semantic,
                components: stream.componentCount,
                type: stream.dataType,
                normalize: stream.dataTypeNormalize,
                asInt: stream.asInt
            });
        }

        return new VertexFormat(this.device, vertexDesc, vertexCount);
    }

    // copy attached data into vertex buffer
    _updateVertexBuffer() {

        // if we don't have vertex buffer, create new one, otherwise update existing one
        if (!this.vertexBuffer) {
            const allocateVertexCount = this._geometryData.maxVertices;
            const format = this._buildVertexFormat(allocateVertexCount);
            this.vertexBuffer = new VertexBuffer(this.device, format, allocateVertexCount, {
                usage: this._geometryData.verticesUsage,
                storage: this._storageVertex
            });
        }

        // lock vertex buffer and create typed access arrays for individual elements
        const iterator = new VertexIterator(this.vertexBuffer);

        // copy all stream data into vertex buffer
        const numVertices = this._geometryData.vertexCount;
        for (const semantic in this._geometryData.vertexStreamDictionary) {
            const stream = this._geometryData.vertexStreamDictionary[semantic];
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
            const maxVertices = this._geometryData.maxVertices;
            const createFormat = ((maxVertices > 0xffff) || (maxVertices === 0)) ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
            const options = this._storageIndex ? { storage: true } : undefined;
            this.indexBuffer[0] = new IndexBuffer(this.device, createFormat, this._geometryData.maxIndices, this._geometryData.indicesUsage, undefined, options);
        }

        const srcIndices = this._geometryData.indices;
        if (srcIndices) {

            const indexBuffer = this.indexBuffer[0];
            indexBuffer.writeData(srcIndices, this._geometryData.indexCount);

            // remove data
            this._geometryData.indices = null;
        }
    }

    // prepares the mesh to be rendered with specific render style
    prepareRenderState(renderStyle) {
        if (renderStyle === RENDERSTYLE_WIREFRAME) {
            this.generateWireframe();
        } else if (renderStyle === RENDERSTYLE_POINTS) {
            this.primitive[RENDERSTYLE_POINTS] = {
                type: PRIMITIVE_POINTS,
                base: 0,
                count: this.vertexBuffer ? this.vertexBuffer.numVertices : 0,
                indexed: false
            };
        }
    }

    // updates existing render states with changes to solid render state
    updateRenderStates() {

        if (this.primitive[RENDERSTYLE_POINTS]) {
            this.prepareRenderState(RENDERSTYLE_POINTS);
        }

        if (this.primitive[RENDERSTYLE_WIREFRAME]) {
            this.prepareRenderState(RENDERSTYLE_WIREFRAME);
        }
    }

    generateWireframe() {

        // release existing IB
        this._destroyIndexBuffer(RENDERSTYLE_WIREFRAME);

        const numVertices = this.vertexBuffer.numVertices;

        const lines = [];
        let format;
        if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
            const offsets = [[0, 1], [1, 2], [2, 0]];

            const base = this.primitive[RENDERSTYLE_SOLID].base;
            const count = this.primitive[RENDERSTYLE_SOLID].count;
            const indexBuffer = this.indexBuffer[RENDERSTYLE_SOLID];
            const srcIndices = new typedArrayIndexFormats[indexBuffer.format](indexBuffer.storage);

            const seen = new Set();

            for (let j = base; j < base + count; j += 3) {
                for (let k = 0; k < 3; k++) {
                    const i1 = srcIndices[j + offsets[k][0]];
                    const i2 = srcIndices[j + offsets[k][1]];
                    const hash = (i1 > i2) ? ((i2 * numVertices) + i1) : ((i1 * numVertices) + i2);
                    if (!seen.has(hash)) {
                        seen.add(hash);
                        lines.push(i1, i2);
                    }
                }
            }
            format = indexBuffer.format;
        } else {
            for (let i = 0; i < numVertices; i += 3) {
                lines.push(i, i + 1, i + 1, i + 2, i + 2, i);
            }
            format = lines.length > 65535 ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
        }

        const wireBuffer = new IndexBuffer(this.vertexBuffer.device, format, lines.length);
        const dstIndices = new typedArrayIndexFormats[wireBuffer.format](wireBuffer.storage);
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
