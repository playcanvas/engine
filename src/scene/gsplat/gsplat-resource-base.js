import { Debug } from '../../core/debug.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { BUFFER_STATIC, SEMANTIC_ATTR13, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { Mesh } from '../mesh.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { WorkBufferRenderInfo } from '../gsplat-unified/gsplat-work-buffer.js';
import { GSplatStreams } from './gsplat-streams.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatData } from './gsplat-data.js'
 * @import { GSplatCompressedData } from './gsplat-compressed-data.js'
 * @import { GSplatSogData } from './gsplat-sog-data.js'
 * @import { GSplatFormat } from './gsplat-format.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

let id = 0;
const tempMap = new Map();

/**
 * Base class for a GSplat resource and defines common properties.
 *
 *  @ignore
 */
class GSplatResourceBase {
    /**
     * @type {GraphicsDevice}
     * @ignore
     */
    device;

    /**
     * @type {GSplatData | GSplatCompressedData | GSplatSogData}
     * @ignore
     */
    gsplatData;

    /** @type {Float32Array} */
    centers;

    /** @type {BoundingBox} */
    aabb;

    /**
     * @type {Mesh|null}
     * @ignore
     */
    mesh = null;

    /**
     * @type {VertexBuffer|null}
     * @ignore
     */
    instanceIndices = null;

    /**
     * @type {number}
     * @ignore
     */
    id = id++;

    /**
     * @type {Map<string, WorkBufferRenderInfo>}
     * @ignore
     */
    workBufferRenderInfos = new Map();

    /**
     * Format descriptor for this resource.
     *
     * @type {GSplatFormat}
     * @protected
     */
    _format;

    /**
     * Manages textures for this resource based on format streams.
     *
     * @type {GSplatStreams}
     * @ignore
     */
    streams;

    /**
     * @type {number}
     * @private
     */
    _refCount = 0;

    /**
     * @type {number}
     * @private
     */
    _meshRefCount = 0;

    constructor(device, gsplatData) {
        this.device = device;
        this.gsplatData = gsplatData;
        this.streams = new GSplatStreams(device);

        this.centers = gsplatData.getCenters();

        this.aabb = new BoundingBox();
        gsplatData.calcAabb(this.aabb);
    }

    destroy() {
        this.streams.destroy();
        this.mesh?.destroy();
        this.instanceIndices?.destroy();
        this.workBufferRenderInfos.forEach(info => info.destroy());
        this.workBufferRenderInfos.clear();
    }

    /**
     * Increments the reference count.
     *
     * @ignore
     */
    incRefCount() {
        this._refCount++;
    }

    /**
     * Decrements the reference count.
     *
     * @ignore
     */
    decRefCount() {
        this._refCount--;
    }

    /**
     * Gets the current reference count. This represents how many times this resource is currently
     * being used internally by the engine. For {@link GSplatComponent#asset|assets} assigned to
     * {@link GSplatComponent#unified|unified} gsplat components, this tracks active usage during
     * rendering and sorting operations.
     *
     * Resources should not be unloaded while the reference count is non-zero, as they are still
     * in use by the rendering pipeline.
     *
     * @type {number}
     * @ignore
     */
    get refCount() {
        return this._refCount;
    }

    /**
     * Ensures mesh and instanceIndices exist. Creates them lazily on first call. Must be paired
     * with a call to releaseMesh() when done.
     *
     * @ignore
     */
    ensureMesh() {
        if (!this.mesh) {
            this.mesh = GSplatResourceBase.createMesh(this.device);
            this.mesh.aabb.copy(this.aabb);
            this.instanceIndices = GSplatResourceBase.createInstanceIndices(this.device, this.gsplatData.numSplats);
        }
        this._meshRefCount++;
    }

    /**
     * Releases reference to mesh. When all references are released, cleans up instanceIndices.
     * The mesh itself is destroyed by MeshInstance when its internal refCount reaches zero.
     *
     * @ignore
     */
    releaseMesh() {
        this._meshRefCount--;
        if (this._meshRefCount < 1) {
            this.mesh = null; // mesh instances destroy mesh when their refCount reaches zero
            this.instanceIndices?.destroy();
            this.instanceIndices = null;
        }
    }

    /**
     * Get or create a QuadRender for rendering to work buffer.
     *
     * @param {boolean} useIntervals - Whether to use intervals.
     * @param {number} colorTextureFormat - The format of the color texture (RGBA16F or RGBA16U).
     * @param {boolean} colorOnly - Whether to render only color (not full MRT).
     * @param {{ code: string, hash: number }|null} [workBufferModifier] - Optional custom modifier (object with code and pre-computed hash).
     * @param {number} [formatHash] - Captured format hash for shader caching.
     * @param {string} [formatDeclarations] - Captured format declarations for shader compilation.
     * @returns {WorkBufferRenderInfo} The WorkBufferRenderInfo instance.
     * @ignore
     */
    getWorkBufferRenderInfo(useIntervals, colorTextureFormat, colorOnly = false, workBufferModifier = null, formatHash, formatDeclarations = '') {

        // configure defines to fetch cached data
        this.configureMaterialDefines(tempMap);
        if (useIntervals) tempMap.set('GSPLAT_LOD', '');
        if (colorOnly) tempMap.set('GSPLAT_COLOR_ONLY', '');

        let definesKey = '';
        for (const [k, v] of tempMap) {
            if (definesKey) definesKey += ';';
            definesKey += `${k}=${v}`;
        }
        const key = `${formatHash};${workBufferModifier?.hash ?? 0};${definesKey}`;

        // get or create quad render
        let info = this.workBufferRenderInfos.get(key);
        if (!info) {

            const material = new ShaderMaterial();
            this.configureMaterial(material, workBufferModifier, formatDeclarations);

            // copy tempMap to material defines
            tempMap.forEach((v, k) => material.setDefine(k, v));

            // create new cache entry
            info = new WorkBufferRenderInfo(this.device, key, material, colorTextureFormat, colorOnly);
            this.workBufferRenderInfos.set(key, info);
        }

        tempMap.clear();
        return info;
    }

    static createMesh(device) {
        // number of quads to combine into a single instance. this is to increase occupancy
        // in the vertex shader.
        const splatInstanceSize = GSplatResourceBase.instanceSize;

        // build the instance mesh
        const meshPositions = new Float32Array(12 * splatInstanceSize);
        const meshIndices = new Uint32Array(6 * splatInstanceSize);
        for (let i = 0; i < splatInstanceSize; ++i) {
            meshPositions.set([
                -1, -1, i,
                1, -1, i,
                1, 1, i,
                -1, 1, i
            ], i * 12);

            const b = i * 4;
            meshIndices.set([
                0 + b, 1 + b, 2 + b, 0 + b, 2 + b, 3 + b
            ], i * 6);
        }

        const mesh = new Mesh(device);
        mesh.setPositions(meshPositions, 3);
        mesh.setIndices(meshIndices);
        mesh.update();

        return mesh;
    }

    static createInstanceIndices(device, splatCount) {
        const splatInstanceSize = GSplatResourceBase.instanceSize;
        const numSplats = Math.ceil(splatCount / splatInstanceSize) * splatInstanceSize;
        const numSplatInstances = numSplats / splatInstanceSize;

        const indexData = new Uint32Array(numSplatInstances);
        for (let i = 0; i < numSplatInstances; ++i) {
            indexData[i] = i * splatInstanceSize;
        }

        const vertexFormat = new VertexFormat(device, [
            { semantic: SEMANTIC_ATTR13, components: 1, type: TYPE_UINT32, asInt: true }
        ]);

        const instanceIndices = new VertexBuffer(device, vertexFormat, numSplatInstances, {
            usage: BUFFER_STATIC,
            data: indexData.buffer
        });

        return instanceIndices;
    }

    static get instanceSize() {
        return 128; // number of splats per instance
    }

    get numSplats() {
        return this.gsplatData.numSplats;
    }

    /**
     * Gets the format descriptor for this resource. The format defines texture streams and
     * shader code for reading splat data. Use this to add extra streams.
     *
     * @type {GSplatFormat}
     */
    get format() {
        return this._format;
    }

    /**
     * Gets a texture by name.
     *
     * @param {string} name - The name of the texture.
     * @returns {Texture|undefined} The texture, or undefined if not found.
     * @ignore
     */
    getTexture(name) {
        return this.streams.getTexture(name);
    }

    /**
     * Gets the cached texture width for shader uniform.
     *
     * @type {number}
     * @ignore
     */
    get textureSize() {
        return this.streams.textureDimensions.x;
    }

    /**
     * Configures a material to use this resource's data. Base implementation injects format's
     * shader chunks and binds textures from the streams.
     *
     * @param {ShaderMaterial} material - The material to configure.
     * @param {{ code: string, hash: number }|null} [workBufferModifier] - Optional custom modifier (object with code and pre-computed hash).
     * @param {string} [formatDeclarations] - Captured format declarations for shader compilation.
     * @ignore
     */
    configureMaterial(material, workBufferModifier = null, formatDeclarations) {
        this.configureMaterialDefines(material.defines);

        // Sync resource textures with format (handles extra streams)
        this.streams.syncWithFormat(this.format);

        // Inject format's shader chunks
        const chunks = this.device.isWebGPU ? material.shaderChunks.wgsl : material.shaderChunks.glsl;
        chunks.set('gsplatDeclarationsVS', formatDeclarations);
        chunks.set('gsplatReadVS', this.format.getReadCode());

        // Set modify chunk if provided
        if (workBufferModifier?.code) {
            chunks.set('gsplatModifyVS', workBufferModifier.code);
        }

        // Bind all textures from streams
        for (const [name, texture] of this.streams.textures) {
            material.setParameter(name, texture);
        }

        // Set cached texture size
        if (this.textureSize > 0) {
            material.setParameter('splatTextureSize', this.textureSize);
        }
    }

    /**
     * Configures material defines for this resource. Derived classes should override this.
     *
     * @param {Map<string, string|number|boolean>} defines - The defines map to configure.
     * @ignore
     */
    configureMaterialDefines(defines) {
    }

    instantiate() {
        Debug.removed('GSplatResource.instantiate is removed. Use gsplat component instead');
    }
}

export { GSplatResourceBase };
