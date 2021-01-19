import { now } from '../core/time.js';
import { Color } from '../core/color.js';

import { math } from '../math/math.js';
import { Vec3 } from '../math/vec3.js';

import { BoundingBox } from '../shape/bounding-box.js';

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

import {
    BAKE_COLORDIR,
    FOG_NONE,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE,
    SHADER_FORWARDHDR,
    SHADERDEF_DIRLM, SHADERDEF_LM,
    SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME
} from '../scene/constants.js';
import { Camera } from '../scene/camera.js';
import { GraphNode } from '../scene/graph-node.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';

var maxSize = 2048;
var maskBaked = 2;
var maskLightmap = 4;

var sceneLightmaps = [];
var sceneLightmapsNode = [];
var lmCamera;
var tempVec = new Vec3();
var bounds = new BoundingBox();
var lightBounds = new BoundingBox();
var tempSphere = {};

var PASS_COLOR = 0;
var PASS_DIR = 1;

var passTexName = ["texture_lightMap", "texture_dirLightMap"];
var passMaterial = [];

function collectModels(node, nodes, nodesMeshInstances, allNodes) {
    if (!node.enabled) return;

    var i, meshInstances;

    // mesh instances from model component
    if (node.model && node.model.model && node.model.enabled) {
        if (allNodes) allNodes.push(node);
        if (node.model.lightmapped) {
            if (nodes) {
                meshInstances = node.model.model.meshInstances;
            }
        }
    }

    // mesh instances from render component
    if (node.render && node.render.enabled) {
        if (allNodes) allNodes.push(node);
        if (node.render.lightmapped) {
            if (nodes) {
                meshInstances = node.render.meshInstances;
            }
        }
    }

    if (meshInstances) {
        var hasUv1 = true;

        for (i = 0; i < meshInstances.length; i++) {
            if (!meshInstances[i].mesh.vertexBuffer.format.hasUv1) {
                hasUv1 = false;
                break;
            }
        }
        if (hasUv1) {

            var j;
            var isInstance;
            var notInstancedMeshInstances = [];
            for (i = 0; i < meshInstances.length; i++) {
                isInstance = false;
                for (j = 0; j < meshInstances.length; j++) {
                    if (i !== j) {
                        if (meshInstances[i].mesh === meshInstances[j].mesh) {
                            isInstance = true;
                        }
                    }
                }
                // collect each instance (object with shared VB) as separate "node"
                if (isInstance) {
                    nodes.push(node);
                    nodesMeshInstances.push([meshInstances[i]]);
                } else {
                    notInstancedMeshInstances.push(meshInstances[i]);
                }
            }

            // collect all non-shared objects as one "node"
            if (notInstancedMeshInstances.length > 0) {
                nodes.push(node);
                nodesMeshInstances.push(notInstancedMeshInstances);
            }
        }
    }

    for (i = 0; i < node._children.length; i++) {
        collectModels(node._children[i], nodes, nodesMeshInstances, allNodes);
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

        // #ifdef PROFILER
        this._stats = {
            renderPasses: 0,
            lightmapCount: 0,
            totalRenderTime: 0,
            forwardTime: 0,
            fboTime: 0,
            shadowMapTime: 0,
            compileTime: 0,
            shadersLinked: 0
        };
        // #endif
    }

    destroy() {
        this.device = null;
        this.root = null;
        this.scene = null;
        this.renderer = null;
        this.assets = null;
    }

    calculateLightmapSize(node) {
        var data, parent;
        var sizeMult = this.scene.lightmapSizeMultiplier || 16;
        var scale = tempVec;

        var srcArea, lightmapSizeMultiplier;

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
        var area = { x: 1, y: 1, z: 1, uv: 1 };
        if (srcArea) {
            area.x = srcArea.x;
            area.y = srcArea.y;
            area.z = srcArea.z;
            area.uv = srcArea.uv;
        }

        var areaMult = lightmapSizeMultiplier || 1;
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

        var totalArea = area.x * scale.y * scale.z +
                        area.y * scale.x * scale.z +
                        area.z * scale.x * scale.y;
        totalArea /= area.uv;
        totalArea = Math.sqrt(totalArea);

        return Math.min(math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || maxSize);
    }

    /**
     * @function
     * @name Lightmapper#bake
     * @description Generates and applies the lightmaps.
     * @param {Entity[]|null} nodes - An array of entities (with model components) to render
     * lightmaps for. If not supplied, the entire scene will be baked.
     * @param {number} [mode] - Baking mode. Can be:
     *
     * * {@link BAKE_COLOR}: single color lightmap
     * * {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump/specular)
     *
     * Only lights with bakeDir=true will be used for generating the dominant light direction. Defaults to
     * {@link BAKE_COLORDIR}.
     */
    bake(nodes, mode) {

        // #ifdef PROFILER
        var startTime = now();
        this.device.fire('lightmapper:start', {
            timestamp: startTime,
            target: this
        });
        var stats = this._stats;
        // #endif

        var i, j;
        var device = this.device;
        var scene = this.scene;

        var passCount = 1;
        if (mode === undefined) mode = BAKE_COLORDIR;
        if (mode === BAKE_COLORDIR) passCount = 2;
        var pass;

        // #ifdef PROFILER
        stats.renderPasses = stats.shadowMapTime = stats.forwardTime = 0;
        var startShaders = device._shaderStats.linked;
        var startFboTime = device._renderTargetCreationTime;
        var startCompileTime = device._shaderStats.compileTime;
        // #endif

        var allNodes = [];
        var nodesMeshInstances = [];
        if (!nodes) {
            // ///// Full bake /////

            // delete old lightmaps, if present
            for (i = 0; i < sceneLightmaps.length; i++) {
                for (j = 0; j < sceneLightmaps[i].length; j++) {
                    sceneLightmaps[i][j].destroy();
                }
            }
            sceneLightmaps = [];
            sceneLightmapsNode = [];

            // collect
            nodes = [];
            collectModels(this.root, nodes, nodesMeshInstances, allNodes);
        } else {
            // ///// Selected bake /////

            // delete old lightmaps, if present
            var k;
            for (i = sceneLightmapsNode.length - 1; i >= 0; i--) {
                for (j = 0; j < nodes.length; j++) {
                    if (sceneLightmapsNode[i] === nodes[j]) {
                        for (k = 0; k < sceneLightmaps[i].length; k++) {
                            sceneLightmaps[i][k].destroy();
                        }
                        sceneLightmaps.splice(i, 1);
                        sceneLightmapsNode.splice(i, 1);
                    }
                }
            }

            // collect
            var _nodes = [];
            for (i = 0; i < nodes.length; i++) {
                collectModels(nodes[i], _nodes, nodesMeshInstances);
            }
            nodes = _nodes;

            collectModels(this.root, null, null, allNodes);
        }

        if (nodes.length === 0) {
            device.fire('lightmapper:end', {
                timestamp: now(),
                target: this
            });

            return;
        }

        // #ifdef PROFILER
        stats.lightmapCount = nodes.length;
        // #endif

        // Disable static preprocessing (lightmapper needs original model draw calls)
        var revertStatic = false;
        if (scene._needsStaticPrepare) {
            scene._needsStaticPrepare = false;
            revertStatic = true;
        }

        // Calculate lightmap sizes and allocate textures
        var texSize = [];
        var lmaps = [[], []];
        var texPool = {};
        var size;
        var tex;
        var blackTex = new Texture(this.device, {
            width: 4,
            height: 4,
            format: PIXELFORMAT_R8_G8_B8_A8,
            type: TEXTURETYPE_RGBM
        });
        blackTex.name = 'lightmap';
        for (i = 0; i < nodes.length; i++) {
            size = this.calculateLightmapSize(nodes[i]);
            texSize.push(size);
            for (pass = 0; pass < passCount; pass++) {
                tex = new Texture(device, {
                    // #ifdef PROFILER
                    profilerHint: TEXHINT_LIGHTMAP,
                    // #endif
                    width: size,
                    height: size,
                    format: PIXELFORMAT_R8_G8_B8_A8,
                    mipmaps: false,
                    type: (pass === PASS_COLOR) ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT,
                    minFilter: FILTER_NEAREST,
                    magFilter: FILTER_NEAREST
                });
                tex.name = 'lightmap';

                lmaps[pass].push(tex);
            }

            if (!texPool[size]) {
                var tex2 = new Texture(device, {
                    // #ifdef PROFILER
                    profilerHint: TEXHINT_LIGHTMAP,
                    // #endif
                    width: size,
                    height: size,
                    format: PIXELFORMAT_R8_G8_B8_A8,
                    mipmaps: false,
                    type: TEXTURETYPE_RGBM,
                    minFilter: FILTER_NEAREST,
                    magFilter: FILTER_NEAREST
                });
                tex2.name = 'lightmap';

                var targ2 = new RenderTarget(device, tex2, {
                    depth: false
                });
                texPool[size] = targ2;
            }
        }

        var activeComp = scene.layers;
        activeComp._update();

        // Collect bakeable lights
        var lights = [];
        var origMask = [];
        var origShadowMode = [];
        var origEnabled = [];
        var sceneLights = activeComp._lights;
        var mask;
        for (i = 0; i < sceneLights.length; i++) {
            if (sceneLights[i].enabled) {
                mask = sceneLights[i].mask;
                if ((mask & maskLightmap) !== 0) {
                    origMask.push(mask);
                    origShadowMode.push(sceneLights[i].shadowUpdateMode);
                    sceneLights[i].mask = 0xFFFFFFFF;
                    sceneLights[i].shadowUpdateMode =
                        sceneLights[i]._type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
                    lights.push(sceneLights[i]);
                    sceneLights[i].isStatic = false; // if baked, can't be used as static
                }
            }
            origEnabled.push(sceneLights[i].enabled);
            sceneLights[i].enabled = false;
        }


        // Init shaders
        var xformUv1 = "#define UV1LAYOUT\n" + shaderChunks.transformVS;
        var bakeLmEnd = shaderChunks.bakeLmEndPS;
        var dilate = shaderChunks.dilatePS;

        var dilateShader = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, dilate, "lmDilate");
        var constantTexSource = device.scope.resolve("source");
        var constantPixelOffset = device.scope.resolve("pixelOffset");
        var constantBakeDir = device.scope.resolve("bakeDir");

        var pixelOffset = new Float32Array(2);

        var drawCalls = activeComp._meshInstances;

        // update scene matrices
        for (i = 0; i < drawCalls.length; i++) {
            if (drawCalls[i].node) drawCalls[i].node.getWorldTransform();
        }

        // Store scene values
        var origFog = scene.fog;
        var origAmbientR = scene.ambientLight.r;
        var origAmbientG = scene.ambientLight.g;
        var origAmbientB = scene.ambientLight.b;

        scene.fog = FOG_NONE;
        scene.ambientLight.set(0, 0, 0);

        // Create pseudo-camera
        if (!lmCamera) {
            lmCamera = new Camera();
            lmCamera.clearColor = new Color(0, 0, 0, 0);
            lmCamera.clearColorBuffer = true;
            lmCamera.clearDepthBuffer = false;
            lmCamera.clearStencilBuffer = false;
            lmCamera.frustumCulling = false;
            lmCamera.node = new GraphNode();
        }

        var node;
        var lm, rcv, m;

        var renderOrModel = function (node) {
            return node.render ? node.render : node.model;
        };

        var renderOrModelMeshInstances = function (node) {
            return node.render ? node.render.meshInstances : node.model.model.meshInstances;
        };

        // Disable existing scene lightmaps
        var origShaderDefs = [];
        origShaderDefs.length = sceneLightmapsNode.length;
        var shaderDefs;
        for (node = 0; node < allNodes.length; node++) {
            rcv = renderOrModelMeshInstances(allNodes[node]);
            shaderDefs = [];
            for (i = 0; i < rcv.length; i++) {
                shaderDefs.push(rcv[i]._shaderDefs);
                rcv[i]._shaderDefs &= ~(SHADERDEF_LM | SHADERDEF_DIRLM);
            }
            for (i = 0; i < sceneLightmapsNode.length; i++) {
                if (sceneLightmapsNode[i] === allNodes[node]) {
                    origShaderDefs[i] = shaderDefs;
                    break;
                }
            }
        }

        // Change shadow casting
        var origCastShadows = [];
        var casters = [];
        var meshes;
        var rom;
        for (node = 0; node < allNodes.length; node++) {
            rom = renderOrModel(allNodes[node]);
            origCastShadows[node] = rom.castShadows;
            rom.castShadows = rom.castShadowsLightmap;
            if (rom.castShadowsLightmap) {
                meshes = renderOrModelMeshInstances(allNodes[node]);
                for (i = 0; i < meshes.length; i++) {
                    meshes[i].visibleThisFrame = true;
                    casters.push(meshes[i]);
                }
            }
        }

        this.renderer.updateCpuSkinMatrices(casters);
        this.renderer.gpuUpdate(casters);

        var origMat = [];

        // Prepare models
        var nodeBounds = [];
        var nodeTarg = [[], []];
        var targ, targTmp, texTmp;
        var light, shadowCam;
        var nodeLightCount = [];
        nodeLightCount.length = nodes.length;

        var lmMaterial;
        for (pass = 0; pass < passCount; pass++) {
            if (!passMaterial[pass]) {
                lmMaterial = new StandardMaterial();
                lmMaterial.chunks.transformVS = xformUv1; // draw UV1

                if (pass === PASS_COLOR) {
                    lmMaterial.chunks.endPS = bakeLmEnd; // encode to RGBM
                    // don't bake ambient
                    lmMaterial.ambient = new Color(0, 0, 0);
                    lmMaterial.ambientTint = true;
                    lmMaterial.lightMap = blackTex;
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

                passMaterial[pass] = lmMaterial;
            }
        }

        for (node = 0; node < nodes.length; node++) {
            rcv = nodesMeshInstances[node];
            nodeLightCount[node] = 0;

            // Calculate model AABB
            if (rcv.length > 0) {
                bounds.copy(rcv[0].aabb);
                for (i = 0; i < rcv.length; i++) {
                    rcv[i].node.getWorldTransform();
                    bounds.add(rcv[i].aabb);
                }
            }
            var nbounds = new BoundingBox();
            nbounds.copy(bounds);
            nodeBounds.push(nbounds);

            for (i = 0; i < rcv.length; i++) {
                // patch meshInstance
                m = rcv[i];
                m._shaderDefs &= ~(SHADERDEF_LM | SHADERDEF_DIRLM); // disable LM define, if set, to get bare ambient on first pass
                m.mask = maskLightmap; // only affected by LM lights
                m.deleteParameter("texture_lightMap");
                m.deleteParameter("texture_dirLightMap");

                // patch material
                m.setParameter("texture_lightMap", m.material.lightMap ? m.material.lightMap : blackTex);
                m.setParameter("texture_dirLightMap", blackTex);
            }

            for (pass = 0; pass < passCount; pass++) {
                lm = lmaps[pass][node];
                targ = new RenderTarget(device, lm, {
                    depth: false
                });
                nodeTarg[pass].push(targ);
            }
        }

        // Disable all bakeable lights
        for (j = 0; j < lights.length; j++)
            lights[j].enabled = false;

        var lightArray = [[], [], []];

        // Accumulate lights into RGBM textures
        var shadersUpdatedOn1stPass = false;
        var shadowMapRendered;
        for (i = 0; i < lights.length; i++) {

            lights[i].enabled = true; // enable next light
            shadowMapRendered = false;

            lights[i]._cacheShadowMap = true;
            if (lights[i]._type !== LIGHTTYPE_DIRECTIONAL) {
                lights[i]._node.getWorldTransform();
                lights[i].getBoundingSphere(tempSphere);
                lightBounds.center = tempSphere.center;
                lightBounds.halfExtents.x = tempSphere.radius;
                lightBounds.halfExtents.y = tempSphere.radius;
                lightBounds.halfExtents.z = tempSphere.radius;
            }
            if (lights[i]._type === LIGHTTYPE_SPOT) {
                light = lights[i];
                shadowCam = this.renderer.getShadowCamera(device, light);

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

            if (nodesMeshInstances.length > 0) {
                this.renderer.updateShaders(nodesMeshInstances[0]);
            }

            for (node = 0; node < nodes.length; node++) {

                rcv = nodesMeshInstances[node];
                bounds = nodeBounds[node];

                // Tweak camera to fully see the model, so directional light frustum will also see it
                if (lights[i]._type === LIGHTTYPE_DIRECTIONAL) {
                    tempVec.copy(bounds.center);
                    tempVec.y += bounds.halfExtents.y;

                    lmCamera.node.setPosition(tempVec);
                    lmCamera.node.setEulerAngles(-90, 0, 0);

                    var frustumSize = Math.max(bounds.halfExtents.x, bounds.halfExtents.z);

                    lmCamera.projection = PROJECTION_ORTHOGRAPHIC;
                    lmCamera.nearClip = 0;
                    lmCamera.farClip = bounds.halfExtents.y * 2;
                    lmCamera.aspectRatio = 1;
                    lmCamera.orthoHeight = frustumSize;
                } else {
                    if (!lightBounds.intersects(bounds)) {
                        continue;
                    }
                }

                if (lights[i]._type === LIGHTTYPE_SPOT) {
                    var nodeVisible = false;
                    for (j = 0; j < rcv.length; j++) {
                        if (rcv[j]._isVisible(shadowCam)) {
                            nodeVisible = true;
                            break;
                        }
                    }
                    if (!nodeVisible) {
                        continue;
                    }
                }

                if (lights[i]._type === LIGHTTYPE_DIRECTIONAL) {
                    lightArray[LIGHTTYPE_DIRECTIONAL][0] = lights[i];
                    lightArray[LIGHTTYPE_OMNI].length = 0;
                    lightArray[LIGHTTYPE_SPOT].length = 0;
                    if (!shadowMapRendered && lights[i].castShadows) {
                        this.renderer.cullDirectionalShadowmap(lights[i], casters, lmCamera, 0);
                        this.renderer.renderShadows(lightArray[LIGHTTYPE_DIRECTIONAL], 0);
                        shadowMapRendered = true;
                    }
                } else {
                    lightArray[LIGHTTYPE_DIRECTIONAL].length = 0;
                    if (lights[i]._type === LIGHTTYPE_OMNI) {
                        lightArray[LIGHTTYPE_OMNI][0] = lights[i];
                        lightArray[LIGHTTYPE_SPOT].length = 0;
                        if (!shadowMapRendered && lights[i].castShadows) {
                            this.renderer.cullLocalShadowmap(lights[i], casters);
                            this.renderer.renderShadows(lightArray[LIGHTTYPE_OMNI]);
                            shadowMapRendered = true;
                        }
                    } else {
                        lightArray[LIGHTTYPE_OMNI].length = 0;
                        lightArray[LIGHTTYPE_SPOT][0] = lights[i];
                        if (!shadowMapRendered && lights[i].castShadows) {
                            this.renderer.cullLocalShadowmap(lights[i], casters);
                            this.renderer.renderShadows(lightArray[LIGHTTYPE_SPOT]);
                            shadowMapRendered = true;
                        }
                    }
                }

                // Store original materials
                for (j = 0; j < rcv.length; j++) {
                    origMat[j] = rcv[j].material;
                }

                for (pass = 0; pass < passCount; pass++) {
                    lm = lmaps[pass][node];
                    targ = nodeTarg[pass][node];
                    targTmp = texPool[lm.width];
                    texTmp = targTmp.colorBuffer;

                    if (pass === 0) {
                        shadersUpdatedOn1stPass = scene.updateShaders;
                    } else if (shadersUpdatedOn1stPass) {
                        scene.updateShaders = true;
                    }

                    for (j = 0; j < rcv.length; j++) {
                        rcv[j].material = passMaterial[pass];
                    }
                    if (passCount > 1) {
                        this.renderer.updateShaders(rcv); // update between passes
                    }

                    // ping-ponging output
                    this.renderer.setCamera(lmCamera, targTmp, true);

                    if (pass === PASS_DIR) {
                        constantBakeDir.setValue(lights[i].bakeDir ? 1 : 0);
                    }

                    // console.log("Baking light "+lights[i]._node.name + " on model " + nodes[node].name);

                    this.renderer._forwardTime = 0;
                    this.renderer._shadowMapTime = 0;

                    this.renderer.renderForward(lmCamera,
                                                rcv, rcv.length,
                                                lightArray,
                                                SHADER_FORWARDHDR);

                    // #ifdef PROFILER
                    stats.shadowMapTime += this.renderer._shadowMapTime;
                    stats.forwardTime += this.renderer._forwardTime;
                    stats.renderPasses++;
                    // #endif

                    lmaps[pass][node] = texTmp;
                    nodeTarg[pass][node] = targTmp;
                    texPool[lm.width] = targ;

                    for (j = 0; j < rcv.length; j++) {
                        m = rcv[j];
                        m.setParameter(passTexName[pass], texTmp); // ping-ponging input
                        m._shaderDefs |= SHADERDEF_LM; // force using LM even if material doesn't have it
                    }
                }

                nodeLightCount[node]++;

                // Revert original materials
                for (j = 0; j < rcv.length; j++) {
                    rcv[j].material = origMat[j];
                }
            }

            lights[i].enabled = false; // disable that light
            lights[i]._cacheShadowMap = false;
            if (lights[i]._isCachedShadowMap) {
                lights[i]._destroyShadowMap();
            }
        }


        var sceneLmaps;
        for (node = 0; node < nodes.length; node++) {
            rcv = nodesMeshInstances[node];
            sceneLmaps = [];

            for (pass = 0; pass < passCount; pass++) {
                lm = lmaps[pass][node];
                targ = nodeTarg[pass][node];
                targTmp = texPool[lm.width];
                texTmp = targTmp.colorBuffer;

                // Dilate
                var numDilates2x = 4; // 8 dilates
                pixelOffset[0] = 1 / lm.width;
                pixelOffset[1] = 1 / lm.height;
                constantPixelOffset.setValue(pixelOffset);
                for (i = 0; i < numDilates2x; i++) {
                    constantTexSource.setValue(lm);
                    drawQuadWithShader(device, targTmp, dilateShader);

                    constantTexSource.setValue(texTmp);
                    drawQuadWithShader(device, targ, dilateShader);
                }


                for (i = 0; i < rcv.length; i++) {
                    m = rcv[i];
                    m.mask = maskBaked;

                    // Set lightmap
                    rcv[i].setParameter(passTexName[pass], lm);
                    if (pass === PASS_DIR) rcv[i]._shaderDefs |= SHADERDEF_DIRLM;
                }
                sceneLmaps[pass] = lm;

                // Clean up
                if (pass === passCount - 1) targ.destroy();
            }

            sceneLightmaps.push(sceneLmaps);
            sceneLightmapsNode.push(nodes[node]);
        }

        for (var key in texPool) {
            if (texPool.hasOwnProperty(key)) {
                texPool[key].colorBuffer.destroy();
                texPool[key].destroy();
            }
        }

        // Set up linear filtering
        for (i = 0; i < sceneLightmaps.length; i++) {
            for (j = 0; j < sceneLightmaps[i].length; j++) {
                tex = sceneLightmaps[i][j];
                tex.minFilter = FILTER_LINEAR;
                tex.magFilter = FILTER_LINEAR;
            }
        }

        // Revert shadow casting
        for (node = 0; node < allNodes.length; node++) {
            renderOrModel(allNodes[node]).castShadows = origCastShadows[node];
        }

        // Enable existing scene lightmaps
        for (i = 0; i < origShaderDefs.length; i++) {
            if (origShaderDefs[i]) {
                rcv = renderOrModelMeshInstances(sceneLightmapsNode[i]);
                for (j = 0; j < rcv.length; j++) {
                    rcv[j]._shaderDefs |= origShaderDefs[i][j] & (SHADERDEF_LM | SHADERDEF_DIRLM);
                }
            }
        }

        // Enable all lights back
        for (i = 0; i < lights.length; i++) {
            lights[i].mask = origMask[i];
            lights[i].shadowUpdateMode = origShadowMode[i];
        }

        for (i = 0; i < sceneLights.length; i++) {
            sceneLights[i].enabled = origEnabled[i];
        }

        // Roll back scene stuff
        scene.fog = origFog;
        scene.ambientLight.set(origAmbientR, origAmbientG, origAmbientB);

        // Revert static preprocessing
        if (revertStatic) {
            scene._needsStaticPrepare = true;
        }

        // #ifdef PROFILER
        this.device.fire('lightmapper:end', {
            timestamp: now(),
            target: this
        });

        stats.totalRenderTime = now() - startTime;
        stats.shadersLinked = device._shaderStats.linked - startShaders;
        stats.compileTime = device._shaderStats.compileTime - startCompileTime;
        stats.fboTime = device._renderTargetCreationTime - startFboTime;
        // #endif
    }
}

export { Lightmapper };
