import { Debug } from '../../core/debug.js';
import { Vec2 } from '../../core/math/vec2.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { ADDRESS_CLAMP_TO_EDGE, BUFFER_STATIC, FILTER_NEAREST, SEMANTIC_ATTR13, SEMANTIC_POSITION, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { Mesh } from '../mesh.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { QuadRender } from '../graphics/quad-render.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import glslGsplatCopyToWorkBufferPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import wgslGsplatCopyToWorkBufferPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatData } from './gsplat-data.js'
 * @import { GSplatCompressedData } from './gsplat-compressed-data.js'
 * @import { GSplatSogsData } from './gsplat-sogs-data.js'
 */

let id = 0;
const tempMap = new Map();

/**
 * A helper class to cache quad renders for work buffer rendering.
 *
 * @ignore
 */
class WorkBufferRenderInfo {
    /** @type {ShaderMaterial} */
    material;

    /** @type {QuadRender} */
    quadRender;

    constructor(device, key, material) {
        this.device = device;
        this.material = material;

        const clonedDefines = new Map(material.defines);
        const shader = ShaderUtils.createShader(this.device, {
            uniqueName: `SplatCopyToWorkBuffer:${key}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexDefines: clonedDefines,
            fragmentDefines: clonedDefines,
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatCopyToWorkBufferPS,
            fragmentWGSL: wgslGsplatCopyToWorkBufferPS
        });

        this.quadRender = new QuadRender(shader);
    }

    destroy() {
        this.material?.destroy();
        this.quadRender?.destroy();
    }
}

/**
 * Base class for a GSplat resource and defines common properties.
 *
 *  @ignore
 */
class GSplatResourceBase {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GSplatData | GSplatCompressedData | GSplatSogsData} */
    gsplatData;

    /** @type {Float32Array} */
    centers;

    /** @type {BoundingBox} */
    aabb;

    /** @type {Mesh} */
    mesh;

    /** @type {VertexBuffer} */
    instanceIndices;

    /** @type {number} */
    id = id++;

    /** @type {Map<string, WorkBufferRenderInfo>} */
    workBufferRenderInfos = new Map();

    constructor(device, gsplatData) {
        this.device = device;
        this.gsplatData = gsplatData;

        this.centers = new Float32Array(gsplatData.numSplats * 3);
        gsplatData.getCenters(this.centers);

        this.aabb = new BoundingBox();
        gsplatData.calcAabb(this.aabb);

        // construct the mesh
        this.mesh = GSplatResourceBase.createMesh(device);
        this.instanceIndices = GSplatResourceBase.createInstanceIndices(device, gsplatData.numSplats);

        // keep extra reference since mesh is shared between instances
        this.mesh.incRefCount();

        this.mesh.aabb.copy(this.aabb);
    }

    destroy() {
        this.mesh?.destroy();
        this.instanceIndices?.destroy();
        this.workBufferRenderInfos.forEach(info => info.destroy());
        this.workBufferRenderInfos.clear();
    }

    /**
     * Get or create a QuadRender for rendering to work buffer.
     *
     * @param {boolean} useIntervals - Whether to use intervals.
     * @param {boolean} colorizeLod - Whether to colorize the LOD.
     * @returns {WorkBufferRenderInfo} The WorkBufferRenderInfo instance.
     */
    getWorkBufferRenderInfo(useIntervals, colorizeLod) {

        // configure defines to fetch cached data
        this.configureMaterialDefines(tempMap);
        if (useIntervals) tempMap.set('GSPLAT_LOD', '');
        if (colorizeLod) tempMap.set('GSPLAT_COLORIZE', '');
        const key = Array.from(tempMap.entries()).map(([k, v]) => `${k}=${v}`).join(';');

        // get or create quad render
        let info = this.workBufferRenderInfos.get(key);
        if (!info) {

            const material = new ShaderMaterial();
            this.configureMaterial(material);

            // copy tempMap to material defines
            tempMap.forEach((v, k) => material.setDefine(k, v));

            // create new cache entry
            info = new WorkBufferRenderInfo(this.device, key, material);
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

    configureMaterial(material) {
    }

    configureMaterialDefines(defines) {
    }

    /**
     * Evaluates the size of the texture based on the number of splats.
     *
     * @param {number} count - Number of gaussians.
     * @returns {Vec2} Returns a Vec2 object representing the size of the texture.
     */
    evalTextureSize(count) {
        return Vec2.ZERO;
    }

    /**
     * Creates a new texture with the specified parameters.
     *
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The size of the texture in a Vec2 object, containing width (x) and height (y).
     * @param {Uint8Array|Uint16Array|Uint32Array} [data] - The initial data to fill the texture with.
     * @returns {Texture} The created texture instance.
     */
    createTexture(name, format, size, data) {
        return new Texture(this.device, {
            name: name,
            width: size.x,
            height: size.y,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            ...(data ? { levels: [data] } : { })
        });
    }

    instantiate() {
        Debug.removed('GSplatResource.instantiate is removed. Use gsplat component instead');
    }
}

export { GSplatResourceBase };
