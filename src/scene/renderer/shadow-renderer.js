import { Vec3 } from '../../math/vec3.js';
import { Quat } from '../../math/quat.js';
import { Mat4 } from '../../math/mat4.js';
import { Color } from '../../math/color.js';

import { BoundingBox } from '../../shape/bounding-box.js';

import {
    BLUR_GAUSSIAN,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE,
    SHADER_SHADOW,
    SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM8, SHADOW_VSM32, SHADOW_COUNT,
    SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME,
    SORTKEY_DEPTH
} from '../constants.js';
import { Camera } from '../camera.js';
import { GraphNode } from '../graph-node.js';

import { drawQuadWithShader } from '../../graphics/simple-post-effect.js';
import { shaderChunks } from '../../graphics/program-lib/chunks/chunks.js';
import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { ShadowMap } from './shadow-map.js';
import { ShadowMapCache } from './shadow-map-cache.js';

const pointLightRotations = [
    new Quat().setFromEulerAngles(0, 90, 180),
    new Quat().setFromEulerAngles(0, -90, 180),
    new Quat().setFromEulerAngles(90, 0, 0),
    new Quat().setFromEulerAngles(-90, 0, 0),
    new Quat().setFromEulerAngles(0, 180, 180),
    new Quat().setFromEulerAngles(0, 0, 180)
];

const _sceneAABB_LS = [
    new Vec3(), new Vec3(), new Vec3(), new Vec3(),
    new Vec3(), new Vec3(), new Vec3(), new Vec3()
];

function _getZFromAABBSimple(w2sc, aabbMin, aabbMax, lcamMinX, lcamMaxX, lcamMinY, lcamMaxY) {
    _sceneAABB_LS[0].x = _sceneAABB_LS[1].x = _sceneAABB_LS[2].x = _sceneAABB_LS[3].x = aabbMin.x;
    _sceneAABB_LS[1].y = _sceneAABB_LS[3].y = _sceneAABB_LS[7].y = _sceneAABB_LS[5].y = aabbMin.y;
    _sceneAABB_LS[2].z = _sceneAABB_LS[3].z = _sceneAABB_LS[6].z = _sceneAABB_LS[7].z = aabbMin.z;
    _sceneAABB_LS[4].x = _sceneAABB_LS[5].x = _sceneAABB_LS[6].x = _sceneAABB_LS[7].x = aabbMax.x;
    _sceneAABB_LS[0].y = _sceneAABB_LS[2].y = _sceneAABB_LS[4].y = _sceneAABB_LS[6].y = aabbMax.y;
    _sceneAABB_LS[0].z = _sceneAABB_LS[1].z = _sceneAABB_LS[4].z = _sceneAABB_LS[5].z = aabbMax.z;

    let minz = 9999999999;
    let maxz = -9999999999;

    for (let i = 0; i < 8; ++i) {
        w2sc.transformPoint(_sceneAABB_LS[i], _sceneAABB_LS[i]);
        const z = _sceneAABB_LS[i].z;
        if (z < minz) minz = z;
        if (z > maxz) maxz = z;
    }

    return { min: minz, max: maxz };
}

// The 8 points of the camera frustum transformed to light space
const frustumPoints = [];
for (let fp = 0; fp < 8; fp++) {
    frustumPoints.push(new Vec3());
}

function _getFrustumPoints(camera, farClip, points) {
    const nearClip = camera._nearClip;
    const fov = camera._fov * Math.PI / 180.0;
    const aspect = camera._aspectRatio;
    const projection = camera._projection;

    let x, y;
    if (projection === PROJECTION_PERSPECTIVE) {
        y = Math.tan(fov / 2.0) * nearClip;
    } else {
        y = camera._orthoHeight;
    }
    x = y * aspect;

    points[0].x = x;
    points[0].y = -y;
    points[0].z = -nearClip;
    points[1].x = x;
    points[1].y = y;
    points[1].z = -nearClip;
    points[2].x = -x;
    points[2].y = y;
    points[2].z = -nearClip;
    points[3].x = -x;
    points[3].y = -y;
    points[3].z = -nearClip;

    if (projection === PROJECTION_PERSPECTIVE) {
        y = Math.tan(fov / 2.0) * farClip;
        x = y * aspect;
    }
    points[4].x = x;
    points[4].y = -y;
    points[4].z = -farClip;
    points[5].x = x;
    points[5].y = y;
    points[5].z = -farClip;
    points[6].x = -x;
    points[6].y = y;
    points[6].z = -farClip;
    points[7].x = -x;
    points[7].y = -y;
    points[7].z = -farClip;

    return points;
}

function gauss(x, sigma) {
    return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}

const maxBlurSize = 25;
function gaussWeights(kernelSize) {
    if (kernelSize > maxBlurSize) kernelSize = maxBlurSize;
    const sigma = (kernelSize - 1) / (2 * 3);

    const halfWidth = (kernelSize - 1) * 0.5;
    const values = new Array(kernelSize);
    let sum = 0.0;
    for (let i = 0; i < kernelSize; ++i) {
        values[i] = gauss(i - halfWidth, sigma);
        sum += values[i];
    }

    for (let i = 0; i < kernelSize; ++i) {
        values[i] /= sum;
    }
    return values;
}

const frustumDiagonal = new Vec3();
const visibleSceneAabb = new BoundingBox();
const c2sc = new Mat4();
const directionalShadowEpsilon = 0.01;
const shadowCamView = new Mat4();
const shadowCamViewProj = new Mat4();
const pixelOffset = new Float32Array(2);
const blurScissorRect = { x: 1, y: 1, z: 0, w: 0 };
const opChanId = { r: 1, g: 2, b: 3, a: 4 };

function getDepthKey(meshInstance) {
    const material = meshInstance.material;
    const x = meshInstance.skinInstance ? 10 : 0;
    let y = 0;
    if (material.opacityMap) {
        const opChan = material.opacityMapChannel;
        if (opChan) {
            y = opChanId[opChan];
        }
    }
    return x + y;
}

class ShadowRenderer {
    constructor(forwardRenderer) {
        this.device = forwardRenderer.device;
        this.forwardRenderer = forwardRenderer;
        const scope = this.device.scope;

        // VSM
        this.sourceId = scope.resolve("source");
        this.pixelOffsetId = scope.resolve("pixelOffset");
        this.weightId = scope.resolve("weight[0]");
        this.blurVsmShaderCode = [shaderChunks.blurVSMPS, "#define GAUSS\n" + shaderChunks.blurVSMPS];
        const packed = "#define PACKED\n";
        this.blurPackedVsmShaderCode = [packed + this.blurVsmShaderCode[0], packed + this.blurVsmShaderCode[1]];

        // cache for vsm blur shaders
        this.blurVsmShader = [{}, {}];
        this.blurPackedVsmShader = [{}, {}];

        this.blurVsmWeights = {};

        // uniforms
        this.shadowMapLightRadiusId = scope.resolve('light_radius');

        // shadow map cache
        this.shadowMapCache = new ShadowMapCache();
    }

    destroy() {
        this.shadowMapCache.destroy();
        this.shadowMapCache = null;
    }

    static scaleShiftMatrix = new Mat4().mul2(
        new Mat4().setTranslate(0.5, 0.5, 0.5),
        new Mat4().setScale(0.5, 0.5, 0.5)
    );

    static spotCookieCamera = null;

    static getSpotCookieCamera() {
        if (!this.spotCookieCamera) {
            this.spotCookieCamera = new Camera();
            this.spotCookieCamera.projection = PROJECTION_PERSPECTIVE;
            this.spotCookieCamera.aspectRatio = 1;
            this.spotCookieCamera.node = new GraphNode();
        }

        return this.spotCookieCamera;
    }

    static createShadowCamera(device, shadowType, type) {
        // We don't need to clear the color buffer if we're rendering a depth map
        let hwPcf = shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF3 && device.webgl2);
        if (type === LIGHTTYPE_OMNI) {
            hwPcf = false;
        }

        const shadowCam = new Camera();

        if (shadowType >= SHADOW_VSM8 && shadowType <= SHADOW_VSM32) {
            shadowCam.clearColor = new Color(0, 0, 0, 0);
        } else {
            shadowCam.clearColor = new Color(1, 1, 1, 1);
        }

        shadowCam.clearColorBuffer = !hwPcf;
        shadowCam.clearDepthBuffer = true;
        shadowCam.clearStencilBuffer = false;

        shadowCam.node = new GraphNode();

        return shadowCam;
    }

    cullLocal(light, drawCalls) {
        const type = light._type;
        if (type === LIGHTTYPE_DIRECTIONAL) {
            return;
        }

        // force light visibility if function was manually called
        light.visibleThisFrame = true;

        const shadowCam = this.forwardRenderer.getShadowCamera(this.device, light);
        shadowCam.projection = PROJECTION_PERSPECTIVE;
        shadowCam.nearClip = light.attenuationEnd / 1000;
        shadowCam.farClip = light.attenuationEnd;
        shadowCam.aspectRatio = 1;

        if (!light._shadowMap) {
            light._shadowMap = ShadowMap.create(this.device, light);
        }

        let passes;
        if (type === LIGHTTYPE_SPOT) {
            shadowCam.fov = light._outerConeAngle * 2;
            passes = 1;
        } else {
            shadowCam.fov = 90;
            passes = 6;
        }
        const shadowCamNode = shadowCam._node;
        const lightNode = light._node;
        shadowCamNode.setPosition(lightNode.getPosition());
        if (type === LIGHTTYPE_SPOT) {
            shadowCamNode.setRotation(lightNode.getRotation());
            shadowCamNode.rotateLocal(-90, 0, 0); // Camera's look down negative Z, and directional lights point down negative Y // TODO: remove eulers
        }

        for (let pass = 0; pass < passes; pass++) {
            if (type === LIGHTTYPE_OMNI) {
                shadowCamNode.setRotation(pointLightRotations[pass]);
            }

            // assign render target for the pass
            shadowCam.renderTarget = light._shadowMap.renderTargets[pass];

            this.forwardRenderer.updateCameraFrustum(shadowCam);

            // render data are shared between cameras for local lights, so pass null for camera
            const lightRenderData = light.getRenderData(null, pass);
            const visibleCasters = lightRenderData.visibleCasters;
            let count = 0;

            const numInstances = drawCalls.length;
            for (let i = 0; i < numInstances; i++) {
                const meshInstance = drawCalls[i];
                let visible = true;
                if (meshInstance.cull) {
                    visible = meshInstance._isVisible(shadowCam);
                }
                if (visible) {
                    meshInstance.visibleThisFrame = true;
                    visibleCasters[count] = meshInstance;
                    count++;
                }
            }

            visibleCasters.length = count;

            // TODO: we should probably sort shadow meshes by shader and not depth
            visibleCasters.sort(this.forwardRenderer.depthSortCompare); // sort shadowmap drawcalls here, not in render
        }
    }

    cullDirectional(light, drawCalls, camera) {

        // force light visibility if function was manually called
        light.visibleThisFrame = true;

        const shadowCam = this.forwardRenderer.getShadowCamera(this.device, light);
        const shadowCamNode = shadowCam._node;
        const lightNode = light._node;

        if (!light._shadowMap) {
            light._shadowMap = ShadowMap.create(this.device, light);
            shadowCam.renderTarget = light._shadowMap.renderTargets[0];
        }

        shadowCamNode.setPosition(lightNode.getPosition());
        shadowCamNode.setRotation(lightNode.getRotation());
        shadowCamNode.rotateLocal(-90, 0, 0); // Camera's look down negative Z, and directional lights point down negative Y

        for (let cascade = 0; cascade < light.numCascades; cascade++) {
            // Positioning directional light frustum I
            // Construct light's orthographic frustum around camera frustum
            // Use very large near/far planes this time

            // 1. Get the frustum of the camera
            _getFrustumPoints(camera, light.shadowDistance || camera._farClip, frustumPoints);

            // 2. Figure out the maximum diagonal of the frustum in light's projected space.
            let frustumSize = frustumDiagonal.sub2(frustumPoints[0], frustumPoints[6]).length();
            frustumSize = Math.max(frustumSize, frustumDiagonal.sub2(frustumPoints[4], frustumPoints[6]).length());

            // 3. Transform the 8 corners of the camera frustum into the shadow camera's view space
            shadowCamView.copy(shadowCamNode.getWorldTransform()).invert();
            c2sc.copy(shadowCamView).mul(camera._node.getWorldTransform());
            for (let i = 0; i < 8; i++) {
                c2sc.transformPoint(frustumPoints[i], frustumPoints[i]);
            }

            // 4. Come up with a bounding box (in light-space) by calculating the min
            // and max X, Y, and Z values from your 8 light-space frustum coordinates.
            let minx, miny, minz, maxx, maxy, maxz;
            minx = miny = minz = 1000000;
            maxx = maxy = maxz = -1000000;
            for (let i = 0; i < 8; i++) {
                const p = frustumPoints[i];
                if (p.x < minx) minx = p.x;
                if (p.x > maxx) maxx = p.x;
                if (p.y < miny) miny = p.y;
                if (p.y > maxy) maxy = p.y;
                if (p.z < minz) minz = p.z;
                if (p.z > maxz) maxz = p.z;
            }

            // 5. Enlarge the light's frustum so that the frustum will be the same size
            // no matter how the view frustum moves.
            // And also snap the frustum to align with shadow texel. ( Avoid shadow shimmering )
            const unitPerTexel = frustumSize / light._shadowResolution;
            let delta = (frustumSize - (maxx - minx)) * 0.5;
            minx = Math.floor((minx - delta) / unitPerTexel) * unitPerTexel;
            delta = (frustumSize - (maxy - miny)) * 0.5;
            miny = Math.floor((miny - delta) / unitPerTexel) * unitPerTexel;
            maxx = minx + frustumSize;
            maxy = miny + frustumSize;

            // 6. Use your min and max values to create an off-center orthographic projection.
            const centerx = (maxx + minx) * 0.5;
            const centery = (maxy + miny) * 0.5;
            shadowCamNode.translateLocal(centerx, centery, 100000);

            shadowCam.projection = PROJECTION_ORTHOGRAPHIC;
            shadowCam.nearClip = 0;
            shadowCam.farClip = 200000;
            shadowCam.aspectRatio = 1; // The light's frustum is a cuboid.
            shadowCam.orthoHeight = frustumSize * 0.5;

            this.forwardRenderer.updateCameraFrustum(shadowCam);

            // Cull shadow casters and find their AABB
            let emptyAabb = true;

            const lightRenderData = light.getRenderData(camera, cascade);
            const visibleCasters = lightRenderData.visibleCasters;
            let count = 0;

            const numInstances = drawCalls.length;
            for (let i = 0; i < numInstances; i++) {
                const meshInstance = drawCalls[i];
                let visible = true;
                if (meshInstance.cull) {
                    visible = meshInstance._isVisible(shadowCam);
                }
                if (visible) {
                    meshInstance.visibleThisFrame = true;
                    visibleCasters[count] = meshInstance;
                    count++;

                    // update bounds
                    const drawCallAabb = meshInstance.aabb;
                    if (emptyAabb) {
                        visibleSceneAabb.copy(drawCallAabb);
                        emptyAabb = false;
                    } else {
                        visibleSceneAabb.add(drawCallAabb);
                    }
                }
            }

            visibleCasters.length = count;

            // TODO: we should probably sort shadow meshes by shader and not depth
            visibleCasters.sort(this.forwardRenderer.depthSortCompare); // sort shadowmap drawcalls here, not in render

            // Positioning directional light frustum II
            // Fit clipping planes tightly around visible shadow casters

            // 1. Calculate minz/maxz based on casters' AABB
            const z = _getZFromAABBSimple(shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax(), minx, maxx, miny, maxy);

            // Always use the scene's aabb's Z value
            // Otherwise object between the light and the frustum won't cast shadow.
            maxz = z.max;
            if (z.min > minz) minz = z.min;

            // 2. Fix projection
            shadowCamNode.setPosition(lightNode.getPosition());
            shadowCamNode.translateLocal(centerx, centery, maxz + directionalShadowEpsilon);
            shadowCam.farClip = maxz - minz;

            // Save projection variables to use in rendering later
            lightRenderData.position.copy(shadowCamNode.getPosition());
            lightRenderData.orthoHeight = shadowCam.orthoHeight;
            lightRenderData.farClip = shadowCam.farClip;
        }
    }

    renderShadow(light, camera) {

        const device = this.device;
        const forwardRenderer = this.forwardRenderer;
        const passFlag = 1 << SHADER_SHADOW;

        const type = light._type;

        if (!light.castShadows || !light.enabled) {
            return;
        }

        if (light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame) {
            const shadowCam = forwardRenderer.getShadowCamera(device, light);

            const shadowCamNode = shadowCam._node;
            let passes = 1;

            if (type === LIGHTTYPE_DIRECTIONAL) {
                passes = light.numCascades;
            } else if (type === LIGHTTYPE_SPOT) {
                forwardRenderer.dispatchViewPos(shadowCamNode.getPosition());
                this.shadowMapLightRadiusId.setValue(light.attenuationEnd);

            } else if (type === LIGHTTYPE_OMNI) {
                forwardRenderer.dispatchViewPos(shadowCamNode.getPosition());
                this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
                passes = 6;
            }

            // #if _DEBUG
            this.device.pushMarker("SHADOW " + light._node.name);
            // #endif

            if (device.webgl2) {
                if (type === LIGHTTYPE_OMNI) {
                    device.setDepthBias(false);
                } else {
                    device.setDepthBias(true);
                    device.setDepthBiasValues(light.shadowBias * -1000.0, light.shadowBias * -1000.0);
                }
            } else if (device.extStandardDerivatives) {
                if (type === LIGHTTYPE_OMNI) {
                    forwardRenderer.polygonOffset[0] = 0;
                    forwardRenderer.polygonOffset[1] = 0;
                    forwardRenderer.polygonOffsetId.setValue(forwardRenderer.polygonOffset);
                } else {
                    forwardRenderer.polygonOffset[0] = light.shadowBias * -1000.0;
                    forwardRenderer.polygonOffset[1] = light.shadowBias * -1000.0;
                    forwardRenderer.polygonOffsetId.setValue(forwardRenderer.polygonOffset);
                }
            }

            if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
                light.shadowUpdateMode = SHADOWUPDATE_NONE;
            }

            forwardRenderer._shadowMapUpdates += passes;

            // Set standard shadowmap states
            device.setBlending(false);
            device.setDepthWrite(true);
            device.setDepthTest(true);
            if (light._isPcf && device.webgl2 && type !== LIGHTTYPE_OMNI) {
                device.setColorWrite(false, false, false, false);
            } else {
                device.setColorWrite(true, true, true, true);
            }

            let pass = 0;
            while (pass < passes) {

                // #if _DEBUG
                let doPopMarker = false;
                if (passes > 1) {
                    this.device.pushMarker("PASS " + pass);
                    doPopMarker = true;
                }
                // #endif

                // assign render target for the pass
                shadowCam.renderTarget = light._shadowMap.renderTargets[pass];

                // directional shadows are per camera, so get appropriate render data
                const lightRenderData = light.getRenderData(type === LIGHTTYPE_DIRECTIONAL ? camera : null, pass);
                const visibleCasters = lightRenderData.visibleCasters;
                const visibleLength = visibleCasters.length;

                if (type === LIGHTTYPE_OMNI) {
                    shadowCamNode.setRotation(pointLightRotations[pass]);
                } else if (type === LIGHTTYPE_DIRECTIONAL) {
                    shadowCamNode.setPosition(lightRenderData.position);
                    shadowCam.orthoHeight = lightRenderData.orthoHeight;
                    shadowCam.farClip = lightRenderData.farClip;

                    // cascade viewport
                    const rect = light.cascades[pass];
                    shadowCam.rect = rect;
                    shadowCam.scissorRect = rect;
                }

                if (type !== LIGHTTYPE_OMNI) {
                    shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
                    shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);
                    light._shadowMatrix.mul2(ShadowRenderer.scaleShiftMatrix, shadowCamViewProj);
                }

                forwardRenderer.setCamera(shadowCam, shadowCam.renderTarget, true, passes === 1);

                // Sort shadow casters
                const shadowType = light._shadowType;
                const smode = shadowType + type * SHADOW_COUNT;

                // Render
                for (let j = 0; j < visibleLength; j++) {
                    const meshInstance = visibleCasters[j];
                    const mesh = meshInstance.mesh;
                    const material = meshInstance.material;

                    // set basic material states/parameters
                    forwardRenderer.setBaseConstants(device, material);
                    forwardRenderer.setSkinning(device, meshInstance, material);

                    if (material.dirty) {
                        material.updateUniforms();
                        material.dirty = false;
                    }

                    if (material.chunks) {

                        forwardRenderer.setCullMode(true, false, meshInstance);

                        // Uniforms I (shadow): material
                        material.setParameters(device);

                        // Uniforms II (shadow): meshInstance overrides
                        meshInstance.setParameters(device, passFlag);
                    }

                    // set shader
                    let shadowShader = meshInstance._shader[SHADER_SHADOW + smode];
                    if (!shadowShader) {
                        forwardRenderer.updateShader(meshInstance, meshInstance._shaderDefs, null, SHADER_SHADOW + smode);
                        shadowShader = meshInstance._shader[SHADER_SHADOW + smode];
                        meshInstance._key[SORTKEY_DEPTH] = getDepthKey(meshInstance);
                    }
                    device.setShader(shadowShader);

                    // set buffers
                    forwardRenderer.setVertexBuffers(device, mesh);
                    forwardRenderer.setMorphing(device, meshInstance.morphInstance);

                    const style = meshInstance.renderStyle;
                    device.setIndexBuffer(mesh.indexBuffer[style]);

                    // draw
                    j += forwardRenderer.drawInstance(device, meshInstance, mesh, style);
                    forwardRenderer._shadowDrawCalls++;
                }
                pass++;

                // #if _DEBUG
                if (doPopMarker)
                    this.device.popMarker();
                // #endif

            } // end pass

            if (light._isVsm) {

                // #if _DEBUG
                this.device.pushMarker("VSM");
                // #endif

                const filterSize = light._vsmBlurSize;
                if (filterSize > 1) {
                    const origShadowMap = shadowCam.renderTarget;

                    // temporary render target for blurring
                    const tempShadowMap = this.shadowMapCache.get(device, light);
                    const tempRt = tempShadowMap.renderTargets[0];

                    const isVsm8 = light._shadowType === SHADOW_VSM8;
                    const blurMode = light.vsmBlurMode;
                    let blurShader = (isVsm8 ? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize];
                    if (!blurShader) {
                        this.blurVsmWeights[filterSize] = gaussWeights(filterSize);

                        const blurVS = shaderChunks.fullscreenQuadVS;
                        let blurFS = "#define SAMPLES " + filterSize + "\n";
                        if (isVsm8) {
                            blurFS += this.blurPackedVsmShaderCode[blurMode];
                        } else {
                            blurFS += this.blurVsmShaderCode[blurMode];
                        }
                        const blurShaderName = "blurVsm" + blurMode + "" + filterSize + "" + isVsm8;
                        blurShader = createShaderFromCode(this.device, blurVS, blurFS, blurShaderName);

                        if (isVsm8) {
                            this.blurPackedVsmShader[blurMode][filterSize] = blurShader;
                        } else {
                            this.blurVsmShader[blurMode][filterSize] = blurShader;
                        }
                    }

                    blurScissorRect.z = light._shadowResolution - 2;
                    blurScissorRect.w = blurScissorRect.z;

                    // Blur horizontal
                    this.sourceId.setValue(origShadowMap.colorBuffer);
                    pixelOffset[0] = 1 / light._shadowResolution;
                    pixelOffset[1] = 0;
                    this.pixelOffsetId.setValue(pixelOffset);
                    if (blurMode === BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
                    drawQuadWithShader(device, tempRt, blurShader, null, blurScissorRect);

                    // Blur vertical
                    this.sourceId.setValue(tempRt.colorBuffer);
                    pixelOffset[1] = pixelOffset[0];
                    pixelOffset[0] = 0;
                    this.pixelOffsetId.setValue(pixelOffset);
                    drawQuadWithShader(device, origShadowMap, blurShader, null, blurScissorRect);

                    // return back temporary shadow map
                    this.shadowMapCache.add(light, tempShadowMap);
                }

                // #if _DEBUG
                this.device.popMarker();
                // #endif
            }

            // #if _DEBUG
            this.device.popMarker();
            // #endif
        }

    }
}

export { ShadowRenderer };
