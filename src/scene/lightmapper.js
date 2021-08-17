import { now } from '../core/time.js';

import { math } from '../math/math.js';
import { Color } from '../math/color.js';
import { Vec3 } from '../math/vec3.js';

import { BoundingBox } from '../shape/bounding-box.js';
import { BoundingSphere } from '../shape/bounding-sphere.js';

import {
    CULLFACE_NONE,
    FILTER_LINEAR, FILTER_NEAREST,
    PIXELFORMAT_R8_G8_B8_A8,
    TEXHINT_LIGHTMAP,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM
} from '../graphics/constants.js';
import { createShaderFromCode } from '../graphics/program-lib/utils.js';
import { shaderChunks } from '../graphics/program-lib/chunks/chunks.js';
import { drawQuadWithShader } from '../graphics/simple-post-effect.js';
import { RenderTarget } from '../graphics/render-target.js';
import { Texture } from '../graphics/texture.js';

import { MeshInstance } from './mesh-instance.js';

import {
    BAKE_COLORDIR,
    FOG_NONE,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE,
    SHADER_FORWARDHDR,
    SHADERDEF_DIRLM, SHADERDEF_LM,
    MASK_LIGHTMAP, MASK_BAKED,
    SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME
} from '../scene/constants.js';
import { Camera } from '../scene/camera.js';
import { GraphNode } from '../scene/graph-node.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';

const MAX_LIGHTMAP_SIZE = 2048;

const PASS_COLOR = 0;
const PASS_DIR = 1;

const tempVec = new Vec3();
const tempSphere = new BoundingSphere();

// helper class to wrap node including its meshInstances
class MeshNode {
    constructor(node, meshInstances = null) {
        this.node = node;

        if (node.render) {
            this.component = node.render;
            meshInstances = meshInstances ? meshInstances : node.render.meshInstances;
        } else {
            this.component = node.model;
            meshInstances = meshInstances ? meshInstances : node.model.model.meshInstances;
        }

        this.castShadows = this.component.castShadows;
        this.meshInstances = meshInstances;

        // world space aabb for all meshInstances
        this.bounds = null;

        // render target with attached color buffer for each render pass
        this.renderTargets = [];
    }
}

// helper class to store all lights including their original state
class LightInfo {
    constructor(light) {
        this.light = light;

        // original light properties
        this.store();

        // don't use cascades
        light.numCascades = 1;

        // bounds for non-directional light
        if (light.type !== LIGHTTYPE_DIRECTIONAL) {

            // world sphere
            light._node.getWorldTransform();
            light.getBoundingSphere(tempSphere);

            // world aabb
            this.lightBounds = new BoundingBox();
            this.lightBounds.center.copy(tempSphere.center);
            this.lightBounds.halfExtents.set(tempSphere.radius, tempSphere.radius, tempSphere.radius);
        }
    }

    store() {
        this.mask = this.light.mask;
        this.shadowUpdateMode = this.light.shadowUpdateMode;
        this.enabled = this.light.enabled;
        this.numCascades = this.light.numCascades;
    }

    restore() {
        this.light.mask = this.mask;
        this.light.shadowUpdateMode = this.shadowUpdateMode;
        this.light.enabled = this.enabled;
        this.light.numCascades = this.numCascades;
    }
}

/**
 * @class
 * @name Lightmapper
 * @classdesc The lightmapper is used to bake scene lights into textures.
 * @param {GraphicsDevice} device - The grahpics device used by the lightmapper.
 * @param {Entity} root - The root entity of the scene.
 * @param {Scene} scene - The scene to lightmap.
 * @param {ForwardRenderer} renderer - The renderer.
 * @param {AssetRegistry} assets - Registry of assets to lightmap.
 */
class Lightmapper {
    constructor(device, root, scene, renderer, assets) {
        this.device = device;
        this.root = root;
        this.scene = scene;
        this.renderer = renderer;
        this.assets = assets;
        this.shadowMapCache = renderer._shadowRenderer.shadowMapCache;

        this._tempSet = new Set();
        this._initCalled = false;
        this.passMaterials = [];

        this.fog = "";
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
        MeshInstance.decRefLightmap(this.blackTex);
        this.blackTex = null;

        // destroy all lightmaps
        MeshInstance.destroyLightmapCache();

        this.device = null;
        this.root = null;
        this.scene = null;
        this.renderer = null;
        this.assets = null;
    }

    initBake(device) {

        // only initialize one time
        if (!this._initCalled) {
            this._initCalled = true;

            // shader related
            this.dilateShader = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.dilatePS, "lmDilate");
            this.constantTexSource = device.scope.resolve("source");
            this.constantPixelOffset = device.scope.resolve("pixelOffset");
            this.constantBakeDir = device.scope.resolve("bakeDir");
            this.pixelOffset = new Float32Array(2);
            this.materials = [];

            // small black texture
            this.blackTex = new Texture(this.device, {
                width: 4,
                height: 4,
                format: PIXELFORMAT_R8_G8_B8_A8,
                type: TEXTURETYPE_RGBM
            });
            this.blackTex.name = 'lightmapBlack';

            // incref black texture in the cache to avoid it being destroyed
            MeshInstance.incRefLightmap(this.blackTex);

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
        }
    }

    finishBake(bakeNodes) {

        this.materials = [];

        function destroyRT(rt) {
            // this can cause ref count to be 0 and texture destroyed
            MeshInstance.decRefLightmap(rt.colorBuffer);

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
            node.renderTargets.lenght = 0;
        });
    }

    createMaterials(device, scene, passCount) {

        const xformUv1 = "#define UV1LAYOUT\n" + shaderChunks.transformVS;
        const bakeLmEnd = shaderChunks.bakeLmEndPS;

        for (let pass = 0; pass < passCount; pass++) {
            if (!this.passMaterials[pass]) {

                const lmMaterial = new StandardMaterial();
                lmMaterial.chunks.transformVS = xformUv1; // draw UV1

                if (pass === PASS_COLOR) {
                    lmMaterial.chunks.endPS = bakeLmEnd; // encode to RGBM
                    // don't bake ambient
                    lmMaterial.ambient = new Color(0, 0, 0);
                    lmMaterial.ambientTint = true;
                    lmMaterial.lightMap = this.blackTex;
                } else {
                    lmMaterial.chunks.basePS = shaderChunks.basePS + "\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n";
                    lmMaterial.chunks.endPS = shaderChunks.bakeDirLmEndPS;
                }

                // avoid writing unrelated things to alpha
                lmMaterial.chunks.outputAlphaPS = "\n";
                lmMaterial.chunks.outputAlphaOpaquePS = "\n";
                lmMaterial.chunks.outputAlphaPremulPS = "\n";
                lmMaterial.cull = CULLFACE_NONE;
                lmMaterial.forceUv1 = true; // provide data to xformUv1
                lmMaterial.update();
                lmMaterial.updateShader(device, scene);
                lmMaterial.name = "lmMaterial" + pass;

                this.passMaterials[pass] = lmMaterial;
            }
        }
    }

    createTexture(size, type, name) {

        const tex = new Texture(this.device, {
            // #if _PROFILER
            profilerHint: TEXHINT_LIGHTMAP,
            // #endif
            width: size,
            height: size,
            format: PIXELFORMAT_R8_G8_B8_A8,
            mipmaps: false,
            type: type,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST
        });
        tex.name = name;

        return tex;
    }

    // recursively walk the hierarchy of nodes starting at the specified node
    // collect all nodes that need to be lightmapped to bakeNodes array
    // collect all nodes with geometry to allNodes array
    collectModels(node, bakeNodes, allNodes) {
        if (!node.enabled) return;

        // mesh instances from model component
        let meshInstances;
        if (node.model?.model && node.model?.enabled) {
            if (allNodes) allNodes.push(new MeshNode(node));
            if (node.model.lightmapped) {
                if (bakeNodes) {
                    meshInstances = node.model.model.meshInstances;
                }
            }
        }

        // mesh instances from render component
        if (node.render?.enabled) {
            if (allNodes) allNodes.push(new MeshNode(node));
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
                    hasUv1 = false;

                    // #if _DEBUG
                    console.log(`Lightmapper - node [${node.name}] contains meshes without required uv1, excluding it from baking.`);
                    // #endif

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
                        bakeNodes.push(new MeshNode(node, [meshInstances[i]]));
                    } else {
                        notInstancedMeshInstances.push(meshInstances[i]);
                    }
                    this._tempSet.add(mesh);
                }

                this._tempSet.clear();

                // collect all non-shared objects as one "node"
                if (notInstancedMeshInstances.length > 0) {
                    bakeNodes.push(new MeshNode(node, notInstancedMeshInstances));
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

    calculateLightmapSize(node) {
        let data, parent;
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
            // OTHERWISE: TODO: render asset type should provide the area data - which describe size of mesh to allow
            // auto-scaling of assigned lightmap resolution

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

        scale.copy(node.localScale);
        parent = node._parent;
        while (parent) {
            scale.mul(parent.localScale);
            parent = parent._parent;
        }

        // Negatively scaled nodes still need full size lightmaps.
        scale.x = Math.abs(scale.x);
        scale.y = Math.abs(scale.y);
        scale.z = Math.abs(scale.z);

        let totalArea = area.x * scale.y * scale.z +
                        area.y * scale.x * scale.z +
                        area.z * scale.x * scale.y;
        totalArea /= area.uv;
        totalArea = Math.sqrt(totalArea);

        return Math.min(math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || MAX_LIGHTMAP_SIZE);
    }

    setLightmaping(nodes, value, passCount, shaderDefs) {

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

                    meshInstance.mask = MASK_BAKED;

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
     * @function
     * @name Lightmapper#bake
     * @description Generates and applies the lightmaps.
     * @param {Entity[]|null} nodes - An array of entities (with model or render components) to render
     * lightmaps for. If not supplied, the entire scene will be baked.
     * @param {number} [mode] - Baking mode. Can be:
     *
     * * {@link BAKE_COLOR}: single color lightmap
     * * {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump/specular)
     *
     * Only lights with bakeDir=true will be used for generating the dominant light direction. Defaults to
     * {@link BAKE_COLORDIR}.
     */
    bake(nodes, mode = BAKE_COLORDIR) {

        const device = this.device;
        const startTime = now();

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

        // MeshNode objects for baking
        const bakeNodes = [];

        // all MeshNode objects
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

        // bake nodes
        if (bakeNodes.length > 0) {

            // disable lightmapping
            const passCount = mode === BAKE_COLORDIR ? 2 : 1;
            this.setLightmaping(bakeNodes, false, passCount);

            this.initBake(device);
            this.bakeInternal(passCount, bakeNodes, allNodes);

            // Enable new lightmaps
            const shaderDefs = mode === BAKE_COLORDIR ? (SHADERDEF_LM | SHADERDEF_DIRLM) : SHADERDEF_LM;
            this.setLightmaping(bakeNodes, true, passCount, shaderDefs);

            // clean up memory
            this.finishBake(bakeNodes);
        }

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

    // this allocates lightmap textures and render targets. Note that the type used here is always TEXTURETYPE_DEFAULT,
    // as we ping-pong between various render targets anyways, and shader uses hardcoded types and ignores it anyways.
    allocateTextures(bakeNodes, passCount) {

        for (let i = 0; i < bakeNodes.length; i++) {

            // required lightmap size
            const bakeNode = bakeNodes[i];
            const size = this.calculateLightmapSize(bakeNode.node);

            // texture and render target for each pass, stored per node
            for (let pass = 0; pass < passCount; pass++) {
                const tex = this.createTexture(size, TEXTURETYPE_DEFAULT, ("lightmapper_lightmap_" + i));
                MeshInstance.incRefLightmap(tex);
                bakeNode.renderTargets[pass] = new RenderTarget({
                    colorBuffer: tex,
                    depth: false
                });
            }

            // single temporary render target of each size
            if (!this.renderTargets.has(size)) {
                const tex = this.createTexture(size, TEXTURETYPE_DEFAULT, ("lightmapper_temp_lightmap_" + size));
                MeshInstance.incRefLightmap(tex);
                this.renderTargets.set(size, new RenderTarget({
                    colorBuffer: tex,
                    depth: false
                }));
            }
        }
    }

    prepareLightsToBake(layerComposition, allLights, bakeLights) {

        const sceneLights = layerComposition._lights;

        for (let i = 0; i < sceneLights.length; i++) {
            const light = sceneLights[i];

            // store all lights and their original settings we need to temporariy modify
            const lightInfo = new LightInfo(light);
            allLights.push(lightInfo);

            // bake light
            if (light.enabled && (light.mask & MASK_LIGHTMAP) !== 0) {

                // if baked, it can't be used as static
                light.isStatic = false;

                light.mask = 0xFFFFFFFF;
                light.shadowUpdateMode = light.type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
                bakeLights.push(lightInfo);
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

        // lightmapper needs original model draw calls
        this.revertStatic = false;
        if (this.scene._needsStaticPrepare) {
            this.scene._needsStaticPrepare = false;
            this.revertStatic = true;
        }

        // backup
        this.fog = this.scene.fog;
        this.ambientLight.copy(this.scene.ambientLight);

        // set up scene
        this.scene.fog = FOG_NONE;
        this.scene.ambientLight.set(0, 0, 0);
    }

    restoreScene() {

        this.scene.fog = this.fog;
        this.scene.ambientLight.copy(this.ambientLight);

        // Revert static preprocessing
        if (this.revertStatic) {
            this.scene._needsStaticPrepare = true;
        }
    }

    // compute bounding box for each node
    computeNodeBounds(nodes) {

        const bounds = new BoundingBox();

        for (let i = 0; i < nodes.length; i++) {
            const meshInstances = nodes[i].meshInstances;
            if (meshInstances.length > 0) {
                bounds.copy(meshInstances[0].aabb);
                for (let m = 1; m < meshInstances.length; m++) {
                    bounds.add(meshInstances[m].aabb);
                }
            }

            nodes[i].bounds = bounds.clone();
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

    // preparas camera / frustum of the light for rendering the bakeNode
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
    }

    renderShadowMap(shadowMapRendered, casters, lightArray, bakeLight) {

        const light = bakeLight.light;
        if (!shadowMapRendered && light.castShadows) {

            // allocate shadow map from the cache to avoid per light allocation
            light.shadowMap = this.shadowMapCache.get(this.device, light);

            if (light.type === LIGHTTYPE_DIRECTIONAL) {
                this.renderer._shadowRenderer.cullDirectional(light, casters, this.camera);
            } else {
                this.renderer._shadowRenderer.cullLocal(light, casters);
            }

            this.renderer.renderShadows(lightArray[light.type], this.camera);
        }

        return true;
    }

    dilateTextures(device, bakeNodes, passCount) {

        const numDilates2x = 4; // 8 dilates

        const pixelOffset = this.pixelOffset;
        const dilateShader = this.dilateShader;
        const constantTexSource = this.constantTexSource;
        const constantPixelOffset = this.constantPixelOffset;

        for (let node = 0; node < bakeNodes.length; node++) {
            const bakeNode = bakeNodes[node];

            for (let pass = 0; pass < passCount; pass++) {

                const nodeRT = bakeNode.renderTargets[pass];
                const lightmap = nodeRT.colorBuffer;

                const tempRT = this.renderTargets.get(lightmap.width);
                const tempTex = tempRT.colorBuffer;

                pixelOffset[0] = 1 / lightmap.width;
                pixelOffset[1] = 1 / lightmap.height;
                constantPixelOffset.setValue(pixelOffset);

                // bounce dilate between textures
                for (let i = 0; i < numDilates2x; i++) {
                    constantTexSource.setValue(lightmap);
                    drawQuadWithShader(device, tempRT, dilateShader);

                    constantTexSource.setValue(tempTex);
                    drawQuadWithShader(device, nodeRT, dilateShader);
                }
            }
        }
    }

    bakeInternal(passCount, bakeNodes, allNodes) {

        const scene = this.scene;
        const device = this.device;

        this.createMaterials(device, scene, passCount);
        this.setupScene();

        // update layer composition
        scene.layers._update();

        // Calculate lightmap sizes and allocate textures
        this.allocateTextures(bakeNodes, passCount);

        // Collect bakeable lights, and also keep allLights along with their properties we change to restore them later
        const allLights = [], bakeLights = [];
        this.prepareLightsToBake(scene.layers, allLights, bakeLights);

        // update transforms
        this.updateTransforms(allNodes);

        // get all meshInstances that cast shadows into lightmap and set them up for realtime shadow casting
        const casters = this.prepareShadowCasters(allNodes);

        // update skinned and morphed meshes
        this.renderer.updateMorphing(casters);
        this.renderer.updateCpuSkinMatrices(casters);
        this.renderer.gpuUpdate(casters);

        // compute bounding boxes for nodes
        this.computeNodeBounds(bakeNodes);

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
                m.mask = MASK_LIGHTMAP; // only affected by LM lights

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

            bakeLight.light.enabled = true; // enable next light
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

                // render light shadow map needs to be rendered
                shadowMapRendered = this.renderShadowMap(shadowMapRendered, casters, lightArray, bakeLight);

                // Store original materials
                this.backupMaterials(rcv);

                for (pass = 0; pass < passCount; pass++) {

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

                    // set up material for baking a pass
                    for (j = 0; j < rcv.length; j++) {
                        rcv[j].material = this.passMaterials[pass];
                    }

                    // update shader
                    this.renderer.updateShaders(rcv);

                    // ping-ponging output
                    this.renderer.setCamera(this.camera, tempRT, true);

                    if (pass === PASS_DIR) {
                        this.constantBakeDir.setValue(bakeLight.light.bakeDir ? 1 : 0);
                    }

                    this.renderer._forwardTime = 0;
                    this.renderer._shadowMapTime = 0;

                    this.renderer.renderForward(this.camera, rcv, rcv.length, lightArray, SHADER_FORWARDHDR);

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
                }

                // Revert to original materials
                this.restoreMaterials(rcv);
            }

            // disable the light
            bakeLight.light.enabled = false;

            // release shadow map back to the cache
            if (bakeLight.light.shadowMap?.cached) {
                this.shadowMapCache.add(bakeLight.light, bakeLight.light.shadowMap);
                bakeLight.light.shadowMap = null;
            }
        }

        // destroy all cached shadowmaps
        this.shadowMapCache.clear();

        // postprocess lightmaps
        this.dilateTextures(device, bakeNodes, passCount);

        // Revert shadow casting
        for (node = 0; node < allNodes.length; node++) {
            allNodes[node].component.castShadows = allNodes[node].castShadows;
        }

        // restore changes
        this.restoreLights(allLights);
        this.restoreScene();
    }
}

export { Lightmapper };
