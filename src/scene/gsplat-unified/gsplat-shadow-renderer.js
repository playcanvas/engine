import { Debug, DebugHelper } from '../../core/debug.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    BUFFERUSAGE_COPY_DST,
    CULLFACE_NONE,
    PIXELFORMAT_RGBA16U,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    UNIFORMTYPE_UINT,
    UNIFORMTYPE_VEC4
} from '../../platform/graphics/constants.js';
import { BLEND_PREMULTIPLIED, LIGHTTYPE_DIRECTIONAL } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { MeshInstance } from '../mesh-instance.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { computeGsplatShadowCullSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-shadow-cull.js';
import { computeGsplatShadowIndirectArgsSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-shadow-indirect-args.js';
import { buildGSplatIntervalData, INTERVAL_STRIDE } from './gsplat-interval-data.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { Layer } from '../layer.js'
 * @import { Light } from '../light.js'
 * @import { GSplatWorld } from './gsplat-world.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { GSplatParams } from './gsplat-params.js'
 */

const WORKGROUP_SIZE = 256;

const INDEX_COUNT = 6 * GSplatResourceBase.instanceSize;

/**
 * Per-light shadow draw entry. One cheap material + mesh instance over the shared quad mesh, plus a
 * visible-index buffer and an atomic visible-count buffer. The mesh instance is registered as a
 * shadow caster and is visible only for its light's shadow camera.
 *
 * @typedef {object} ShadowLightEntry
 * @property {Light} light - The directional light this entry casts for.
 * @property {ShaderMaterial} material - The per-light shadow draw material.
 * @property {MeshInstance} meshInstance - The cast mesh instance (registered as a shadow caster).
 * @property {StorageBuffer|null} indexBuffer - Dense visible work-buffer index list (grows with splat count).
 * @property {number} allocatedIndexCount - Capacity of `indexBuffer` in splats.
 * @property {StorageBuffer} countBuffer - Single-element atomic visible counter (also bound as `numSplatsStorage`).
 * @property {Compute} cullCompute - Per-entry cull compute (own uniform buffer/bind group).
 * @property {Compute} argsCompute - Per-entry indirect-args compute (own uniform buffer/bind group).
 */

/**
 * Casts gsplat directional shadows on behalf of the GPU-sort ({@link GSplatHybridRenderer}) path,
 * which cannot self-cast. It shares the manager's {@link GSplatWorld} (work buffer + camera-
 * independent cull bounds + world states) and never allocates a world of its own.
 *
 * For each non-cascaded directional light affecting the manager's layer it maintains a cheap draw
 * entry (a per-light material + mesh instance over one shared quad mesh, plus a visible-index and
 * count buffer). A projection-free compute cull against the light's frustum produces the visible
 * index list, and a quad-style per-vertex-projected indirect draw writes the shadow map via the
 * standard caster pipeline. No sort and no projection cache are needed.
 *
 * Lifecycle is split across the frame:
 * - {@link syncLights} runs pre-cull (from {@link GSplatManager#update}) to reconcile the per-light
 *   pool and register/unregister shadow casters, so `cullComposition` sees them.
 * - {@link cull} runs post-cull (from {@link GSplatManager#updateShadows} via the director) once
 *   each light's shadow-camera frustum has been fitted, to dispatch the culls and bind results.
 *
 * @ignore
 */
class GSplatShadowRenderer {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GraphNode} */
    node;

    /** @type {GraphNode} */
    cameraNode;

    /** @type {Layer} */
    layer;

    /** @type {GSplatWorld} */
    world;

    /**
     * Per-light draw entries, keyed by light.
     *
     * @type {Map<Light, ShadowLightEntry>}
     */
    entries = new Map();

    /**
     * Reused scratch set of the qualifying directional shadow lights, rebuilt each {@link syncLights}
     * to diff against {@link entries}.
     *
     * @type {Set<Light>}
     * @private
     */
    _desiredLights = new Set();

    /** @type {StorageBuffer|null} */
    intervalsBuffer = null;

    /** @type {number} */
    allocatedIntervalCount = 0;

    /**
     * World-state version the intervals were last uploaded for (intervals are camera/light
     * independent, so they are shared across all light entries and uploaded once per version).
     *
     * @type {number}
     */
    _uploadedVersion = -1;

    /** @type {Vec2} */
    _cullDispatchSize = new Vec2(1, 1);

    /**
     * Reused light frustum planes (6 × vec4(normal, distance)) for the cull uniform, refilled per
     * light entry from its shadow camera.
     *
     * @type {Float32Array}
     */
    _frustumPlanes = new Float32Array(24);

    // The cull/args shaders are shared, but each light entry gets its OWN Compute instances
    // (created in _createEntry). A Compute owns a persistent uniform buffer, so a single shared
    // Compute dispatched once per light per frame would have all dispatches read the last-written
    // uniforms (frustum planes / draw slot) — making all but one light's shadow draw empty.

    /** @type {Shader|null} */
    _cullShader = null;

    /** @type {BindGroupFormat|null} */
    _cullBindGroupFormat = null;

    /** @type {Shader|null} */
    _argsShader = null;

    /** @type {BindGroupFormat|null} */
    _argsBindGroupFormat = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node the cast mesh instances are parented to.
     * @param {GraphNode} cameraNode - The main camera node this manager renders for; used to
     * resolve each light's shadow camera via `light.getRenderData(sceneCamera, 0)`.
     * @param {Layer} layer - The layer to register shadow casters on (and read directional lights from).
     * @param {GSplatWorld} world - The shared world (work buffer, cull bounds, world states).
     */
    constructor(device, node, cameraNode, layer, world) {
        this.device = device;
        this.node = node;
        this.cameraNode = cameraNode;
        this.layer = layer;
        this.world = world;

        this._createCullShader();
        this._createArgsShader();
    }

    destroy() {
        this.entries.forEach(entry => this._destroyEntry(entry));
        this.entries.clear();

        this.intervalsBuffer?.destroy();
        this.intervalsBuffer = null;

        this._cullShader?.destroy();
        this._cullBindGroupFormat?.destroy();
        this._argsShader?.destroy();
        this._argsBindGroupFormat?.destroy();
        this._cullShader = null;
        this._argsShader = null;
    }

    /** @private */
    _createCullShader() {
        const device = this.device;

        this._cullBindGroupFormat = new BindGroupFormat(device, [
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('intervals', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('outputIndices', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('globalCount', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('boundsBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('transformsBuffer', SHADERSTAGE_COMPUTE, true)
        ]);

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('frustumPlanes', UNIFORMTYPE_VEC4, 6),
            new UniformFormat('numIntervals', UNIFORMTYPE_UINT)
        ]);

        this._cullShader = new Shader(device, {
            name: 'GSplatShadowCull',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatShadowCullSource,
            cdefines: new Map([['{WORKGROUP_SIZE}', WORKGROUP_SIZE.toString()]]),
            computeBindGroupFormat: this._cullBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });
    }

    /** @private */
    _createArgsShader() {
        const device = this.device;

        this._argsBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('countBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('indirectDrawArgs', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('drawSlot', UNIFORMTYPE_UINT),
            new UniformFormat('indexCount', UNIFORMTYPE_UINT),
            new UniformFormat('pad0', UNIFORMTYPE_UINT),
            new UniformFormat('pad1', UNIFORMTYPE_UINT)
        ]);

        this._argsShader = new Shader(device, {
            name: 'GSplatShadowIndirectArgs',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatShadowIndirectArgsSource,
            cdefines: new Map([['{INSTANCE_SIZE}', GSplatResourceBase.instanceSize.toString()]]),
            computeBindGroupFormat: this._argsBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });
    }

    /**
     * Rebinds to a new work buffer after a format/resize swap. The per-light materials read the
     * work-buffer textures, so they must be re-pointed when the manager recreates it.
     *
     * @param {GSplatWorkBuffer} workBuffer - The new work buffer.
     */
    setDataSource(workBuffer) {
        // Force a re-upload of intervals; offsets/bounds indices may have shifted.
        this._uploadedVersion = -1;
        this.entries.forEach((entry) => {
            this._configureMaterialWorkBuffer(entry.material);
            entry.material.update();
        });
    }

    /**
     * Sets the world-space AABB on every cast mesh instance. The directional shadow cull derives
     * each cascade's depth range from the casters' AABBs (which world-space PCSS penumbra scaling
     * depends on), and the shared quad mesh has no meaningful spatial bounds of its own — so without
     * this the depth range is wrong and soft shadows are mis-scaled. Must run pre-cull (the manager
     * calls it before cullComposition fits the shadow cameras). `setCustomAabb` copies, so passing a
     * shared box instance to every entry is safe.
     *
     * @param {import('../../core/shape/bounding-box.js').BoundingBox|null} aabb - World-space splat AABB.
     */
    setCastersAabb(aabb) {
        if (!aabb) return;
        this.entries.forEach((entry) => {
            entry.meshInstance.setCustomAabb(aabb);
        });
    }

    /**
     * Pre-cull pass: reconcile the per-light caster pool against the layer's directional shadow
     * lights (enabled, shadow-casting, non-cascaded). Adds entries for new lights and tears down
     * entries for lights that were disabled, removed, stopped casting, or became cascaded — freeing
     * their GPU resources and unregistering their caster. Cascaded directional lights are skipped
     * (warned once); they would need a per-cascade cull.
     */
    syncLights() {
        const lights = this.layer.splitLights[LIGHTTYPE_DIRECTIONAL];

        // build the set of lights that should have a draw entry this frame
        const desired = this._desiredLights;
        desired.clear();
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            if (!light.enabled || !light.castShadows) continue;
            if (light.numCascades !== 1) {
                Debug.warnOnce('GSplatShadowRenderer: cascaded directional shadows are not supported for gsplats; the light will not cast a gsplat shadow.');
                continue;
            }
            desired.add(light);
        }

        // tear down entries for lights no longer desired
        this.entries.forEach((entry, light) => {
            if (!desired.has(light)) {
                this._destroyEntry(entry);
                this.entries.delete(light);
            }
        });

        // create entries for newly desired lights
        desired.forEach((light) => {
            if (!this.entries.has(light)) {
                this.entries.set(light, this._createEntry(light));
            }
        });
    }

    /**
     * Post-cull pass: for each light entry run the coarse node-frustum cull + expand and the
     * indirect-args write, then bind the results to the entry's mesh instance. Runs after
     * `cullComposition` and before the frame graph renders the shadow maps.
     *
     * @param {GSplatParams} gsplatParams - Scene gsplat params (alphaClip etc.).
     */
    cull(gsplatParams) {
        const worldState = this.world.getState(this.world.currentVersion);
        const ready = worldState && worldState.sortedBefore && worldState.totalActiveSplats > 0;

        if (!ready) {
            this.entries.forEach((entry) => {
                entry.meshInstance.visible = false;
            });
            return;
        }

        this._ensureIntervals(worldState);

        // Refresh the per-node world transforms the coarse cull reads. The forward renderer also
        // does this each frame, but a shadow-only manager has no forward pass — so we keep them
        // current here (cheap: one matrix per splat placement, correct for moving splats).
        this.world.workBuffer.frustumCuller.updateTransformsData(worldState.boundsGroups);

        const numIntervals = worldState.totalIntervals;
        const totalActiveSplats = worldState.totalActiveSplats;
        const textureSize = this.world.workBuffer.textureSize;

        this.entries.forEach((entry) => {
            this._cullEntry(entry, numIntervals, totalActiveSplats, textureSize, gsplatParams);
        });
    }

    /**
     * Dispatches the cull + indirect-args for one light entry and binds the results.
     *
     * @param {ShadowLightEntry} entry - The light entry.
     * @param {number} numIntervals - Total interval count.
     * @param {number} totalActiveSplats - Max output index count.
     * @param {number} textureSize - Work buffer texture size.
     * @param {GSplatParams} gsplatParams - Scene gsplat params.
     * @private
     */
    _cullEntry(entry, numIntervals, totalActiveSplats, textureSize, gsplatParams) {
        const device = this.device;

        // resolve the light's shadow-camera frustum (fitted during cullComposition) and the shared
        // camera-independent cull bounds (populated by the forward renderer's frustum culler).
        const sceneCamera = this.cameraNode.camera?.camera;
        const frustum = sceneCamera && entry.light.getRenderData(sceneCamera, 0).shadowCamera?.frustum;
        const frustumCuller = this.world.workBuffer.frustumCuller;
        if (!frustum || !frustumCuller?.boundsBuffer || !frustumCuller?.transformsBuffer) {
            entry.meshInstance.visible = false;
            return;
        }
        this._fillFrustumPlanes(frustum);

        // grow the visible-index buffer to hold all active splats (worst case: nothing culled)
        if (totalActiveSplats > entry.allocatedIndexCount) {
            entry.indexBuffer?.destroy();
            entry.allocatedIndexCount = totalActiveSplats;
            entry.indexBuffer = new StorageBuffer(device, totalActiveSplats * 4);
            DebugHelper.setName(entry.indexBuffer, 'GSplatShadow.indices');
        }

        // reset the atomic visible counter, then run the cull (coarse node-frustum reject + expand)
        entry.countBuffer.clear();

        const cull = entry.cullCompute;
        cull.setParameter('intervals', this.intervalsBuffer);
        cull.setParameter('outputIndices', entry.indexBuffer);
        cull.setParameter('globalCount', entry.countBuffer);
        cull.setParameter('boundsBuffer', frustumCuller.boundsBuffer);
        cull.setParameter('transformsBuffer', frustumCuller.transformsBuffer);
        cull.setParameter('frustumPlanes[0]', this._frustumPlanes);
        cull.setParameter('numIntervals', numIntervals);

        // one workgroup per interval, tiled across X/Y when over the per-dimension limit
        Compute.calcDispatchSize(numIntervals, this._cullDispatchSize, device.limits.maxComputeWorkgroupsPerDimension || 65535);
        cull.setupDispatch(this._cullDispatchSize.x, this._cullDispatchSize.y, 1);
        device.computeDispatch([cull], 'GSplatShadowCull');

        // turn the visible count into indirect draw args
        const drawSlot = device.getIndirectDrawSlot(1);
        const args = entry.argsCompute;
        args.setParameter('countBuffer', entry.countBuffer);
        args.setParameter('indirectDrawArgs', device.indirectDrawBuffer);
        args.setParameter('drawSlot', drawSlot);
        args.setParameter('indexCount', INDEX_COUNT);
        args.setParameter('pad0', 0);
        args.setParameter('pad1', 0);
        args.setupDispatch(1);
        device.computeDispatch([args], 'GSplatShadowIndirectArgs');

        // bind to the cast mesh instance for the indirect draw
        const material = entry.material;
        entry.meshInstance.setIndirect(null, drawSlot, 1);
        material.setParameter('compactedSplatIds', entry.indexBuffer);
        material.setParameter('numSplatsStorage', entry.countBuffer);
        material.setParameter('splatTextureSize', textureSize);
        material.setParameter('alphaClip', gsplatParams.alphaClip);

        entry.meshInstance.visible = true;
        if (entry.meshInstance.instancingCount <= 0) {
            entry.meshInstance.instancingCount = 1;
        }
    }

    /**
     * Uploads interval metadata for the world state (cached per version).
     *
     * @param {import('./gsplat-world-state.js').GSplatWorldState} worldState - The world state.
     * @private
     */
    _ensureIntervals(worldState) {
        if (worldState.version === this._uploadedVersion) return;
        this._uploadedVersion = worldState.version;

        const numIntervals = worldState.totalIntervals;
        if (numIntervals === 0) return;

        if (numIntervals > this.allocatedIntervalCount) {
            this.intervalsBuffer?.destroy();
            this.allocatedIntervalCount = numIntervals;
            this.intervalsBuffer = new StorageBuffer(this.device, numIntervals * INTERVAL_STRIDE * 4, BUFFERUSAGE_COPY_DST);
            DebugHelper.setName(this.intervalsBuffer, 'GSplatShadow.intervals');
        }

        const data = buildGSplatIntervalData(worldState);
        this.intervalsBuffer.write(0, data, 0, numIntervals * INTERVAL_STRIDE);
    }

    /**
     * Fills {@link _frustumPlanes} from a frustum: 6 planes packed as vec4(normal.xyz, distance).
     *
     * @param {import('../../core/shape/frustum.js').Frustum} frustum - The light's shadow-camera frustum.
     * @private
     */
    _fillFrustumPlanes(frustum) {
        const p = this._frustumPlanes;
        for (let i = 0; i < 6; i++) {
            const plane = frustum.planes[i];
            p[i * 4 + 0] = plane.normal.x;
            p[i * 4 + 1] = plane.normal.y;
            p[i * 4 + 2] = plane.normal.z;
            p[i * 4 + 3] = plane.distance;
        }
    }

    /**
     * Creates a per-light shadow draw entry (material + caster mesh instance + count buffer).
     *
     * @param {Light} light - The directional light.
     * @returns {ShadowLightEntry} The created entry.
     * @private
     */
    _createEntry(light) {
        const device = this.device;

        const material = this._createMaterial();
        const meshInstance = this._createMeshInstance(light, material);

        // register as a shadow caster so cullComposition's shadow-caster culling includes it
        meshInstance.castShadow = true;
        this.layer.addShadowCasters([meshInstance]);

        const countBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);
        DebugHelper.setName(countBuffer, 'GSplatShadow.count');

        // Per-entry Compute instances (own uniform buffers + bind groups) sharing the renderer's
        // shaders, so per-light dispatches don't alias each other's uniforms (see field comment).
        const cullCompute = new Compute(device, this._cullShader, 'GSplatShadowCull');
        const argsCompute = new Compute(device, this._argsShader, 'GSplatShadowIndirectArgs');

        return {
            light,
            material,
            meshInstance,
            indexBuffer: null,
            allocatedIndexCount: 0,
            countBuffer,
            cullCompute,
            argsCompute
        };
    }

    /**
     * Tears down a light entry: unregisters the caster and frees its GPU resources.
     *
     * @param {ShadowLightEntry} entry - The entry to destroy.
     * @private
     */
    _destroyEntry(entry) {
        this.layer.removeShadowCasters([entry.meshInstance]);
        entry.meshInstance.destroy();
        entry.material.destroy();
        entry.indexBuffer?.destroy();
        entry.countBuffer.destroy();
        entry.cullCompute.destroy();
        entry.argsCompute.destroy();
    }

    /**
     * Creates the quad-style shadow draw material. Uses the same gsplat vertex/fragment chunks as
     * the forward quad renderer (direct per-vertex projection from the bound view/projection — the
     * shadow camera's, supplied by the engine's shadow pass), trimmed to depth + alpha-clip (the
     * engine injects `SHADOW_PASS` when compiling the shadow variant). Indirect-draw mode reads the
     * visible index list and GPU count.
     *
     * @returns {ShaderMaterial} The configured material.
     * @private
     */
    _createMaterial() {
        const material = new ShaderMaterial({
            uniqueName: 'GSplatShadowMaterial',
            vertexGLSL: '#include "gsplatVS"',
            fragmentGLSL: '#include "gsplatPS"',
            vertexWGSL: '#include "gsplatVS"',
            fragmentWGSL: '#include "gsplatPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });

        material.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);
        material.setDefine('SH_BANDS', '0');
        material.setDefine('GSPLAT_SEPARATE_OPACITY', '');
        material.setDefine('DITHER_NONE', '');
        material.setDefine('GSPLAT_INDIRECT_DRAW', true);

        this._configureMaterialWorkBuffer(material);

        material.cull = CULLFACE_NONE;
        material.blendType = BLEND_PREMULTIPLIED;
        material.depthWrite = false;
        material.update();

        return material;
    }

    /**
     * Injects the work-buffer format shader chunks and binds its textures + format-dependent defines
     * to a material. Mirrors the relevant parts of {@link GSplatQuadRenderer}.
     *
     * @param {ShaderMaterial} material - The material to configure.
     * @private
     */
    _configureMaterialWorkBuffer(material) {
        const workBuffer = this.world.workBuffer;
        const wbFormat = workBuffer.format;

        // format declarations + read code
        const chunks = this.device.isWebGPU ? material.shaderChunks.wgsl : material.shaderChunks.glsl;
        chunks.set('gsplatDeclarationsVS', wbFormat.getInputDeclarations());
        chunks.set('gsplatReadVS', wbFormat.getReadCode());

        // color format define
        const colorStream = wbFormat.getStream('dataColor');
        if (colorStream && colorStream.format !== PIXELFORMAT_RGBA16U) {
            material.setDefine('GSPLAT_COLOR_FLOAT', '');
        }

        // unified ID defines (kept consistent with the work buffer streams)
        const hasPcId = !!wbFormat.getStream('pcId');
        material.setDefine('GSPLAT_UNIFIED_ID', hasPcId);
        material.setDefine('PICK_CUSTOM_ID', hasPcId);

        // bind work buffer textures
        for (const stream of wbFormat.resourceStreams) {
            const texture = workBuffer.getTexture(stream.name);
            if (texture) {
                material.setParameter(stream.name, texture);
            }
        }
    }

    /**
     * Creates the cast mesh instance for a light, visible only for that light's shadow camera.
     *
     * @param {Light} light - The directional light.
     * @param {ShaderMaterial} material - The entry's material.
     * @returns {MeshInstance} The mesh instance.
     * @private
     */
    _createMeshInstance(light, material) {
        const mesh = GSplatResourceBase.createMesh(this.device);
        const meshInstance = new MeshInstance(mesh, material);
        meshInstance.node = this.node;
        meshInstance.setInstancing(true, true);
        meshInstance.instancingCount = 0;
        meshInstance.pick = false;

        // visible only when rendering this light's shadow camera. Each directional light owns a
        // distinct shadow-camera object (resolved lazily via the idempotent getRenderData), so the
        // identity match routes this caster to exactly its light's shadow map.
        const cameraNode = this.cameraNode;
        meshInstance.isVisibleFunc = (camera) => {
            const sceneCamera = cameraNode.camera?.camera;
            if (!sceneCamera) return false;
            return camera === light.getRenderData(sceneCamera, 0).shadowCamera;
        };

        return meshInstance;
    }
}

export { GSplatShadowRenderer };
