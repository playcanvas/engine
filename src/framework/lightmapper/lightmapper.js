import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    CHUNKAPI_1_65,
    CULLFACE_NONE,
    FILTER_LINEAR, FILTER_NEAREST,
    PIXELFORMAT_RGBA8,
    TEXHINT_LIGHTMAP,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM
} from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { Texture } from '../../platform/graphics/texture.js';

import { MeshInstance } from '../../scene/mesh-instance.js';
import { LightingParams } from '../../scene/lighting/lighting-params.js';
import { WorldClusters } from '../../scene/lighting/world-clusters.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../../scene/shader-lib/chunks/chunks-lightmapper.js';

import {
    BAKE_COLORDIR,
    FOG_NONE, GAMMA_NONE, TONEMAP_LINEAR,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE,
    SHADERDEF_DIRLM, SHADERDEF_LM, SHADERDEF_LMAMBIENT,
    MASK_BAKE, MASK_AFFECT_LIGHTMAPPED, MASK_AFFECT_DYNAMIC,
    SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME,
    SHADER_FORWARD
} from '../../scene/constants.js';
import { Camera } from '../../scene/camera.js';
import { GraphNode } from '../../scene/graph-node.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';

import { BakeLightSimple } from './bake-light-simple.js';
import { BakeLightAmbient } from './bake-light-ambient.js';
import { BakeMeshNode } from './bake-mesh-node.js';
import { LightmapCache } from '../../scene/graphics/lightmap-cache.js';
import { LightmapFilters } from './lightmap-filters.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPassLightmapper } from './render-pass-lightmapper.js';
import { RenderingParams } from '../../scene/renderer/rendering-params.js';

const MAX_LIGHTMAP_SIZE = 2048;

const PASS_COLOR = 0;
const PASS_DIR = 1;

const tempVec = new Vec3();

/**
 * The lightmapper is used to bake scene lights into textures.
 *
 * @category Graphics
 */
class Lightmapper {
    /**
     * Create a new Lightmapper instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device used by the lightmapper.
     * @param {import('../entity.js').Entity} root - The root entity of the scene.
     * @param {import('../../scene/scene.js').Scene} scene - The scene to lightmap.
     * @param {import('../../scene/renderer/forward-renderer.js').ForwardRenderer} renderer - The
     * renderer.
     * @param {import('../asset/asset-registry.js').AssetRegistry} assets - Registry of assets to
     * lightmap.
     * @ignore
     */
    constructor(device, root, scene, renderer, assets) {
        this.device = device;
        this.root = root;
        this.scene = scene;
        this.renderer = renderer;
        this.assets = assets;
        this.shadowMapCache = renderer.shadowMapCache;

        this._tempSet = new Set();
        this._initCalled = false;

        // internal materials used by baking
        this.passMaterials = [];
        this.ambientAOMaterial = null;

        this.fog = '';
        this.ambientLight = new Color();

        // dictionary of spare render targets with color buffer for each used size
        this.renderTargets = new Map();

        this.stats = {
            renderPasses: 0,
            lightmapCount: 0,
            totalRenderTime: 0,
            forwardTime: 0,
            fboTime: 0,
            shadowMapTime: 0,
            compileTime: 0,
            shadersLinked: 0
        };
    }

    destroy() {

        // release reference to the texture
        LightmapCache.decRef(this.blackTex);
        this.blackTex = null;

        // destroy all lightmaps
        LightmapCache.destroy();

        this.device = null;
        this.root = null;
        this.scene = null;
        this.renderer = null;
        this.assets = null;

        this.camera?.destroy();
        this.camera = null;
    }

    initBake(device) {

        // only initialize one time
        if (!this._initCalled) {
            this._initCalled = true;

            // lightmap filtering shaders
            this.lightmapFilters = new LightmapFilters(device);

            // shader related
            this.constantBakeDir = device.scope.resolve('bakeDir');
            this.materials = [];

            // small black texture
            this.blackTex = new Texture(this.device, {
                width: 4,
                height: 4,
                format: PIXELFORMAT_RGBA8,
                type: TEXTURETYPE_RGBM,
                name: 'lightmapBlack'
            });

            // incref black texture in the cache to avoid it being destroyed
            LightmapCache.incRef(this.blackTex);

            // camera used for baking
            const camera = new Camera();
            camera.clearColor.set(0, 0, 0, 0);
            camera.clearColorBuffer = true;
            camera.clearDepthBuffer = false;
            camera.clearStencilBuffer = false;
            camera.frustumCulling = false;
            camera.projection = PROJECTION_ORTHOGRAPHIC;
            camera.aspectRatio = 1;
            camera.node = new GraphNode();
            this.camera = camera;

            // baking uses HDR (no gamma / tone mapping)
            const rp = new RenderingParams();
            rp.gammaCorrection = GAMMA_NONE;
            rp.toneMapping = TONEMAP_LINEAR;
            this.camera.renderingParams = rp;
        }

        // create light cluster structure
        if (this.scene.clusteredLightingEnabled) {

            // create light params, and base most parameters on the lighting params of the scene
            const lightingParams = new LightingParams(device.supportsAreaLights, device.maxTextureSize, () => {});
            this.lightingParams = lightingParams;

            const srcParams = this.scene.lighting;
            lightingParams.shadowsEnabled = srcParams.shadowsEnabled;
            lightingParams.shadowAtlasResolution = srcParams.shadowAtlasResolution;

            lightingParams.cookiesEnabled = srcParams.cookiesEnabled;
            lightingParams.cookieAtlasResolution = srcParams.cookieAtlasResolution;

            lightingParams.areaLightsEnabled = srcParams.areaLightsEnabled;

            // some custom lightmapping params - we bake single light a time
            lightingParams.cells = new Vec3(3, 3, 3);
            lightingParams.maxLightsPerCell = 4;

            this.worldClusters = new WorldClusters(device);
            this.worldClusters.name = 'ClusterLightmapper';
        }
    }

    finishBake(bakeNodes) {

        this.materials = [];

        function destroyRT(rt) {
            // this can cause ref count to be 0 and texture destroyed
            LightmapCache.decRef(rt.colorBuffer);

            // destroy render target itself
            rt.destroy();
        }

        // spare render targets including color buffer
        this.renderTargets.forEach((rt) => {
            destroyRT(rt);
        });
        this.renderTargets.clear();

        // destroy render targets from nodes (but not color buffer)
        bakeNodes.forEach((node) => {
            node.renderTargets.forEach((rt) => {
                destroyRT(rt);
            });
            node.renderTargets.length = 0;
        });

        // this shader is only valid for specific brightness and contrast values, dispose it
        this.ambientAOMaterial = null;

        // delete light cluster
        if (this.worldClusters) {
            this.worldClusters.destroy();
            this.worldClusters = null;
        }
    }

    createMaterialForPass(device, scene, pass, addAmbient) {
        const material = new StandardMaterial();
        material.name = `lmMaterial-pass:${pass}-ambient:${addAmbient}`;
        material.chunks.APIVersion = CHUNKAPI_1_65;
        const transformDefines = '#define UV1LAYOUT\n';
        material.chunks.transformVS = transformDefines + shaderChunks.transformVS; // draw into UV1 texture space

        if (pass === PASS_COLOR) {
            let bakeLmEndChunk = shaderChunksLightmapper.bakeLmEndPS; // encode to RGBM
            if (addAmbient) {
                // diffuse light stores accumulated AO, apply contrast and brightness to it
                // and multiply ambient light color by the AO
                bakeLmEndChunk = `
                    dDiffuseLight = ((dDiffuseLight - 0.5) * max(${scene.ambientBakeOcclusionContrast.toFixed(1)} + 1.0, 0.0)) + 0.5;
                    dDiffuseLight += vec3(${scene.ambientBakeOcclusionBrightness.toFixed(1)});
                    dDiffuseLight = saturate(dDiffuseLight);
                    dDiffuseLight *= dAmbientLight;
                ` + bakeLmEndChunk;
            } else {
                material.ambient = new Color(0, 0, 0);    // don't bake ambient
                material.ambientTint = true;
            }
            material.chunks.basePS = shaderChunks.basePS + (scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? '\n#define LIGHTMAP_RGBM\n' : '');
            material.chunks.endPS = bakeLmEndChunk;
            material.lightMap = this.blackTex;
        } else {
            material.chunks.basePS = shaderChunks.basePS + '\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n';
            material.chunks.endPS = shaderChunksLightmapper.bakeDirLmEndPS;
        }

        // avoid writing unrelated things to alpha
        material.chunks.outputAlphaPS = '\n';
        material.chunks.outputAlphaOpaquePS = '\n';
        material.chunks.outputAlphaPremulPS = '\n';
        material.cull = CULLFACE_NONE;
        material.forceUv1 = true; // provide data to xformUv1
        material.update();

        return material;
    }

    createMaterials(device, scene, passCount) {
        for (let pass = 0; pass < passCount; pass++) {
            if (!this.passMaterials[pass]) {
                this.passMaterials[pass] = this.createMaterialForPass(device, scene, pass, false);
            }
        }

        // material used on last render of ambient light to multiply accumulated AO in lightmap by ambient light
        if (!this.ambientAOMaterial) {
            this.ambientAOMaterial = this.createMaterialForPass(device, scene, 0, true);
            this.ambientAOMaterial.onUpdateShader = function (options) {
                // mark LM as without ambient, to add it
                options.litOptions.lightMapWithoutAmbient = true;
                // don't add ambient to diffuse directly but keep it separate, to allow AO to be multiplied in
                options.litOptions.separateAmbient = true;
                return options;
            };
        }
    }

    createTexture(size, name) {
        return new Texture(this.device, {
            // #if _PROFILER
            profilerHint: TEXHINT_LIGHTMAP,
            // #endif
            width: size,
            height: size,
            format: this.scene.lightmapPixelFormat,
            mipmaps: false,
            type: this.scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            name: name
        });
    }

    // recursively walk the hierarchy of nodes starting at the specified node
    // collect all nodes that need to be lightmapped to bakeNodes array
    // collect all nodes with geometry to allNodes array
    collectModels(node, bakeNodes, allNodes) {
        if (!node.enabled) return;

        // mesh instances from model component
        let meshInstances;
        if (node.model?.model && node.model?.enabled) {
            if (allNodes) allNodes.push(new BakeMeshNode(node));
            if (node.model.lightmapped) {
                if (bakeNodes) {
                    meshInstances = node.model.model.meshInstances;
                }
            }
        }

        // mesh instances from render component
        if (node.render?.enabled) {
            if (allNodes) allNodes.push(new BakeMeshNode(node));
            if (node.render.lightmapped) {
                if (bakeNodes) {
                    meshInstances = node.render.meshInstances;
                }
            }
        }

        if (meshInstances) {
            let hasUv1 = true;

            for (let i = 0; i < meshInstances.length; i++) {
                if (!meshInstances[i].mesh.vertexBuffer.format.hasUv1) {
                    Debug.log(`Lightmapper - node [${node.name}] contains meshes without required uv1, excluding it from baking.`);
                    hasUv1 = false;
                    break;
                }
            }

            if (hasUv1) {
                const notInstancedMeshInstances = [];
                for (let i = 0; i < meshInstances.length; i++) {
                    const mesh = meshInstances[i].mesh;

                    // is this mesh an instance of already used mesh in this node
                    if (this._tempSet.has(mesh)) {
                        // collect each instance (object with shared VB) as separate "node"
                        bakeNodes.push(new BakeMeshNode(node, [meshInstances[i]]));
                    } else {
                        notInstancedMeshInstances.push(meshInstances[i]);
                    }
                    this._tempSet.add(mesh);
                }

                this._tempSet.clear();

                // collect all non-shared objects as one "node"
                if (notInstancedMeshInstances.length > 0) {
                    bakeNodes.push(new BakeMeshNode(node, notInstancedMeshInstances));
                }
            }
        }

        for (let i = 0; i < node._children.length; i++) {
            this.collectModels(node._children[i], bakeNodes, allNodes);
        }
    }

    // prepare all meshInstances that cast shadows into lightmaps
    prepareShadowCasters(nodes) {

        const casters = [];
        for (let n = 0; n < nodes.length; n++) {
            const component = nodes[n].component;

            component.castShadows = component.castShadowsLightmap;
            if (component.castShadowsLightmap) {

                const meshes = nodes[n].meshInstances;
                for (let i = 0; i < meshes.length; i++) {
                    meshes[i].visibleThisFrame = true;
                    casters.push(meshes[i]);
                }
            }
        }

        return casters;
    }

    // updates world transform for nodes
    updateTransforms(nodes) {

        for (let i = 0; i < nodes.length; i++) {
            const meshInstances = nodes[i].meshInstances;
            for (let j = 0; j < meshInstances.length; j++) {
                meshInstances[j].node.getWorldTransform();
            }
        }
    }

    // Note: this function is also called by the Editor to display estimated LM size in the inspector,
    // do not change its signature.
    calculateLightmapSize(node) {
        let data;
        const sizeMult = this.scene.lightmapSizeMultiplier || 16;
        const scale = tempVec;

        let srcArea, lightmapSizeMultiplier;

        if (node.model) {
            lightmapSizeMultiplier = node.model.lightmapSizeMultiplier;
            if (node.model.asset) {
                data = this.assets.get(node.model.asset).data;
                if (data.area) {
                    srcArea = data.area;
                }
            } else if (node.model._area) {
                data = node.model;
                if (data._area) {
                    srcArea = data._area;
                }
            }
        } else if (node.render) {
            lightmapSizeMultiplier = node.render.lightmapSizeMultiplier;
            if (node.render.type !== 'asset') {
                if (node.render._area) {
                    data = node.render;
                    if (data._area) {
                        srcArea = data._area;
                    }
                }
            }
        }

        // copy area
        const area = { x: 1, y: 1, z: 1, uv: 1 };
        if (srcArea) {
            area.x = srcArea.x;
            area.y = srcArea.y;
            area.z = srcArea.z;
            area.uv = srcArea.uv;
        }

        const areaMult = lightmapSizeMultiplier || 1;
        area.x *= areaMult;
        area.y *= areaMult;
        area.z *= areaMult;

        // bounds of the component
        const component = node.render || node.model;
        const bounds = this.computeNodeBounds(component.meshInstances);

        // total area in the lightmap is based on the world space bounds of the mesh
        scale.copy(bounds.halfExtents);
        let totalArea = area.x * scale.y * scale.z +
                        area.y * scale.x * scale.z +
                        area.z * scale.x * scale.y;
        totalArea /= area.uv;
        totalArea = Math.sqrt(totalArea);

        const lightmapSize = Math.min(math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || MAX_LIGHTMAP_SIZE);

        return lightmapSize;
    }

    setLightmapping(nodes, value, passCount, shaderDefs) {

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const meshInstances = node.meshInstances;

            for (let j = 0; j < meshInstances.length; j++) {

                const meshInstance = meshInstances[j];
                meshInstance.setLightmapped(value);

                if (value) {
                    if (shaderDefs) {
                        meshInstance._shaderDefs |= shaderDefs;
                    }

                    // only lights that affect lightmapped objects are used on this mesh now that it is baked
                    meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;

                    // textures
                    for (let pass = 0; pass < passCount; pass++) {
                        const tex = node.renderTargets[pass].colorBuffer;
                        tex.minFilter = FILTER_LINEAR;
                        tex.magFilter = FILTER_LINEAR;
                        meshInstance.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tex);
                    }
                }
            }
        }
    }

    /**
     * Generates and applies the lightmaps.
     *
     * @param {import('../entity.js').Entity[]|null} nodes - An array of entities (with model or
     * render components) to render lightmaps for. If not supplied, the entire scene will be baked.
     * @param {number} [mode] - Baking mode. Can be:
     *
     * - {@link BAKE_COLOR}: single color lightmap
     * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for
     * bump/specular)
     *
     * Only lights with bakeDir=true will be used for generating the dominant light direction.
     * Defaults to {@link BAKE_COLORDIR}.
     */
    bake(nodes, mode = BAKE_COLORDIR) {

        const device = this.device;
        const startTime = now();

        // update skybox
        this.scene._updateSkyMesh();

        // #if _PROFILER
        device.fire('lightmapper:start', {
            timestamp: startTime,
            target: this
        });
        // #endif

        this.stats.renderPasses = 0;
        this.stats.shadowMapTime = 0;
        this.stats.forwardTime = 0;
        const startShaders = device._shaderStats.linked;
        const startFboTime = device._renderTargetCreationTime;
        const startCompileTime = device._shaderStats.compileTime;

        // BakeMeshNode objects for baking
        const bakeNodes = [];

        // all BakeMeshNode objects
        const allNodes = [];

        // collect nodes / meshInstances for baking
        if (nodes) {

            // collect nodes for baking based on specified list of nodes
            for (let i = 0; i < nodes.length; i++) {
                this.collectModels(nodes[i], bakeNodes, null);
            }

            // collect all nodes from the scene
            this.collectModels(this.root, null, allNodes);

        } else {

            // collect nodes from the root of the scene
            this.collectModels(this.root, bakeNodes, allNodes);

        }

        DebugGraphics.pushGpuMarker(this.device, 'LMBake');

        // bake nodes
        if (bakeNodes.length > 0) {

            this.renderer.shadowRenderer.frameUpdate();

            // disable lightmapping
            const passCount = mode === BAKE_COLORDIR ? 2 : 1;
            this.setLightmapping(bakeNodes, false, passCount);

            this.initBake(device);
            this.bakeInternal(passCount, bakeNodes, allNodes);

            // Enable new lightmaps
            let shaderDefs = SHADERDEF_LM;

            if (mode === BAKE_COLORDIR) {
                shaderDefs |= SHADERDEF_DIRLM;
            }

            // mark lightmap as containing ambient lighting
            if (this.scene.ambientBake) {
                shaderDefs |= SHADERDEF_LMAMBIENT;
            }
            this.setLightmapping(bakeNodes, true, passCount, shaderDefs);

            // clean up memory
            this.finishBake(bakeNodes);
        }

        DebugGraphics.popGpuMarker(this.device);

        const nowTime = now();
        this.stats.totalRenderTime = nowTime - startTime;
        this.stats.shadersLinked = device._shaderStats.linked - startShaders;
        this.stats.compileTime = device._shaderStats.compileTime - startCompileTime;
        this.stats.fboTime = device._renderTargetCreationTime - startFboTime;
        this.stats.lightmapCount = bakeNodes.length;

        // #if _PROFILER
        device.fire('lightmapper:end', {
            timestamp: nowTime,
            target: this
        });
        // #endif
    }

    // this allocates lightmap textures and render targets.
    allocateTextures(bakeNodes, passCount) {

        for (let i = 0; i < bakeNodes.length; i++) {

            // required lightmap size
            const bakeNode = bakeNodes[i];
            const size = this.calculateLightmapSize(bakeNode.node);

            // texture and render target for each pass, stored per node
            for (let pass = 0; pass < passCount; pass++) {
                const tex = this.createTexture(size, ('lightmapper_lightmap_' + i));
                LightmapCache.incRef(tex);
                bakeNode.renderTargets[pass] = new RenderTarget({
                    colorBuffer: tex,
                    depth: false
                });
            }

            // single temporary render target of each size
            if (!this.renderTargets.has(size)) {
                const tex = this.createTexture(size, ('lightmapper_temp_lightmap_' + size));
                LightmapCache.incRef(tex);
                this.renderTargets.set(size, new RenderTarget({
                    colorBuffer: tex,
                    depth: false
                }));
            }
        }
    }

    prepareLightsToBake(layerComposition, allLights, bakeLights) {

        // ambient light
        if (this.scene.ambientBake) {
            const ambientLight = new BakeLightAmbient(this.scene);
            bakeLights.push(ambientLight);
        }

        // scene lights
        const sceneLights = this.renderer.lights;
        for (let i = 0; i < sceneLights.length; i++) {
            const light = sceneLights[i];

            // store all lights and their original settings we need to temporarily modify
            const bakeLight = new BakeLightSimple(this.scene, light);
            allLights.push(bakeLight);

            // bake light
            if (light.enabled && (light.mask & MASK_BAKE) !== 0) {
                light.mask = MASK_BAKE | MASK_AFFECT_LIGHTMAPPED | MASK_AFFECT_DYNAMIC;
                light.shadowUpdateMode = light.type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
                bakeLights.push(bakeLight);
            }
        }

        // sort bake lights by type to minimize shader switches
        bakeLights.sort();
    }

    restoreLights(allLights) {

        for (let i = 0; i < allLights.length; i++) {
            allLights[i].restore();
        }
    }

    setupScene() {

        // backup
        this.fog = this.scene.fog;
        this.ambientLight.copy(this.scene.ambientLight);

        // set up scene
        this.scene.fog = FOG_NONE;

        // if not baking ambient, set it to black
        if (!this.scene.ambientBake) {
            this.scene.ambientLight.set(0, 0, 0);
        }

        // apply scene settings
        this.renderer.setSceneConstants();
    }

    restoreScene() {

        this.scene.fog = this.fog;
        this.scene.ambientLight.copy(this.ambientLight);
    }

    // compute bounding box for a single node
    computeNodeBounds(meshInstances) {

        const bounds = new BoundingBox();

        if (meshInstances.length > 0) {
            bounds.copy(meshInstances[0].aabb);
            for (let m = 1; m < meshInstances.length; m++) {
                bounds.add(meshInstances[m].aabb);
            }
        }

        return bounds;
    }

    // compute bounding box for each node
    computeNodesBounds(nodes) {

        for (let i = 0; i < nodes.length; i++) {
            const meshInstances = nodes[i].meshInstances;
            nodes[i].bounds = this.computeNodeBounds(meshInstances);
        }
    }

    // compute compound bounding box for an array of mesh instances
    computeBounds(meshInstances) {

        const bounds = new BoundingBox();

        for (let i = 0; i < meshInstances.length; i++) {
            bounds.copy(meshInstances[0].aabb);
            for (let m = 1; m < meshInstances.length; m++) {
                bounds.add(meshInstances[m].aabb);
            }
        }

        return bounds;
    }

    backupMaterials(meshInstances) {
        for (let i = 0; i < meshInstances.length; i++) {
            this.materials[i] = meshInstances[i].material;
        }
    }

    restoreMaterials(meshInstances) {
        for (let i = 0; i < meshInstances.length; i++) {
            meshInstances[i].material = this.materials[i];
        }
    }

    lightCameraPrepare(device, bakeLight) {

        const light = bakeLight.light;
        let shadowCam;

        // only prepare camera for spot light, other cameras need to be adjusted per cubemap face / per node later
        if (light.type === LIGHTTYPE_SPOT) {

            const lightRenderData = light.getRenderData(null, 0);
            shadowCam = lightRenderData.shadowCamera;

            shadowCam._node.setPosition(light._node.getPosition());
            shadowCam._node.setRotation(light._node.getRotation());
            shadowCam._node.rotateLocal(-90, 0, 0);

            shadowCam.projection = PROJECTION_PERSPECTIVE;
            shadowCam.nearClip = light.attenuationEnd / 1000;
            shadowCam.farClip = light.attenuationEnd;
            shadowCam.aspectRatio = 1;
            shadowCam.fov = light._outerConeAngle * 2;

            this.renderer.updateCameraFrustum(shadowCam);
        }
        return shadowCam;
    }

    // prepares camera / frustum of the light for rendering the bakeNode
    // returns true if light affects the bakeNode
    lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds) {

        const light = bakeLight.light;
        let lightAffectsNode = true;

        if (light.type === LIGHTTYPE_DIRECTIONAL) {

            // tweak directional light camera to fully see all casters and they are fully inside the frustum
            tempVec.copy(casterBounds.center);
            tempVec.y += casterBounds.halfExtents.y;

            this.camera.node.setPosition(tempVec);
            this.camera.node.setEulerAngles(-90, 0, 0);

            this.camera.nearClip = 0;
            this.camera.farClip = casterBounds.halfExtents.y * 2;

            const frustumSize = Math.max(casterBounds.halfExtents.x, casterBounds.halfExtents.z);
            this.camera.orthoHeight = frustumSize;

        } else {

            // for other light types, test if light affects the node
            if (!bakeLight.lightBounds.intersects(bakeNode.bounds)) {
                lightAffectsNode = false;
            }
        }

        // per meshInstance culling for spot light only
        // (omni lights cull per face later, directional lights don't cull)
        if (light.type === LIGHTTYPE_SPOT) {
            let nodeVisible = false;

            const meshInstances = bakeNode.meshInstances;
            for (let i = 0; i < meshInstances.length; i++) {
                if (meshInstances[i]._isVisible(shadowCam)) {
                    nodeVisible = true;
                    break;
                }
            }
            if (!nodeVisible) {
                lightAffectsNode = false;
            }
        }

        return lightAffectsNode;
    }

    // set up light array for a single light
    setupLightArray(lightArray, light) {

        lightArray[LIGHTTYPE_DIRECTIONAL].length = 0;
        lightArray[LIGHTTYPE_OMNI].length = 0;
        lightArray[LIGHTTYPE_SPOT].length = 0;

        lightArray[light.type][0] = light;
        light.visibleThisFrame = true;
    }

    renderShadowMap(comp, shadowMapRendered, casters, bakeLight) {

        const light = bakeLight.light;
        const isClustered = this.scene.clusteredLightingEnabled;
        const castShadow = light.castShadows && (!isClustered || this.scene.lighting.shadowsEnabled);

        if (!shadowMapRendered && castShadow) {

            // allocate shadow map from the cache to avoid per light allocation
            if (!light.shadowMap && !isClustered) {
                light.shadowMap = this.shadowMapCache.get(this.device, light);
            }

            if (light.type === LIGHTTYPE_DIRECTIONAL) {
                this.renderer._shadowRendererDirectional.cull(light, comp, this.camera, casters);

                const shadowPass = this.renderer._shadowRendererDirectional.getLightRenderPass(light, this.camera);
                shadowPass?.render();

            } else {

                // TODO: lightmapper on WebGPU does not yet support spot and omni shadows
                if (this.device.isWebGPU) {
                    Debug.warnOnce('Lightmapper on WebGPU does not yet support spot and omni shadows.');
                    return true;
                }

                this.renderer._shadowRendererLocal.cull(light, comp, casters);

                // TODO: this needs to use render passes to work on WebGPU
                const insideRenderPass = false;
                this.renderer.shadowRenderer.render(light, this.camera, insideRenderPass);
            }
        }

        return true;
    }

    postprocessTextures(device, bakeNodes, passCount) {

        const numDilates2x = 1; // 1 or 2 dilates (depending on filter being enabled)
        const dilateShader = this.lightmapFilters.shaderDilate;

        // bilateral denoise filter - runs as a first pass, before dilate
        const filterLightmap = this.scene.lightmapFilterEnabled;
        if (filterLightmap) {
            this.lightmapFilters.prepareDenoise(this.scene.lightmapFilterRange, this.scene.lightmapFilterSmoothness);
        }

        device.setBlendState(BlendState.NOBLEND);
        device.setDepthState(DepthState.NODEPTH);
        device.setStencilState(null, null);

        for (let node = 0; node < bakeNodes.length; node++) {
            const bakeNode = bakeNodes[node];

            DebugGraphics.pushGpuMarker(this.device, `LMPost:${node}`);

            for (let pass = 0; pass < passCount; pass++) {

                const nodeRT = bakeNode.renderTargets[pass];
                const lightmap = nodeRT.colorBuffer;

                const tempRT = this.renderTargets.get(lightmap.width);
                const tempTex = tempRT.colorBuffer;

                this.lightmapFilters.prepare(lightmap.width, lightmap.height);

                // bounce dilate between textures, execute denoise on the first pass
                for (let i = 0; i < numDilates2x; i++) {

                    this.lightmapFilters.setSourceTexture(lightmap);
                    const bilateralFilterEnabled = filterLightmap && pass === 0 && i === 0;
                    drawQuadWithShader(device, tempRT, bilateralFilterEnabled ? this.lightmapFilters.shaderDenoise : dilateShader);

                    this.lightmapFilters.setSourceTexture(tempTex);
                    drawQuadWithShader(device, nodeRT, dilateShader);
                }
            }

            DebugGraphics.popGpuMarker(this.device);
        }
    }

    bakeInternal(passCount, bakeNodes, allNodes) {

        const scene = this.scene;
        const comp = scene.layers;
        const device = this.device;
        const clusteredLightingEnabled = scene.clusteredLightingEnabled;

        this.createMaterials(device, scene, passCount);
        this.setupScene();

        // update layer composition
        comp._update();

        // compute bounding boxes for nodes
        this.computeNodesBounds(bakeNodes);

        // Calculate lightmap sizes and allocate textures
        this.allocateTextures(bakeNodes, passCount);

        // Collect bakeable lights, and also keep allLights along with their properties we change to restore them later
        this.renderer.collectLights(comp);
        const allLights = [], bakeLights = [];
        this.prepareLightsToBake(comp, allLights, bakeLights);

        // update transforms
        this.updateTransforms(allNodes);

        // get all meshInstances that cast shadows into lightmap and set them up for realtime shadow casting
        const casters = this.prepareShadowCasters(allNodes);

        // update skinned and morphed meshes
        this.renderer.updateCpuSkinMatrices(casters);
        this.renderer.gpuUpdate(casters);

        // compound bounding box for all casters, used to compute shared directional light shadow
        const casterBounds = this.computeBounds(casters);

        let i, j, rcv, m;

        // Prepare models
        for (i = 0; i < bakeNodes.length; i++) {
            const bakeNode = bakeNodes[i];
            rcv = bakeNode.meshInstances;

            for (j = 0; j < rcv.length; j++) {
                // patch meshInstance
                m = rcv[j];

                m.setLightmapped(false);
                m.mask = MASK_BAKE; // only affected by LM lights

                // patch material
                m.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], m.material.lightMap ? m.material.lightMap : this.blackTex);
                m.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], this.blackTex);
            }
        }

        // Disable all bakeable lights
        for (j = 0; j < bakeLights.length; j++) {
            bakeLights[j].light.enabled = false;
        }

        const lightArray = [[], [], []];
        let pass, node;
        let shadersUpdatedOn1stPass = false;

        // Accumulate lights into RGBM textures
        for (i = 0; i < bakeLights.length; i++) {
            const bakeLight = bakeLights[i];
            const isAmbientLight = bakeLight instanceof BakeLightAmbient;
            const isDirectional = bakeLight.light.type === LIGHTTYPE_DIRECTIONAL;

            // light can be baked using many virtual lights to create soft effect
            let numVirtualLights = bakeLight.numVirtualLights;

            // direction baking is not currently compatible with virtual lights, as we end up with no valid direction in lights penumbra
            if (passCount > 1 && numVirtualLights > 1 && bakeLight.light.bakeDir) {
                numVirtualLights = 1;
                Debug.warn('Lightmapper\'s BAKE_COLORDIR mode is not compatible with Light\'s bakeNumSamples larger than one. Forcing it to one.');
            }

            for (let virtualLightIndex = 0; virtualLightIndex < numVirtualLights; virtualLightIndex++) {

                DebugGraphics.pushGpuMarker(device, `Light:${bakeLight.light._node.name}:${virtualLightIndex}`);

                // prepare virtual light
                if (numVirtualLights > 1) {
                    bakeLight.prepareVirtualLight(virtualLightIndex, numVirtualLights);
                }

                bakeLight.startBake();
                let shadowMapRendered = false;

                const shadowCam = this.lightCameraPrepare(device, bakeLight);

                for (node = 0; node < bakeNodes.length; node++) {

                    const bakeNode = bakeNodes[node];
                    rcv = bakeNode.meshInstances;

                    const lightAffectsNode = this.lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds);
                    if (!lightAffectsNode) {
                        continue;
                    }

                    this.setupLightArray(lightArray, bakeLight.light);
                    const clusterLights = isDirectional ? [] : [bakeLight.light];

                    if (clusteredLightingEnabled) {
                        this.renderer.lightTextureAtlas.update(clusterLights, this.lightingParams);
                    }

                    // render light shadow map needs to be rendered
                    shadowMapRendered = this.renderShadowMap(comp, shadowMapRendered, casters, bakeLight);

                    if (clusteredLightingEnabled) {
                        this.worldClusters.update(clusterLights, this.lightingParams);
                    }

                    // Store original materials
                    this.backupMaterials(rcv);

                    for (pass = 0; pass < passCount; pass++) {

                        // only bake first virtual light for pass 1, as it does not handle overlapping lights
                        if (pass > 0 && virtualLightIndex > 0) {
                            break;
                        }

                        // don't bake ambient light in pass 1, as there's no main direction
                        if (isAmbientLight && pass > 0) {
                            break;
                        }

                        DebugGraphics.pushGpuMarker(device, `LMPass:${pass}`);

                        // lightmap size
                        const nodeRT = bakeNode.renderTargets[pass];
                        const lightmapSize = bakeNode.renderTargets[pass].colorBuffer.width;

                        // get matching temp render target to render to
                        const tempRT = this.renderTargets.get(lightmapSize);
                        const tempTex = tempRT.colorBuffer;

                        if (pass === 0) {
                            shadersUpdatedOn1stPass = scene.updateShaders;
                        } else if (shadersUpdatedOn1stPass) {
                            scene.updateShaders = true;
                        }

                        let passMaterial = this.passMaterials[pass];
                        if (isAmbientLight) {
                            // for last virtual light of ambient light, multiply accumulated AO lightmap with ambient light
                            const lastVirtualLightForPass = virtualLightIndex + 1 === numVirtualLights;
                            if (lastVirtualLightForPass && pass === 0) {
                                passMaterial = this.ambientAOMaterial;
                            }
                        }

                        // set up material for baking a pass
                        for (j = 0; j < rcv.length; j++) {
                            rcv[j].material = passMaterial;
                        }

                        // update shader
                        this.renderer.updateShaders(rcv);

                        // render receivers to the tempRT
                        if (pass === PASS_DIR) {
                            this.constantBakeDir.setValue(bakeLight.light.bakeDir ? 1 : 0);
                        }

                        if (device.isWebGPU) {

                            // TODO: On WebGPU we use a render pass, but this has some issue it seems,
                            // and needs to be investigated and fixed. In the LightsBaked example, edges of
                            // some geometry are not lit correctly, especially visible on boxes. Most likely
                            // some global per frame / per camera constants are not set up or similar, that
                            // renderForward sets up.
                            const renderPass = new RenderPassLightmapper(device, this.renderer, this.camera,
                                                                         clusteredLightingEnabled ? this.worldClusters : null,
                                                                         rcv, lightArray);
                            renderPass.init(tempRT);
                            renderPass.render();
                            renderPass.destroy();

                        } else {    // use the old path for WebGL till the render pass way above is fixed

                            // ping-ponging output
                            this.renderer.setCamera(this.camera, tempRT, true);

                            // prepare clustered lighting
                            if (clusteredLightingEnabled) {
                                this.worldClusters.activate();
                            }

                            this.renderer._forwardTime = 0;
                            this.renderer._shadowMapTime = 0;

                            this.renderer.renderForward(this.camera, rcv, lightArray, SHADER_FORWARD);

                            device.updateEnd();
                        }

                        // #if _PROFILER
                        this.stats.shadowMapTime += this.renderer._shadowMapTime;
                        this.stats.forwardTime += this.renderer._forwardTime;
                        this.stats.renderPasses++;
                        // #endif

                        // temp render target now has lightmap, store it for the node
                        bakeNode.renderTargets[pass] = tempRT;

                        // and release previous lightmap into temp render target pool
                        this.renderTargets.set(lightmapSize, nodeRT);

                        for (j = 0; j < rcv.length; j++) {
                            m = rcv[j];
                            m.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tempTex); // ping-ponging input
                            m._shaderDefs |= SHADERDEF_LM; // force using LM even if material doesn't have it
                        }

                        DebugGraphics.popGpuMarker(device);
                    }

                    // Revert to original materials
                    this.restoreMaterials(rcv);
                }

                bakeLight.endBake(this.shadowMapCache);

                DebugGraphics.popGpuMarker(device);
            }
        }

        this.postprocessTextures(device, bakeNodes, passCount);

        // restore changes
        for (node = 0; node < allNodes.length; node++) {
            allNodes[node].restore();
        }

        this.restoreLights(allLights);
        this.restoreScene();

        // empty cache to minimize persistent memory use .. if some cached textures are needed,
        // they will be allocated again as needed
        if (!clusteredLightingEnabled) {
            this.shadowMapCache.clear();
        }
    }
}

export { Lightmapper };
