import { now } from  '../core/time.js';

import { math } from '../math/math.js';
import { Color } from '../math/color.js';
import { Mat3 } from '../math/mat3.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

import { BoundingBox } from '../shape/bounding-box.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    BUFFER_DYNAMIC,
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE,
    FILTER_LINEAR, FILTER_NEAREST,
    FUNC_ALWAYS, FUNC_LESS, FUNC_LESSEQUAL,
    PIXELFORMAT_DEPTH, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_ATTR, SEMANTIC_POSITION,
    STENCILOP_KEEP,
    TEXHINT_SHADOWMAP,
    TEXTURETYPE_DEFAULT
} from '../graphics/constants.js';
import { createShaderFromCode } from '../graphics/program-lib/utils.js';
import { drawQuadWithShader } from '../graphics/simple-post-effect.js';
import { shaderChunks } from '../graphics/program-lib/chunks/chunks.js';
import { IndexBuffer } from '../graphics/index-buffer.js';
import { RenderTarget } from '../graphics/render-target.js';
import { Texture } from '../graphics/texture.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';

import {
    BLUR_GAUSSIAN,
    COMPUPDATED_INSTANCES, COMPUPDATED_LIGHTS,
    FOG_NONE, FOG_LINEAR,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    LIGHTSHAPE_PUNCTUAL,
    MASK_BAKED, MASK_DYNAMIC, MASK_LIGHTMAP,
    PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE,
    SHADER_SHADOW,
    SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM8, SHADOW_VSM16, SHADOW_VSM32,
    SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME,
    SORTKEY_DEPTH, SORTKEY_FORWARD,
    VIEW_CENTER, VIEW_LEFT, VIEW_RIGHT
} from './constants.js';
import { Camera } from './camera.js';
import { GraphNode } from './graph-node.js';
import { Material } from './materials/material.js';
import { Mesh } from './mesh.js';
import { MeshInstance } from './mesh-instance.js';
import { VisibleInstanceList } from './layer.js';

// Global shadowmap resources
var scaleShift = new Mat4().mul2(
    new Mat4().setTranslate(0.5, 0.5, 0.5),
    new Mat4().setScale(0.5, 0.5, 0.5)
);

var opChanId = { r: 1, g: 2, b: 3, a: 4 };

var pointLightRotations = [
    new Quat().setFromEulerAngles(0, 90, 180),
    new Quat().setFromEulerAngles(0, -90, 180),
    new Quat().setFromEulerAngles(90, 0, 0),
    new Quat().setFromEulerAngles(-90, 0, 0),
    new Quat().setFromEulerAngles(0, 180, 180),
    new Quat().setFromEulerAngles(0, 0, 180)
];

var numShadowModes = 5;
var shadowMapCache = [{}, {}, {}, {}, {}]; // must be a size of numShadowModes

var directionalShadowEpsilon = 0.01;
var pixelOffset = new Float32Array(2);
var blurScissorRect = { x: 1, y: 1, z: 0, w: 0 };

var shadowCamView = new Mat4();
var shadowCamViewProj = new Mat4();
var c2sc = new Mat4();

var viewInvMat = new Mat4();
var viewMat = new Mat4();
var viewMat3 = new Mat3();
var viewProjMat = new Mat4();
var projMat;

var viewInvL = new Mat4();
var viewInvR = new Mat4();
var viewL = new Mat4();
var viewR = new Mat4();
var viewPosL = new Vec3();
var viewPosR = new Vec3();
var projL, projR;
var viewMat3L = new Mat3();
var viewMat3R = new Mat3();
var viewProjMatL = new Mat4();
var viewProjMatR = new Mat4();

var worldMatX = new Vec3();
var worldMatY = new Vec3();
var worldMatZ = new Vec3();

var frustumDiagonal = new Vec3();
var tempSphere = { center: null, radius: 0 };
var visibleSceneAabb = new BoundingBox();
var boneTextureSize = [0, 0, 0, 0];
var boneTexture, instancingData, modelMatrix, normalMatrix;

var shadowMapCubeCache = {};
var maxBlurSize = 25;

var keyA, keyB;

var _autoInstanceBuffer = null;
var skipRenderCamera = null;
var _skipRenderCounter = 0;
var skipRenderAfter = 0;

var _skinUpdateIndex = 0;

var _tempMaterialSet = new Set();


// The 8 points of the camera frustum transformed to light space
var frustumPoints = [];
for (var fp = 0; fp < 8; fp++) {
    frustumPoints.push(new Vec3());
}

function _getFrustumPoints(camera, farClip, points) {
    var nearClip = camera._nearClip;
    var fov = camera._fov * Math.PI / 180.0;
    var aspect = camera._aspectRatio;
    var projection = camera._projection;

    var x, y;
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

var _sceneAABB_LS = [
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

    var minz = 9999999999;
    var maxz = -9999999999;
    var z;

    for ( var i = 0; i < 8; ++i ) {
        w2sc.transformPoint( _sceneAABB_LS[i], _sceneAABB_LS[i] );
        z = _sceneAABB_LS[i].z;
        if (z < minz) minz = z;
        if (z > maxz) maxz = z;
    }

    return { min: minz, max: maxz };
}

// SHADOW MAPPING SUPPORT FUNCTIONS

function getShadowFormat(device, shadowType) {
    if (shadowType === SHADOW_VSM32) {
        return PIXELFORMAT_RGBA32F;
    } else if (shadowType === SHADOW_VSM16) {
        return PIXELFORMAT_RGBA16F;
    } else if (shadowType === SHADOW_PCF5) {
        return PIXELFORMAT_DEPTH;
    } else if (shadowType === SHADOW_PCF3 && device.webgl2) {
        return PIXELFORMAT_DEPTH;
    }
    return PIXELFORMAT_R8_G8_B8_A8;
}

function getShadowFiltering(device, shadowType) {
    if (shadowType === SHADOW_PCF3 && !device.webgl2) {
        return FILTER_NEAREST;
    } else if (shadowType === SHADOW_VSM32) {
        return device.extTextureFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
    } else if (shadowType === SHADOW_VSM16) {
        return device.extTextureHalfFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
    }
    return FILTER_LINEAR;
}

function createShadowMap(device, width, height, shadowType) {
    var format = getShadowFormat(device, shadowType);
    var filter = getShadowFiltering(device, shadowType);

    var shadowMap = new Texture(device, {
        // #ifdef PROFILER
        profilerHint: TEXHINT_SHADOWMAP,
        // #endif
        format: format,
        width: width,
        height: height,
        mipmaps: false,
        minFilter: filter,
        magFilter: filter,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
    shadowMap.name = 'shadowmap';

    if (shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF3 && device.webgl2)) {
        shadowMap.compareOnRead = true;
        shadowMap.compareFunc = FUNC_LESS;
        // depthbuffer only
        return new RenderTarget({
            depthBuffer: shadowMap
        });
    }

    // encoded rgba depth
    return new RenderTarget({
        colorBuffer: shadowMap,
        depth: true
    });
}

function createShadowCubeMap(device, size) {
    var cubemap = new Texture(device, {
        // #ifdef PROFILER
        profilerHint: TEXHINT_SHADOWMAP,
        // #endif
        format: PIXELFORMAT_R8_G8_B8_A8,
        width: size,
        height: size,
        cubemap: true,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
    cubemap.name = 'shadowcube';

    var targets = [];
    var target;
    for (var i = 0; i < 6; i++) {
        target = new RenderTarget({
            colorBuffer: cubemap,
            face: i,
            depth: true
        });
        targets.push(target);
    }
    return targets;
}

function gauss(x, sigma) {
    return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}

function gaussWeights(kernelSize) {
    if (kernelSize > maxBlurSize) kernelSize = maxBlurSize;
    var sigma = (kernelSize - 1) / (2 * 3);
    var i, values, sum, halfWidth;

    halfWidth = (kernelSize - 1) * 0.5;
    values = new Array(kernelSize);
    sum = 0.0;
    for (i = 0; i < kernelSize; ++i) {
        values[i] = gauss(i - halfWidth, sigma);
        sum += values[i];
    }

    for (i = 0; i < kernelSize; ++i) {
        values[i] /= sum;
    }
    return values;
}

function createShadowCamera(device, shadowType, type) {
    // We don't need to clear the color buffer if we're rendering a depth map
    var hwPcf = shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF3 && device.webgl2);
    if (type === LIGHTTYPE_OMNI) {
        hwPcf = false;
    }

    var shadowCam = new Camera();

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

function getShadowMapFromCache(device, res, mode, layer = 0) {
    var id = layer * 10000 + res;
    var shadowBuffer = shadowMapCache[mode][id];
    if (!shadowBuffer) {
        shadowBuffer = createShadowMap(device, res, res, mode ? mode : SHADOW_PCF3);
        shadowMapCache[mode][id] = shadowBuffer;
    }
    return shadowBuffer;
}

function createShadowBuffer(device, light) {
    var shadowBuffer;
    if (light._type === LIGHTTYPE_OMNI) {
        if (light._shadowType > SHADOW_PCF3) light._shadowType = SHADOW_PCF3; // no VSM or HW PCF omni lights yet
        if (light._cacheShadowMap) {
            shadowBuffer = shadowMapCubeCache[light._shadowResolution];
            if (!shadowBuffer) {
                shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
                shadowMapCubeCache[light._shadowResolution] = shadowBuffer;
            }
        } else {
            shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
        }
        light._shadowCamera.renderTarget = shadowBuffer[0];
        light._shadowCubeMap = shadowBuffer;

    } else {

        if (light._cacheShadowMap) {
            shadowBuffer = getShadowMapFromCache(device, light._shadowResolution, light._shadowType);
        } else {
            shadowBuffer = createShadowMap(device, light._shadowResolution, light._shadowResolution, light._shadowType);
        }

        light._shadowCamera.renderTarget = shadowBuffer;
    }
    light._isCachedShadowMap = light._cacheShadowMap;
}

function getDepthKey(meshInstance) {
    var material = meshInstance.material;
    var x = meshInstance.skinInstance ? 10 : 0;
    var y = 0;
    if (material.opacityMap) {
        var opChan = material.opacityMapChannel;
        if (opChan) {
            y = opChanId[opChan];
        }
    }
    return x + y;
}

/**
 * @class
 * @name ForwardRenderer
 * @classdesc The forward renderer render scene objects.
 * @description Creates a new forward renderer object.
 * @param {GraphicsDevice} graphicsDevice - The graphics device used by the renderer.
 */
class ForwardRenderer {
    constructor(graphicsDevice) {
        this.device = graphicsDevice;
        var device = this.device;

        this._shadowDrawCalls = 0;
        this._forwardDrawCalls = 0;
        this._skinDrawCalls = 0;
        this._camerasRendered = 0;
        this._materialSwitches = 0;
        this._shadowMapUpdates = 0;
        this._shadowMapTime = 0;
        this._depthMapTime = 0;
        this._forwardTime = 0;
        this._cullTime = 0;
        this._sortTime = 0;
        this._skinTime = 0;
        this._morphTime = 0;
        this._instancingTime = 0;
        this._layerCompositionUpdateTime = 0;

        // Shaders
        var library = device.getProgramLibrary();
        this.library = library;

        // Uniforms
        var scope = device.scope;
        this.projId = scope.resolve('matrix_projection');
        this.projSkyboxId = scope.resolve('matrix_projectionSkybox');
        this.viewId = scope.resolve('matrix_view');
        this.viewId3 = scope.resolve('matrix_view3');
        this.viewInvId = scope.resolve('matrix_viewInverse');
        this.viewProjId = scope.resolve('matrix_viewProjection');
        this.viewPos = new Float32Array(3);
        this.viewPosId = scope.resolve('view_position');
        this.nearClipId = scope.resolve('camera_near');
        this.farClipId = scope.resolve('camera_far');
        this.cameraParamsId = scope.resolve('camera_params');
        this.shadowMapLightRadiusId = scope.resolve('light_radius');

        this.fogColorId = scope.resolve('fog_color');
        this.fogStartId = scope.resolve('fog_start');
        this.fogEndId = scope.resolve('fog_end');
        this.fogDensityId = scope.resolve('fog_density');

        this.modelMatrixId = scope.resolve('matrix_model');
        this.normalMatrixId = scope.resolve('matrix_normal');
        this.poseMatrixId = scope.resolve('matrix_pose[0]');
        this.boneTextureId = scope.resolve('texture_poseMap');
        this.boneTextureSizeId = scope.resolve('texture_poseMapSize');

        this.morphWeightsA = scope.resolve('morph_weights_a');
        this.morphWeightsB = scope.resolve('morph_weights_b');
        this.morphPositionTex = scope.resolve('morphPositionTex');
        this.morphNormalTex = scope.resolve('morphNormalTex');
        this.morphTexParams = scope.resolve('morph_tex_params');

        this.alphaTestId = scope.resolve('alpha_ref');
        this.opacityMapId = scope.resolve('texture_opacityMap');

        this.ambientId = scope.resolve("light_globalAmbient");
        this.exposureId = scope.resolve("exposure");
        this.skyboxIntensityId = scope.resolve("skyboxIntensity");
        this.lightColorId = [];
        this.lightDir = [];
        this.lightDirId = [];
        this.lightShadowMapId = [];
        this.lightShadowMatrixId = [];
        this.lightShadowParamsId = [];
        this.lightShadowMatrixVsId = [];
        this.lightShadowParamsVsId = [];
        this.lightDirVs = [];
        this.lightDirVsId = [];
        this.lightRadiusId = [];
        this.lightPos = [];
        this.lightPosId = [];
        this.lightWidth = [];
        this.lightWidthId = [];
        this.lightHeight = [];
        this.lightHeightId = [];
        this.lightInAngleId = [];
        this.lightOutAngleId = [];
        this.lightPosVsId = [];
        this.lightCookieId = [];
        this.lightCookieIntId = [];
        this.lightCookieMatrixId = [];
        this.lightCookieOffsetId = [];

        this.depthMapId = scope.resolve('uDepthMap');
        this.screenSizeId = scope.resolve('uScreenSize');
        this._screenSize = new Float32Array(4);

        this.sourceId = scope.resolve("source");
        this.pixelOffsetId = scope.resolve("pixelOffset");
        this.weightId = scope.resolve("weight[0]");
        this.blurVsmShaderCode = [shaderChunks.blurVSMPS, "#define GAUSS\n" + shaderChunks.blurVSMPS];
        var packed = "#define PACKED\n";
        this.blurPackedVsmShaderCode = [packed + this.blurVsmShaderCode[0], packed + this.blurVsmShaderCode[1]];
        this.blurVsmShader = [{}, {}];
        this.blurPackedVsmShader = [{}, {}];
        this.blurVsmWeights = {};

        this.twoSidedLightingNegScaleFactorId = scope.resolve("twoSidedLightingNegScaleFactor");

        this.polygonOffsetId = scope.resolve("polygonOffset");
        this.polygonOffset = new Float32Array(2);

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);

        this.cameraParams = new Float32Array(4);

        // placeholder texture for area light LUTs
        this._createAreaLightPlaceholderLuts();
    }

    sortCompare(drawCallA, drawCallB) {
        if (drawCallA.layer === drawCallB.layer) {
            if (drawCallA.drawOrder && drawCallB.drawOrder) {
                return drawCallA.drawOrder - drawCallB.drawOrder;
            } else if (drawCallA.zdist && drawCallB.zdist) {
                return drawCallB.zdist - drawCallA.zdist; // back to front
            } else if (drawCallA.zdist2 && drawCallB.zdist2) {
                return drawCallA.zdist2 - drawCallB.zdist2; // front to back
            }
        }

        return drawCallB._key[SORTKEY_FORWARD] - drawCallA._key[SORTKEY_FORWARD];
    }

    sortCompareMesh(drawCallA, drawCallB) {
        if (drawCallA.layer === drawCallB.layer) {
            if (drawCallA.drawOrder && drawCallB.drawOrder) {
                return drawCallA.drawOrder - drawCallB.drawOrder;
            } else if (drawCallA.zdist && drawCallB.zdist) {
                return drawCallB.zdist - drawCallA.zdist; // back to front
            }
        }

        keyA = drawCallA._key[SORTKEY_FORWARD];
        keyB = drawCallB._key[SORTKEY_FORWARD];

        if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }

        return keyB - keyA;
    }

    depthSortCompare(drawCallA, drawCallB) {
        keyA = drawCallA._key[SORTKEY_DEPTH];
        keyB = drawCallB._key[SORTKEY_DEPTH];

        if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }

        return keyB - keyA;
    }

    lightCompare(lightA, lightB) {
        return lightA.key - lightB.key;
    }

    getShadowCamera(device, light) {
        var shadowCam = light._shadowCamera;

        if (shadowCam === null) {
            shadowCam = light._shadowCamera = createShadowCamera(device, light._shadowType, light._type);
            createShadowBuffer(device, light);
        } else {
            var shadowBuffer = shadowCam.renderTarget;
            if ((shadowBuffer.width !== light._shadowResolution) || (shadowBuffer.height !== light._shadowResolution)) {
                createShadowBuffer(device, light);
            }
        }

        return shadowCam;
    }

    updateCameraFrustum(camera) {
        if (camera.vrDisplay && camera.vrDisplay.presenting) {
            projMat = camera.vrDisplay.combinedProj;
            var parent = camera._node.parent;
            if (parent) {
                viewMat.copy(parent.getWorldTransform()).mul(camera.vrDisplay.combinedViewInv).invert();
            } else {
                viewMat.copy(camera.vrDisplay.combinedView);
            }
            viewInvMat.copy(viewMat).invert();
            this.viewInvId.setValue(viewInvMat.data);
            viewProjMat.mul2(projMat, viewMat);
            camera.frustum.setFromMat4(viewProjMat);
        } else if (camera.xr && camera.xr.views.length) {
            // calculate frustum based on XR view
            var view = camera.xr.views[0];
            viewProjMat.mul2(view.projMat, view.viewOffMat);
            camera.frustum.setFromMat4(viewProjMat);
            return;
        }

        projMat = camera.projectionMatrix;
        if (camera.calculateProjection) {
            camera.calculateProjection(projMat, VIEW_CENTER);
        }

        if (camera.calculateTransform) {
            camera.calculateTransform(viewInvMat, VIEW_CENTER);
        } else {
            var pos = camera._node.getPosition();
            var rot = camera._node.getRotation();
            viewInvMat.setTRS(pos, rot, Vec3.ONE);
            this.viewInvId.setValue(viewInvMat.data);
        }
        viewMat.copy(viewInvMat).invert();

        viewProjMat.mul2(projMat, viewMat);
        camera.frustum.setFromMat4(viewProjMat);
    }

    // make sure colorWrite is set to true to all channels, if you want to fully clear the target
    setCamera(camera, target, clear, cullBorder) {
        var vrDisplay = camera.vrDisplay;
        var parent, transform;

        if (vrDisplay && vrDisplay.presenting) {
            // Projection LR
            projL = vrDisplay.leftProj;
            projR = vrDisplay.rightProj;
            projMat = vrDisplay.combinedProj;
            if (camera.calculateProjection) {
                camera.calculateProjection(projL, VIEW_LEFT);
                camera.calculateProjection(projR, VIEW_RIGHT);
                camera.calculateProjection(projMat, VIEW_CENTER);
            }

            if (camera.calculateTransform) {
                camera.calculateTransform(viewInvL, VIEW_LEFT);
                camera.calculateTransform(viewInvR, VIEW_RIGHT);
                camera.calculateTransform(viewInvMat, VIEW_CENTER);
                viewL.copy(viewInvL).invert();
                viewR.copy(viewInvR).invert();
                viewMat.copy(viewInvMat).invert();
            } else {
                parent = camera._node.parent;
                if (parent) {
                    transform = parent.getWorldTransform();

                    // ViewInverse LR (parent)
                    viewInvL.mul2(transform, vrDisplay.leftViewInv);
                    viewInvR.mul2(transform, vrDisplay.rightViewInv);

                    // View LR (parent)
                    viewL.copy(viewInvL).invert();
                    viewR.copy(viewInvR).invert();

                    // Combined view (parent)
                    viewMat.copy(parent.getWorldTransform()).mul(vrDisplay.combinedViewInv).invert();
                } else {
                    // ViewInverse LR
                    viewInvL.copy(vrDisplay.leftViewInv);
                    viewInvR.copy(vrDisplay.rightViewInv);

                    // View LR
                    viewL.copy(vrDisplay.leftView);
                    viewR.copy(vrDisplay.rightView);

                    // Combined view
                    viewMat.copy(vrDisplay.combinedView);
                }
            }

            // View 3x3 LR
            viewMat3L.setFromMat4(viewL);
            viewMat3R.setFromMat4(viewR);

            // ViewProjection LR
            viewProjMatL.mul2(projL, viewL);
            viewProjMatR.mul2(projR, viewR);

            // View Position LR
            viewPosL.x = viewInvL.data[12];
            viewPosL.y = viewInvL.data[13];
            viewPosL.z = viewInvL.data[14];

            viewPosR.x = viewInvR.data[12];
            viewPosR.y = viewInvR.data[13];
            viewPosR.z = viewInvR.data[14];

            viewProjMat.mul2(projMat, viewMat);
            camera.frustum.setFromMat4(viewProjMat);
        } else if (camera.xr && camera.xr.session) {
            parent = camera._node.parent;
            if (parent) transform = parent.getWorldTransform();

            var views = camera.xr.views;

            for (var v = 0; v < views.length; v++) {
                var view = views[v];

                if (parent) {
                    view.viewInvOffMat.mul2(transform, view.viewInvMat);
                    view.viewOffMat.copy(view.viewInvOffMat).invert();
                } else {
                    view.viewInvOffMat.copy(view.viewInvMat);
                    view.viewOffMat.copy(view.viewMat);
                }

                view.viewMat3.setFromMat4(view.viewOffMat);
                view.projViewOffMat.mul2(view.projMat, view.viewOffMat);

                view.position[0] = view.viewInvOffMat.data[12];
                view.position[1] = view.viewInvOffMat.data[13];
                view.position[2] = view.viewInvOffMat.data[14];

                camera.frustum.setFromMat4(view.projViewOffMat);
            }
        } else {
            // Projection Matrix
            projMat = camera.projectionMatrix;
            if (camera.calculateProjection) {
                camera.calculateProjection(projMat, VIEW_CENTER);
            }
            this.projId.setValue(projMat.data);

            // Skybox Projection Matrix
            this.projSkyboxId.setValue(camera.getProjectionMatrixSkybox().data);

            // ViewInverse Matrix
            if (camera.calculateTransform) {
                camera.calculateTransform(viewInvMat, VIEW_CENTER);
            } else {
                var pos = camera._node.getPosition();
                var rot = camera._node.getRotation();
                viewInvMat.setTRS(pos, rot, Vec3.ONE);
            }
            this.viewInvId.setValue(viewInvMat.data);

            // View Matrix
            viewMat.copy(viewInvMat).invert();
            this.viewId.setValue(viewMat.data);

            // View 3x3
            viewMat3.setFromMat4(viewMat);
            this.viewId3.setValue(viewMat3.data);

            // ViewProjection Matrix
            viewProjMat.mul2(projMat, viewMat);
            this.viewProjId.setValue(viewProjMat.data);

            // View Position (world space)
            var cameraPos = camera._node.getPosition();
            this.viewPos[0] = cameraPos.x;
            this.viewPos[1] = cameraPos.y;
            this.viewPos[2] = cameraPos.z;

            this.viewPosId.setValue(this.viewPos);

            camera.frustum.setFromMat4(viewProjMat);
        }

        // Near and far clip values
        this.nearClipId.setValue(camera._nearClip);
        this.farClipId.setValue(camera._farClip);

        var n = camera._nearClip;
        var f = camera._farClip;
        this.cameraParams[0] = 1 / f;
        this.cameraParams[1] = f;
        this.cameraParams[2] = (1 - f / n) * 0.5;
        this.cameraParams[3] = (1 + f / n) * 0.5;
        this.cameraParamsId.setValue(this.cameraParams);

        this.clearView(camera, target, clear, false);

        var device = this.device;
        var pixelWidth = target ? target.width : device.width;
        var pixelHeight = target ? target.height : device.height;

        var scissorRect = camera.scissorRect;
        var x = Math.floor(scissorRect.x * pixelWidth);
        var y = Math.floor(scissorRect.y * pixelHeight);
        var w = Math.floor(scissorRect.z * pixelWidth);
        var h = Math.floor(scissorRect.w * pixelHeight);
        device.setScissor(x, y, w, h);

        if (cullBorder) device.setScissor(1, 1, pixelWidth - 2, pixelHeight - 2); // optionally clip borders when rendering
    }

    clearView(camera, target, clear, forceWrite, options) {
        var device = this.device;
        device.setRenderTarget(target);
        device.updateBegin();

        if (forceWrite) {
            device.setColorWrite(true, true, true, true);
            device.setDepthWrite(true);
        }

        var rect = camera.rect;
        var pixelWidth = target ? target.width : device.width;
        var pixelHeight = target ? target.height : device.height;
        var x = Math.floor(rect.x * pixelWidth);
        var y = Math.floor(rect.y * pixelHeight);
        var w = Math.floor(rect.z * pixelWidth);
        var h = Math.floor(rect.w * pixelHeight);
        device.setViewport(x, y, w, h);
        device.setScissor(x, y, w, h);

        if (clear) {
            // use camera clear options if any
            if (!options)
                options = camera._clearOptions;

            device.clear(options ? options : {
                color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
                depth: camera._clearDepth,
                flags: (camera._clearColorBuffer ? CLEARFLAG_COLOR : 0) |
                       (camera._clearDepthBuffer ? CLEARFLAG_DEPTH : 0) |
                       (camera._clearStencilBuffer ? CLEARFLAG_STENCIL : 0),
                stencil: camera._clearStencil
            }); // clear full RT
        }
    }

    // placeholder LUT textures for area light
    _createAreaLightPlaceholderLuts() {
        var placeholderLutTex =  new Texture(this.device, {
            width: 2,
            height: 2,
            format: PIXELFORMAT_R8_G8_B8_A8
        });
        placeholderLutTex.name = 'placeholder';

        var pixels = placeholderLutTex.lock();
        for (var i = 0; i < 4; i++) {
            for (var c = 0; c < 4; c++) {
                pixels[i * 4 + c] = 0;
            }
        }
        placeholderLutTex.unlock();

        this.device.scope.resolve('areaLightsLutTex1').setValue(placeholderLutTex);
        this.device.scope.resolve('areaLightsLutTex2').setValue(placeholderLutTex);
    }

    // creates LUT texture used by area lights
    _uploadAreaLightLuts(resource) {

        function createTexture(device, data, format) {
            var tex = new Texture(device, {
                width: 64,
                height: 64,
                format: format,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                type: TEXTURETYPE_DEFAULT,
                magFilter: FILTER_LINEAR,
                minFilter: FILTER_NEAREST,
                anisotropy: 1
            });

            tex.lock().set(data);
            tex.unlock();
            tex.upload();

            return tex;
        }

        function offsetScale(data, offset, scale) {

            var count = data.length;
            var ret = new Float32Array(count);
            for (var i = 0; i < count; i++) {
                var n = i % 4;
                ret[i] = (data[i] + offset[n]) * scale[n];
            }
            return ret;
        }

        function convertToHalfFloat(data) {

            var count = data.length;
            var ret = new Uint16Array(count);
            var float2Half = math.float2Half;
            for (var i = 0; i < count; i++) {
                ret[i] = float2Half(data[i]);
            }

            return ret;
        }

        function convertToUint(data){

            var count = data.length;
            var ret = new Uint8ClampedArray(count);
            for (var i = 0; i < count; i++) {
                ret[i] = data[i] * 255;
            }

            return ret;
        }

        // create lut textures
        var versions = new Int16Array(resource, 0, 2);

        var luts = {
            data1: new Float32Array(resource, 4, 16384),
            data2: new Float32Array(resource, 4 + 16384 * 4, 16384),
            majorVersion: versions[0],
            minorVersion: versions[1]
        };

        if (luts.majorVersion !== 0 || luts.minorVersion !== 1) {
            console.warn(`areaLightLuts asset version: ${luts.majorVersion}.${luts.minorVersion} is not supported in current engine version!`);
        } else {
            var device = this.device;
            var data1, data2;
            var format = device.areaLightLutFormat;

            // pick format for lut texture
            if (format === PIXELFORMAT_RGBA32F) {

                // float
                data1 = luts.data1;
                data2 = luts.data2;

            } else if (format === PIXELFORMAT_RGBA16F) {

                // half float
                data1 = convertToHalfFloat(luts.data1);
                data2 = convertToHalfFloat(luts.data2);

            } else {

                // low precision format
                // offset and scale to avoid clipping and increase precision - this is undone in the shader

                var o1 = [0.0, 0.2976, 0.01381, 0.0];
                var s1 = [0.999, 3.08737, 1.6546, 0.603249];

                var o2 = [-0.306897, 0.0, 0.0, 0.0];
                var s2 = [1.442787, 1.0, 1.0, 1.0];

                data1 = convertToUint(offsetScale(luts.data1, o1, s1));
                data2 = convertToUint(offsetScale(luts.data2, o2, s2));

            }

            var tex1 = createTexture(device, data1, format);
            var tex2 = createTexture(device, data2, format);

            // assign to scope variables
            device.scope.resolve('areaLightsLutTex1').setValue(tex1);
            device.scope.resolve('areaLightsLutTex2').setValue(tex2);
        }
    }

    dispatchGlobalLights(scene) {
        var i;
        this.mainLight = -1;

        this.ambientColor[0] = scene.ambientLight.r;
        this.ambientColor[1] = scene.ambientLight.g;
        this.ambientColor[2] = scene.ambientLight.b;
        if (scene.gammaCorrection) {
            for (i = 0; i < 3; i++) {
                this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
            }
        }
        this.ambientId.setValue(this.ambientColor);
        this.exposureId.setValue(scene.exposure);
        if (scene.skyboxModel) this.skyboxIntensityId.setValue(scene.skyboxIntensity);
    }

    _resolveLight(scope, i) {
        var light = "light" + i;
        this.lightColorId[i] = scope.resolve(light + "_color");
        this.lightDir[i] = new Float32Array(3);
        this.lightDirId[i] = scope.resolve(light + "_direction");
        this.lightShadowMapId[i] = scope.resolve(light + "_shadowMap");
        this.lightShadowMatrixId[i] = scope.resolve(light + "_shadowMatrix");
        this.lightShadowParamsId[i] = scope.resolve(light + "_shadowParams");
        this.lightShadowMatrixVsId[i] = scope.resolve(light + "_shadowMatrixVS");
        this.lightShadowParamsVsId[i] = scope.resolve(light + "_shadowParamsVS");
        this.lightDirVs[i] = new Float32Array(3);
        this.lightDirVsId[i] = scope.resolve(light + "_directionVS");
        this.lightRadiusId[i] = scope.resolve(light + "_radius");
        this.lightPos[i] = new Float32Array(3);
        this.lightPosId[i] = scope.resolve(light + "_position");
        this.lightWidth[i] = new Float32Array(3);
        this.lightWidthId[i] = scope.resolve(light + "_halfWidth");
        this.lightHeight[i] = new Float32Array(3);
        this.lightHeightId[i] = scope.resolve(light + "_halfHeight");
        this.lightInAngleId[i] = scope.resolve(light + "_innerConeAngle");
        this.lightOutAngleId[i] = scope.resolve(light + "_outerConeAngle");
        this.lightPosVsId[i] = scope.resolve(light + "_positionVS");
        this.lightCookieId[i] = scope.resolve(light + "_cookie");
        this.lightCookieIntId[i] = scope.resolve(light + "_cookieIntensity");
        this.lightCookieMatrixId[i] = scope.resolve(light + "_cookieMatrix");
        this.lightCookieOffsetId[i] = scope.resolve(light + "_cookieOffset");
    }

    setLTCDirectionallLight(wtm, cnt, dir, campos, far) {
        this.lightPos[cnt][0] = campos.x - dir.x * far;
        this.lightPos[cnt][1] = campos.y - dir.y * far;
        this.lightPos[cnt][2] = campos.z - dir.z * far;
        this.lightPosId[cnt].setValue(this.lightPos[cnt]);

        var hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
        this.lightWidth[cnt][0] = hWidth.x * far;
        this.lightWidth[cnt][1] = hWidth.y * far;
        this.lightWidth[cnt][2] = hWidth.z * far;
        this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);

        var hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
        this.lightHeight[cnt][0] = hHeight.x * far;
        this.lightHeight[cnt][1] = hHeight.y * far;
        this.lightHeight[cnt][2] = hHeight.z * far;
        this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
    }

    dispatchDirectLights(dirs, scene, mask, camera) {
        var numDirs = dirs.length;
        var i;
        var directional, wtm;
        var cnt = 0;
        this.mainLight = -1;

        var scope = this.device.scope;

        for (i = 0; i < numDirs; i++) {
            if (!(dirs[i].mask & mask)) continue;

            directional = dirs[i];
            wtm = directional._node.getWorldTransform();

            if (!this.lightColorId[cnt]) {
                this._resolveLight(scope, cnt);
            }

            this.lightColorId[cnt].setValue(scene.gammaCorrection ? directional._linearFinalColor : directional._finalColor);

            // Directionals shine down the negative Y axis
            wtm.getY(directional._direction).scale(-1);
            directional._direction.normalize();
            this.lightDir[cnt][0] = directional._direction.x;
            this.lightDir[cnt][1] = directional._direction.y;
            this.lightDir[cnt][2] = directional._direction.z;
            this.lightDirId[cnt].setValue(this.lightDir[cnt]);

            if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
                // non-punctual shape - NB directional area light specular is approximated by putting the area light at the far clip
                this.setLTCDirectionallLight(wtm, cnt, directional._direction, camera._node.getPosition(), camera.farClip);
            }

            if (directional.castShadows) {
                var shadowMap = directional._isPcf && this.device.webgl2 ?
                    directional._shadowCamera.renderTarget.depthBuffer :
                    directional._shadowCamera.renderTarget.colorBuffer;

                // make bias dependent on far plane because it's not constant for direct light
                var bias;
                if (directional._isVsm) {
                    bias = -0.00001 * 20;
                } else {
                    bias = (directional.shadowBias / directional._shadowCamera._farClip) * 100;
                    if (!this.device.webgl2 && this.device.extStandardDerivatives) bias *= -100;
                }
                var normalBias = directional._isVsm ?
                    directional.vsmBias / (directional._shadowCamera._farClip / 7.0) :
                    directional._normalOffsetBias;

                this.lightShadowMapId[cnt].setValue(shadowMap);
                this.lightShadowMatrixId[cnt].setValue(directional._shadowMatrix.data);
                var params = directional._rendererParams;
                if (params.length !== 3) params.length = 3;
                params[0] = directional._shadowResolution;
                params[1] = normalBias;
                params[2] = bias;
                this.lightShadowParamsId[cnt].setValue(params);
                if (this.mainLight < 0) {
                    this.lightShadowMatrixVsId[cnt].setValue(directional._shadowMatrix.data);
                    this.lightShadowParamsVsId[cnt].setValue(params);
                    directional._direction.normalize();
                    this.lightDirVs[cnt][0] = directional._direction.x;
                    this.lightDirVs[cnt][1] = directional._direction.y;
                    this.lightDirVs[cnt][2] = directional._direction.z;
                    this.lightDirVsId[cnt].setValue(this.lightDirVs[cnt]);
                    this.mainLight = i;
                }
            }
            cnt++;
        }
        return cnt;
    }

    setLTCPositionalLight(wtm, cnt) {
        var hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
        this.lightWidth[cnt][0] = hWidth.x;
        this.lightWidth[cnt][1] = hWidth.y;
        this.lightWidth[cnt][2] = hWidth.z;
        this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);

        var hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
        this.lightHeight[cnt][0] = hHeight.x;
        this.lightHeight[cnt][1] = hHeight.y;
        this.lightHeight[cnt][2] = hHeight.z;
        this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
    }

    dispatchOmniLight(scene, scope, omni, cnt) {
        var wtm = omni._node.getWorldTransform();

        if (!this.lightColorId[cnt]) {
            this._resolveLight(scope, cnt);
        }

        this.lightRadiusId[cnt].setValue(omni.attenuationEnd);
        this.lightColorId[cnt].setValue(scene.gammaCorrection ? omni._linearFinalColor : omni._finalColor);
        wtm.getTranslation(omni._position);
        this.lightPos[cnt][0] = omni._position.x;
        this.lightPos[cnt][1] = omni._position.y;
        this.lightPos[cnt][2] = omni._position.z;
        this.lightPosId[cnt].setValue(this.lightPos[cnt]);

        if (omni.shape !== LIGHTSHAPE_PUNCTUAL) {
            // non-punctual shape
            this.setLTCPositionalLight(wtm, cnt);
        }

        if (omni.castShadows) {
            var shadowMap = omni._shadowCamera.renderTarget.colorBuffer;
            this.lightShadowMapId[cnt].setValue(shadowMap);
            var params = omni._rendererParams;
            if (params.length !== 4) params.length = 4;
            params[0] = omni._shadowResolution;
            params[1] = omni._normalOffsetBias;
            params[2] = omni.shadowBias;
            params[3] = 1.0 / omni.attenuationEnd;
            this.lightShadowParamsId[cnt].setValue(params);
        }
        if (omni._cookie) {
            this.lightCookieId[cnt].setValue(omni._cookie);
            this.lightShadowMatrixId[cnt].setValue(wtm.data);
            this.lightCookieIntId[cnt].setValue(omni.cookieIntensity);
        }
    }

    dispatchSpotLight(scene, scope, spot, cnt) {
        var wtm = spot._node.getWorldTransform();

        if (!this.lightColorId[cnt]) {
            this._resolveLight(scope, cnt);
        }

        this.lightInAngleId[cnt].setValue(spot._innerConeAngleCos);
        this.lightOutAngleId[cnt].setValue(spot._outerConeAngleCos);
        this.lightRadiusId[cnt].setValue(spot.attenuationEnd);
        this.lightColorId[cnt].setValue(scene.gammaCorrection ? spot._linearFinalColor : spot._finalColor);
        wtm.getTranslation(spot._position);
        this.lightPos[cnt][0] = spot._position.x;
        this.lightPos[cnt][1] = spot._position.y;
        this.lightPos[cnt][2] = spot._position.z;
        this.lightPosId[cnt].setValue(this.lightPos[cnt]);

        if (spot.shape !== LIGHTSHAPE_PUNCTUAL) {
            // non-punctual shape
            this.setLTCPositionalLight(wtm, cnt);
        }

        // Spots shine down the negative Y axis
        wtm.getY(spot._direction).scale(-1);
        spot._direction.normalize();
        this.lightDir[cnt][0] = spot._direction.x;
        this.lightDir[cnt][1] = spot._direction.y;
        this.lightDir[cnt][2] = spot._direction.z;
        this.lightDirId[cnt].setValue(this.lightDir[cnt]);

        if (spot.castShadows) {
            var bias;
            if (spot._isVsm) {
                bias = -0.00001 * 20;
            } else {
                bias = spot.shadowBias * 20; // approx remap from old bias values
                if (!this.device.webgl2 && this.device.extStandardDerivatives) bias *= -100;
            }
            var normalBias = spot._isVsm ?
                spot.vsmBias / (spot.attenuationEnd / 7.0) :
                spot._normalOffsetBias;

            var shadowMap = spot._isPcf && this.device.webgl2 ?
                spot._shadowCamera.renderTarget.depthBuffer :
                spot._shadowCamera.renderTarget.colorBuffer;
            this.lightShadowMapId[cnt].setValue(shadowMap);
            this.lightShadowMatrixId[cnt].setValue(spot._shadowMatrix.data);
            var params = spot._rendererParams;
            if (params.length !== 4) params.length = 4;
            params[0] = spot._shadowResolution;
            params[1] = normalBias;
            params[2] = bias;
            params[3] = 1.0 / spot.attenuationEnd;
            this.lightShadowParamsId[cnt].setValue(params);
        }
        if (spot._cookie) {
            this.lightCookieId[cnt].setValue(spot._cookie);
            if (!spot.castShadows) {
                var shadowCam = this.getShadowCamera(this.device, spot);
                var shadowCamNode = shadowCam._node;

                shadowCamNode.setPosition(spot._node.getPosition());
                shadowCamNode.setRotation(spot._node.getRotation());
                shadowCamNode.rotateLocal(-90, 0, 0);

                shadowCam.projection = PROJECTION_PERSPECTIVE;
                shadowCam.aspectRatio = 1;
                shadowCam.fov = spot._outerConeAngle * 2;

                shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
                shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);
                spot._shadowMatrix.mul2(scaleShift, shadowCamViewProj);
            }
            this.lightShadowMatrixId[cnt].setValue(spot._shadowMatrix.data);
            this.lightCookieIntId[cnt].setValue(spot.cookieIntensity);
            if (spot._cookieTransform) {
                spot._cookieTransformUniform[0] = spot._cookieTransform.x;
                spot._cookieTransformUniform[1] = spot._cookieTransform.y;
                spot._cookieTransformUniform[2] = spot._cookieTransform.z;
                spot._cookieTransformUniform[3] = spot._cookieTransform.w;
                this.lightCookieMatrixId[cnt].setValue(spot._cookieTransformUniform);
                spot._cookieOffsetUniform[0] = spot._cookieOffset.x;
                spot._cookieOffsetUniform[1] = spot._cookieOffset.y;
                this.lightCookieOffsetId[cnt].setValue(spot._cookieOffsetUniform);
            }
        }
    }

    dispatchLocalLights(sortedLights, scene, mask, usedDirLights, staticLightList) {
        var i;
        var omni, spot;

        var omnis = sortedLights[LIGHTTYPE_OMNI];
        var spts = sortedLights[LIGHTTYPE_SPOT];

        var numDirs = usedDirLights;
        var numOmnis = omnis.length;
        var numSpts = spts.length;
        var cnt = numDirs;

        var scope = this.device.scope;

        for (i = 0; i < numOmnis; i++) {
            omni = omnis[i];
            if (!(omni.mask & mask)) continue;
            if (omni.isStatic) continue;
            this.dispatchOmniLight(scene, scope, omni, cnt);
            cnt++;
        }

        var staticId = 0;
        if (staticLightList) {
            omni = staticLightList[staticId];
            while (omni && omni._type === LIGHTTYPE_OMNI) {
                this.dispatchOmniLight(scene, scope, omni, cnt);
                cnt++;
                staticId++;
                omni = staticLightList[staticId];
            }
        }

        for (i = 0; i < numSpts; i++) {
            spot = spts[i];
            if (!(spot.mask & mask)) continue;
            if (spot.isStatic) continue;
            this.dispatchSpotLight(scene, scope, spot, cnt);
            cnt++;
        }

        if (staticLightList) {
            spot = staticLightList[staticId];
            while (spot && spot._type === LIGHTTYPE_SPOT) {
                this.dispatchSpotLight(scene, scope, spot, cnt);
                cnt++;
                staticId++;
                spot = staticLightList[staticId];
            }
        }
    }

    cull(camera, drawCalls, visibleList) {
        // #ifdef PROFILER
        var cullTime = now();
        var numDrawCallsCulled = 0;
        // #endif

        var visibleLength = 0;
        var i, drawCall, visible;
        var drawCallsCount = drawCalls.length;

        var cullingMask = camera.cullingMask || 0xFFFFFFFF; // if missing assume camera's default value

        if (!camera.frustumCulling) {
            for (i = 0; i < drawCallsCount; i++) {
                // need to copy array anyway because sorting will happen and it'll break original draw call order assumption
                drawCall = drawCalls[i];
                if (!drawCall.visible && !drawCall.command) continue;

                // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
                if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;

                visibleList[visibleLength] = drawCall;
                visibleLength++;
                drawCall.visibleThisFrame = true;
            }
            return visibleLength;
        }

        for (i = 0; i < drawCallsCount; i++) {
            drawCall = drawCalls[i];
            if (!drawCall.command) {
                if (!drawCall.visible) continue; // use visible property to quickly hide/show meshInstances
                visible = true;

                // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
                if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;

                if (drawCall.cull) {
                    visible = drawCall._isVisible(camera);
                    // #ifdef PROFILER
                    numDrawCallsCulled++;
                    // #endif
                }

                if (visible) {
                    visibleList[visibleLength] = drawCall;
                    visibleLength++;
                    drawCall.visibleThisFrame = true;
                }
            } else {
                visibleList[visibleLength] = drawCall;
                visibleLength++;
                drawCall.visibleThisFrame = true;
            }
        }

        // #ifdef PROFILER
        this._cullTime += now() - cullTime;
        this._numDrawCallsCulled += numDrawCallsCulled;
        // #endif

        return visibleLength;
    }

    cullLights(camera, lights) {
        var i, light;
        for (i = 0; i < lights.length; i++) {
            light = lights[i];
            if (light.castShadows && light.enabled && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
                if (light._type !== LIGHTTYPE_DIRECTIONAL) {
                    light.getBoundingSphere(tempSphere);
                    if (camera.frustum.containsSphere(tempSphere)) {
                        light.visibleThisFrame = true;
                    }
                }
            }
        }
    }

    updateCpuSkinMatrices(drawCalls) {

        _skinUpdateIndex++;

        var drawCallsCount = drawCalls.length;
        if (drawCallsCount === 0) return;

        // #ifdef PROFILER
        var skinTime = now();
        // #endif

        var i, si;
        for (i = 0; i < drawCallsCount; i++) {
            si = drawCalls[i].skinInstance;
            if (si) {
                si.updateMatrices(drawCalls[i].node, _skinUpdateIndex);
                si._dirty = true;
            }
        }

        // #ifdef PROFILER
        this._skinTime += now() - skinTime;
        // #endif
    }

    updateGpuSkinMatrices(drawCalls) {
        // #ifdef PROFILER
        var skinTime = now();
        // #endif

        var i, skin;
        var drawCallsCount = drawCalls.length;
        for (i = 0; i < drawCallsCount; i++) {
            if (!drawCalls[i].visibleThisFrame) continue;
            skin = drawCalls[i].skinInstance;
            if (skin) {
                if (skin._dirty) {
                    skin.updateMatrixPalette(drawCalls[i].node, _skinUpdateIndex);
                    skin._dirty = false;
                }
            }
        }

        // #ifdef PROFILER
        this._skinTime += now() - skinTime;
        // #endif
    }

    updateMorphing(drawCalls) {
        // #ifdef PROFILER
        var morphTime = now();
        // #endif

        var i, morphInst;
        var drawCallsCount = drawCalls.length;
        for (i = 0; i < drawCallsCount; i++) {
            morphInst = drawCalls[i].morphInstance;
            if (morphInst && morphInst._dirty && drawCalls[i].visibleThisFrame) {
                morphInst.update();
            }
        }
        // #ifdef PROFILER
        this._morphTime += now() - morphTime;
        // #endif
    }

    setBaseConstants(device, material) {
        // Cull mode
        device.setCullMode(material.cull);
        // Alpha test
        if (material.opacityMap) {
            this.opacityMapId.setValue(material.opacityMap);
            this.alphaTestId.setValue(material.alphaTest);
        }
    }

    setSkinning(device, meshInstance, material) {
        if (meshInstance.skinInstance) {
            this._skinDrawCalls++;
            if (device.supportsBoneTextures) {
                boneTexture = meshInstance.skinInstance.boneTexture;
                this.boneTextureId.setValue(boneTexture);
                boneTextureSize[0] = boneTexture.width;
                boneTextureSize[1] = boneTexture.height;
                boneTextureSize[2] = 1.0 / boneTexture.width;
                boneTextureSize[3] = 1.0 / boneTexture.height;
                this.boneTextureSizeId.setValue(boneTextureSize);
            } else {
                this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
            }
        }
    }

    // returns number of extra draw calls to skip - used to skip auto instanced meshes draw calls. by default return 0 to not skip any additional draw calls
    drawInstance(device, meshInstance, mesh, style, normal) {
        instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.setVertexBuffer(instancingData.vertexBuffer);
                device.draw(mesh.primitive[style], instancingData.count);
                if (instancingData.vertexBuffer === _autoInstanceBuffer) {
                    this._removedByInstancing += instancingData.count;
                    meshInstance.instancingData = null;
                    return instancingData.count - 1;
                }
            }
        } else {
            modelMatrix = meshInstance.node.worldTransform;
            this.modelMatrixId.setValue(modelMatrix.data);

            if (normal) {
                normalMatrix = meshInstance.node.normalMatrix;
                if (meshInstance.node._dirtyNormal) {
                    modelMatrix.invertTo3x3(normalMatrix);
                    normalMatrix.transpose();
                    meshInstance.node._dirtyNormal = false;
                }
                this.normalMatrixId.setValue(normalMatrix.data);
            }

            device.draw(mesh.primitive[style]);
        }
        return 0;
    }

    // used for stereo
    drawInstance2(device, meshInstance, mesh, style) {
        instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.draw(mesh.primitive[style], instancingData.count, true);
                if (instancingData.vertexBuffer === _autoInstanceBuffer) {
                    this._removedByInstancing += instancingData.count;
                    meshInstance.instancingData = null;
                    return instancingData.count - 1;
                }
            }
        } else {
            // matrices are already set
            device.draw(mesh.primitive[style], undefined, true);
        }
        return 0;
    }

    renderShadows(lights, cameraPass) {
        var device = this.device;
        device.grabPassAvailable = false;

        // #ifdef PROFILER
        var shadowMapStartTime = now();
        // #endif

        var i, j, light, shadowShader, type, shadowCam, shadowCamNode, pass, passes, shadowType, smode;
        var numInstances;
        var meshInstance, mesh, material;
        var style;
        var settings;
        var visibleList, visibleLength;
        var passFlag = 1 << SHADER_SHADOW;

        for (i = 0; i < lights.length; i++) {
            light = lights[i];
            type = light._type;

            if (!light.castShadows || !light.enabled) continue;

            if (!light._shadowCamera) {
                this.getShadowCamera(device, light); // fix accessing non-existing shadow map/camera when the light was created/applied, but shadowmap was never initialized
            }

            if (light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame) {
                var cameraPos;
                shadowCam = this.getShadowCamera(device, light);
                shadowCamNode = shadowCam._node;
                pass = 0;
                passes = 1;

                if (type === LIGHTTYPE_DIRECTIONAL) {
                    if (light._visibleLength[cameraPass] < 0) continue; // prevent light from rendering more than once for this camera
                    settings = light._visibleCameraSettings[cameraPass];
                    shadowCamNode.setPosition(settings.x, settings.y, settings.z);
                    shadowCam.orthoHeight = settings.orthoHeight;
                    shadowCam.farClip = settings.farClip;
                    pass = cameraPass;

                } else if (type === LIGHTTYPE_SPOT) {
                    cameraPos = shadowCamNode.getPosition();
                    this.viewPos[0] = cameraPos.x;
                    this.viewPos[1] = cameraPos.y;
                    this.viewPos[2] = cameraPos.z;
                    this.viewPosId.setValue(this.viewPos);
                    this.shadowMapLightRadiusId.setValue(light.attenuationEnd);

                } else if (type === LIGHTTYPE_OMNI) {
                    cameraPos = shadowCamNode.getPosition();
                    this.viewPos[0] = cameraPos.x;
                    this.viewPos[1] = cameraPos.y;
                    this.viewPos[2] = cameraPos.z;
                    this.viewPosId.setValue(this.viewPos);
                    this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
                    passes = 6;

                }

                // #ifdef DEBUG
                this.device.pushMarker("SHADOW " + light._node.name);
                // #endif

                if (type !== LIGHTTYPE_OMNI) {
                    shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
                    shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);
                    light._shadowMatrix.mul2(scaleShift, shadowCamViewProj);
                }

                if (device.webgl2) {
                    if (type === LIGHTTYPE_OMNI) {
                        device.setDepthBias(false);
                    } else {
                        device.setDepthBias(true);
                        device.setDepthBiasValues(light.shadowBias * -1000.0, light.shadowBias * -1000.0);
                    }
                } else if (device.extStandardDerivatives) {
                    if (type === LIGHTTYPE_OMNI) {
                        this.polygonOffset[0] = 0;
                        this.polygonOffset[1] = 0;
                        this.polygonOffsetId.setValue(this.polygonOffset);
                    } else {
                        this.polygonOffset[0] = light.shadowBias * -1000.0;
                        this.polygonOffset[1] = light.shadowBias * -1000.0;
                        this.polygonOffsetId.setValue(this.polygonOffset);
                    }
                }

                if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) light.shadowUpdateMode = SHADOWUPDATE_NONE;

                this._shadowMapUpdates += passes;

                // Set standard shadowmap states
                device.setBlending(false);
                device.setDepthWrite(true);
                device.setDepthTest(true);
                if (light._isPcf && device.webgl2 && type !== LIGHTTYPE_OMNI) {
                    device.setColorWrite(false, false, false, false);
                } else {
                    device.setColorWrite(true, true, true, true);
                }

                if (pass) {
                    passes = pass + 1; // predefined single pass
                } else {
                    pass = 0; // omni light passes
                }

                while (pass < passes) {

                    // #ifdef DEBUG
                    var doPopMarker = false;
                    if (passes > 1) {
                        this.device.pushMarker("PASS " + pass);
                        doPopMarker = true;
                    }
                    // #endif

                    if (type === LIGHTTYPE_OMNI) {
                        shadowCamNode.setRotation(pointLightRotations[pass]);
                        shadowCam.renderTarget = light._shadowCubeMap[pass];
                    }

                    this.setCamera(shadowCam, shadowCam.renderTarget, true, type !== LIGHTTYPE_OMNI);

                    visibleList = light._visibleList[pass];
                    visibleLength = light._visibleLength[pass];

                    // Sort shadow casters
                    shadowType = light._shadowType;
                    smode = shadowType + type * numShadowModes;

                    // Render
                    for (j = 0, numInstances = visibleLength; j < numInstances; j++) {
                        meshInstance = visibleList[j];
                        mesh = meshInstance.mesh;
                        material = meshInstance.material;

                        // set basic material states/parameters
                        this.setBaseConstants(device, material);
                        this.setSkinning(device, meshInstance, material);

                        if (material.dirty) {
                            material.updateUniforms();
                            material.dirty = false;
                        }

                        if (material.chunks) {

                            this.setCullMode(true, false, meshInstance);

                            // Uniforms I (shadow): material
                            material.setParameters(device);

                            // Uniforms II (shadow): meshInstance overrides
                            meshInstance.setParameters(device, passFlag);
                        }

                        // set shader
                        shadowShader = meshInstance._shader[SHADER_SHADOW + smode];
                        if (!shadowShader) {
                            this.updateShader(meshInstance, meshInstance._shaderDefs, null, SHADER_SHADOW + smode);
                            shadowShader = meshInstance._shader[SHADER_SHADOW + smode];
                            meshInstance._key[SORTKEY_DEPTH] = getDepthKey(meshInstance);
                        }
                        device.setShader(shadowShader);
                        // set buffers
                        style = meshInstance.renderStyle;

                        this.setVertexBuffers(device, mesh);
                        this.setMorphing(device, meshInstance.morphInstance);

                        device.setIndexBuffer(mesh.indexBuffer[style]);
                        // draw
                        j += this.drawInstance(device, meshInstance, mesh, style);
                        this._shadowDrawCalls++;
                    }
                    pass++;
                    if (type === LIGHTTYPE_DIRECTIONAL) light._visibleLength[cameraPass] = -1; // prevent light from rendering more than once for this camera

                    // #ifdef DEBUG
                    if (doPopMarker)
                        this.device.popMarker();
                    // #endif

                } // end pass

                if (light._isVsm) {

                    // #ifdef DEBUG
                    this.device.pushMarker("VSM");
                    // #endif

                    var filterSize = light._vsmBlurSize;
                    if (filterSize > 1) {
                        var origShadowMap = shadowCam.renderTarget;
                        var tempRt = getShadowMapFromCache(device, light._shadowResolution, light._shadowType, 1);

                        var isVsm8 = light._shadowType === SHADOW_VSM8;
                        var blurMode = light.vsmBlurMode;
                        var blurShader = (isVsm8 ? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize];
                        if (!blurShader) {
                            this.blurVsmWeights[filterSize] = gaussWeights(filterSize);

                            var blurVS = shaderChunks.fullscreenQuadVS;
                            var blurFS = "#define SAMPLES " + filterSize + "\n";
                            if (isVsm8) {
                                blurFS += this.blurPackedVsmShaderCode[blurMode];
                            } else {
                                blurFS += this.blurVsmShaderCode[blurMode];
                            }
                            var blurShaderName = "blurVsm" + blurMode + "" + filterSize + "" + isVsm8;
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
                    }

                    // #ifdef DEBUG
                    this.device.popMarker();
                    // #endif
                }

                // #ifdef DEBUG
                this.device.popMarker();
                // #endif
            }
        }

        if (device.webgl2) {
            device.setDepthBias(false);
        } else if (device.extStandardDerivatives) {
            this.polygonOffset[0] = 0;
            this.polygonOffset[1] = 0;
            this.polygonOffsetId.setValue(this.polygonOffset);
        }

        device.grabPassAvailable = true;

        // #ifdef PROFILER
        this._shadowMapTime += now() - shadowMapStartTime;
        // #endif
    }

    updateShader(meshInstance, objDefs, staticLightList, pass, sortedLights) {
        meshInstance.material._scene = this.scene;

        // if material has dirtyBlend set, notify scene here
        if (meshInstance.material._dirtyBlend) {
            this.scene.layers._dirtyBlend = true;
        }

        meshInstance.material.updateShader(this.device, this.scene, objDefs, staticLightList, pass, sortedLights);
        meshInstance._shader[pass] = meshInstance.material.shader;
    }

    setCullMode(cullFaces, flip, drawCall) {
        var material = drawCall.material;
        var mode = CULLFACE_NONE;
        if (cullFaces) {
            var flipFaces = 1;

            if (material.cull > CULLFACE_NONE && material.cull < CULLFACE_FRONTANDBACK) {
                if (drawCall.flipFaces)
                    flipFaces *= -1;

                if (flip)
                    flipFaces *= -1;

                var wt = drawCall.node.worldTransform;
                wt.getX(worldMatX);
                wt.getY(worldMatY);
                wt.getZ(worldMatZ);
                worldMatX.cross(worldMatX, worldMatY);
                if (worldMatX.dot(worldMatZ) < 0) {
                    flipFaces *= -1;
                }
            }

            if (flipFaces < 0) {
                mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
            } else {
                mode = material.cull;
            }
        }
        this.device.setCullMode(mode);

        if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
            var wt2 = drawCall.node.worldTransform;
            wt2.getX(worldMatX);
            wt2.getY(worldMatY);
            wt2.getZ(worldMatZ);
            worldMatX.cross(worldMatX, worldMatY);
            if (worldMatX.dot(worldMatZ) < 0) {
                this.twoSidedLightingNegScaleFactorId.setValue(-1.0);
            } else {
                this.twoSidedLightingNegScaleFactorId.setValue(1.0);
            }
        }
    }

    setVertexBuffers(device, mesh) {

        // main vertex buffer
        device.setVertexBuffer(mesh.vertexBuffer);
    }

    setMorphing(device, morphInstance) {

        if (morphInstance) {

            if (morphInstance.morph.useTextureMorph) {

                // vertex buffer with vertex ids
                device.setVertexBuffer(morphInstance.morph.vertexBufferIds);

                // textures
                this.morphPositionTex.setValue(morphInstance.texturePositions);
                this.morphNormalTex.setValue(morphInstance.textureNormals);

                // texture params
                this.morphTexParams.setValue(morphInstance._textureParams);

            } else {    // vertex attributes based morphing

                var vb, semantic;
                for (var t = 0; t < morphInstance._activeVertexBuffers.length; t++) {

                    vb = morphInstance._activeVertexBuffers[t];
                    if (vb) {

                        // patch semantic for the buffer to current ATTR slot (using ATTR8 - ATTR15 range)
                        semantic = SEMANTIC_ATTR + (t + 8);
                        vb.format.elements[0].name = semantic;
                        vb.format.elements[0].scopeId = device.scope.resolve(semantic);
                        vb.format.update();

                        device.setVertexBuffer(vb);
                    }
                }

                // set all 8 weights
                this.morphWeightsA.setValue(morphInstance._shaderMorphWeightsA);
                this.morphWeightsB.setValue(morphInstance._shaderMorphWeightsB);
            }
        }
    }

    renderForward(camera, drawCalls, drawCallsCount, sortedLights, pass, cullingMask, drawCallback, layer) {
        var device = this.device;
        var scene = this.scene;
        var vrDisplay = camera.vrDisplay;
        var lightHash = layer ? layer._lightHash : 0;

        var passFlag = 1 << pass;

        // #ifdef PROFILER
        var forwardStartTime = now();
        // #endif

        var i, drawCall, mesh, material, objDefs, variantKey, lightMask, style, usedDirLights;
        var prevMaterial = null, prevObjDefs, prevLightMask, prevStatic;
        var stencilFront, stencilBack;

        var halfWidth = device.width * 0.5;

        // Render the scene
        for (i = 0; i < drawCallsCount; i++) {

            drawCall = drawCalls[i];
            if (cullingMask && drawCall.mask && !(cullingMask & drawCall.mask)) continue; // apply visibility override

            if (drawCall.command) {
                // We have a command
                drawCall.command();
            } else {

                // #ifdef PROFILER
                if (camera === skipRenderCamera) {
                    if (_skipRenderCounter >= skipRenderAfter) continue;
                    _skipRenderCounter++;
                }
                if (layer) {
                    if (layer._skipRenderCounter >= layer.skipRenderAfter) continue;
                    layer._skipRenderCounter++;
                }
                // #endif

                // We have a mesh instance
                mesh = drawCall.mesh;
                material = drawCall.material;
                objDefs = drawCall._shaderDefs;
                lightMask = drawCall.mask;

                this.setSkinning(device, drawCall, material);

                if (material && material === prevMaterial && objDefs !== prevObjDefs) {
                    prevMaterial = null; // force change shader if the object uses a different variant of the same material
                }

                if (drawCall.isStatic || prevStatic) {
                    prevMaterial = null;
                }

                if (material !== prevMaterial) {
                    this._materialSwitches++;

                    if (material.dirty) {
                        material.updateUniforms();
                        material.dirty = false;
                    }

                    if (!drawCall._shader[pass] || drawCall._shaderDefs !== objDefs || drawCall._lightHash !== lightHash) {
                        if (!drawCall.isStatic) {
                            variantKey = pass + "_" + objDefs + "_" + lightHash;
                            drawCall._shader[pass] = material.variants[variantKey];
                            if (!drawCall._shader[pass]) {
                                this.updateShader(drawCall, objDefs, null, pass, sortedLights);
                                material.variants[variantKey] = drawCall._shader[pass];
                            }
                        } else {
                            this.updateShader(drawCall, objDefs, drawCall._staticLightList, pass, sortedLights);
                        }
                        drawCall._shaderDefs = objDefs;
                        drawCall._lightHash = lightHash;
                    }

                    if (! drawCall._shader[pass].failed && ! device.setShader(drawCall._shader[pass])) {
                        // #ifdef DEBUG
                        console.error('Error in material "' + material.name + '" with flags ' + objDefs);
                        // #endif
                        drawCall._shader[pass].failed = true;
                    }

                    // Uniforms I: material
                    material.setParameters(device);

                    if (!prevMaterial || lightMask !== prevLightMask) {
                        usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);
                        this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
                    }

                    this.alphaTestId.setValue(material.alphaTest);

                    device.setBlending(material.blend);
                    if (material.blend) {
                        if (material.separateAlphaBlend) {
                            device.setBlendFunctionSeparate(material.blendSrc, material.blendDst, material.blendSrcAlpha, material.blendDstAlpha);
                            device.setBlendEquationSeparate(material.blendEquation, material.blendAlphaEquation);
                        } else {
                            device.setBlendFunction(material.blendSrc, material.blendDst);
                            device.setBlendEquation(material.blendEquation);
                        }
                    }
                    device.setColorWrite(material.redWrite, material.greenWrite, material.blueWrite, material.alphaWrite);
                    device.setDepthWrite(material.depthWrite);

                    // this fixes the case where the user wishes to turn off depth testing but wants to write depth
                    if (material.depthWrite && !material.depthTest){
                        device.setDepthFunc(FUNC_ALWAYS);
                        device.setDepthTest(true);
                    } else {
                        device.setDepthFunc(FUNC_LESSEQUAL);
                        device.setDepthTest(material.depthTest);
                    }

                    device.setAlphaToCoverage(material.alphaToCoverage);

                    if (material.depthBias || material.slopeDepthBias) {
                        device.setDepthBias(true);
                        device.setDepthBiasValues(material.depthBias, material.slopeDepthBias);
                    } else {
                        device.setDepthBias(false);
                    }
                }

                this.setCullMode(camera._cullFaces, camera._flipFaces, drawCall);

                stencilFront = drawCall.stencilFront || material.stencilFront;
                stencilBack = drawCall.stencilBack || material.stencilBack;

                if (stencilFront || stencilBack) {
                    device.setStencilTest(true);
                    if (stencilFront === stencilBack) {
                        // identical front/back stencil
                        device.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                        device.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
                    } else {
                        // separate
                        if (stencilFront) {
                            // set front
                            device.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                            device.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
                        } else {
                            // default front
                            device.setStencilFuncFront(FUNC_ALWAYS, 0, 0xFF);
                            device.setStencilOperationFront(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
                        }
                        if (stencilBack) {
                            // set back
                            device.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
                            device.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
                        } else {
                            // default back
                            device.setStencilFuncBack(FUNC_ALWAYS, 0, 0xFF);
                            device.setStencilOperationBack(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
                        }
                    }
                } else {
                    device.setStencilTest(false);
                }

                // Uniforms II: meshInstance overrides
                drawCall.setParameters(device, passFlag);

                this.setVertexBuffers(device, mesh);
                this.setMorphing(device, drawCall.morphInstance);

                style = drawCall.renderStyle;
                device.setIndexBuffer(mesh.indexBuffer[style]);

                if (drawCallback) {
                    drawCallback(drawCall, i);
                }

                if (vrDisplay && vrDisplay.presenting) {
                    // Left
                    device.setViewport(0, 0, halfWidth, device.height);
                    this.projId.setValue(projL.data);
                    this.projSkyboxId.setValue(projL.data);
                    this.viewInvId.setValue(viewInvL.data);
                    this.viewId.setValue(viewL.data);
                    this.viewId3.setValue(viewMat3L.data);
                    this.viewProjId.setValue(viewProjMatL.data);
                    this.viewPos[0] = viewPosL.x;
                    this.viewPos[1] = viewPosL.y;
                    this.viewPos[2] = viewPosL.z;
                    this.viewPosId.setValue(this.viewPos);
                    i += this.drawInstance(device, drawCall, mesh, style, true);
                    this._forwardDrawCalls++;

                    // Right
                    device.setViewport(halfWidth, 0, halfWidth, device.height);
                    this.projId.setValue(projR.data);
                    this.projSkyboxId.setValue(projR.data);
                    this.viewInvId.setValue(viewInvR.data);
                    this.viewId.setValue(viewR.data);
                    this.viewId3.setValue(viewMat3R.data);
                    this.viewProjId.setValue(viewProjMatR.data);
                    this.viewPos[0] = viewPosR.x;
                    this.viewPos[1] = viewPosR.y;
                    this.viewPos[2] = viewPosR.z;
                    this.viewPosId.setValue(this.viewPos);
                    i += this.drawInstance2(device, drawCall, mesh, style);
                    this._forwardDrawCalls++;
                } else if (camera.xr && camera.xr.session && camera.xr.views.length) {
                    var views = camera.xr.views;

                    for (var v = 0; v < views.length; v++) {
                        var view = views[v];

                        device.setViewport(view.viewport.x, view.viewport.y, view.viewport.z, view.viewport.w);

                        this.projId.setValue(view.projMat.data);
                        this.projSkyboxId.setValue(view.projMat.data);
                        this.viewId.setValue(view.viewOffMat.data);
                        this.viewInvId.setValue(view.viewInvOffMat.data);
                        this.viewId3.setValue(view.viewMat3.data);
                        this.viewProjId.setValue(view.projViewOffMat.data);
                        this.viewPosId.setValue(view.position);

                        if (v === 0) {
                            i += this.drawInstance(device, drawCall, mesh, style, true);
                        } else {
                            i += this.drawInstance2(device, drawCall, mesh, style);
                        }

                        this._forwardDrawCalls++;
                    }
                } else {
                    i += this.drawInstance(device, drawCall, mesh, style, true);
                    this._forwardDrawCalls++;
                }

                // Unset meshInstance overrides back to material values if next draw call will use the same material
                if (i < drawCallsCount - 1 && drawCalls[i + 1].material === material) {
                    material.setParameters(device, drawCall.parameters);
                }

                prevMaterial = material;
                prevObjDefs = objDefs;
                prevLightMask = lightMask;
                prevStatic = drawCall.isStatic;
            }
        }
        device.updateEnd();

        // #ifdef PROFILER
        this._forwardTime += now() - forwardStartTime;
        // #endif
    }

    setupInstancing(device) {
        if (device.enableAutoInstancing) {
            if (!_autoInstanceBuffer) {
                _autoInstanceBuffer = new VertexBuffer(device, VertexFormat.defaultInstancingFormat, device.autoInstancingMaxObjects, BUFFER_DYNAMIC);
            }
        }
    }

    revertStaticMeshes(meshInstances) {
        var i;
        var drawCalls = meshInstances;
        var drawCallsCount = drawCalls.length;
        var drawCall;
        var newDrawCalls = [];

        var prevStaticSource;
        for (i = 0; i < drawCallsCount; i++) {
            drawCall = drawCalls[i];
            if (drawCall._staticSource) {
                if (drawCall._staticSource !== prevStaticSource) {
                    newDrawCalls.push(drawCall._staticSource);
                    prevStaticSource = drawCall._staticSource;
                }
            } else {
                newDrawCalls.push(drawCall);
            }
        }

        // Set array to new
        meshInstances.length = newDrawCalls.length;
        for (i = 0; i < newDrawCalls.length; i++) {
            meshInstances[i] = newDrawCalls[i];
        }
    }

    prepareStaticMeshes(meshInstances, lights) {
        // #ifdef PROFILER
        var prepareTime = now();
        var searchTime = 0;
        var subSearchTime = 0;
        var triAabbTime = 0;
        var subTriAabbTime = 0;
        var writeMeshTime = 0;
        var subWriteMeshTime = 0;
        var combineTime = 0;
        var subCombineTime = 0;
        // #endif

        var i, j, k, v, s, index;

        var device = this.device;
        var scene = this.scene;
        var drawCalls = meshInstances;
        var drawCallsCount = drawCalls.length;
        var drawCall, light;

        var newDrawCalls = [];
        var mesh;
        var indices, verts, numTris, elems, vertSize, offsetP, baseIndex;
        var _x, _y, _z;
        var minx, miny, minz, maxx, maxy, maxz;
        var minv, maxv;
        var minVec = new Vec3();
        var maxVec = new Vec3();
        var localLightBounds = new BoundingBox();
        var invMatrix = new Mat4();
        var triLightComb = [];
        var triLightCombUsed;
        var indexBuffer, vertexBuffer;
        var combIndices, combIbName, combIb;
        var lightTypePass;
        var lightAabb = [];
        var aabb;
        var triBounds = [];
        var staticLights = [];
        var bit;
        var lht;
        for (i = 0; i < drawCallsCount; i++) {
            drawCall = drawCalls[i];
            if (!drawCall.isStatic) {
                newDrawCalls.push(drawCall);
            } else {
                aabb = drawCall.aabb;
                staticLights.length = 0;
                for (lightTypePass = LIGHTTYPE_OMNI; lightTypePass <= LIGHTTYPE_SPOT; lightTypePass++) {
                    for (j = 0; j < lights.length; j++) {
                        light = lights[j];
                        if (light._type !== lightTypePass) continue;
                        if (light.enabled) {
                            if (light.mask & drawCall.mask) {
                                if (light.isStatic) {
                                    if (!lightAabb[j]) {
                                        lightAabb[j] = new BoundingBox();
                                        // light.getBoundingBox(lightAabb[j]); // box from sphere seems to give better granularity
                                        light._node.getWorldTransform();
                                        light.getBoundingSphere(tempSphere);
                                        lightAabb[j].center.copy(tempSphere.center);
                                        lightAabb[j].halfExtents.x = tempSphere.radius;
                                        lightAabb[j].halfExtents.y = tempSphere.radius;
                                        lightAabb[j].halfExtents.z = tempSphere.radius;
                                    }
                                    if (!lightAabb[j].intersects(aabb)) continue;
                                    staticLights.push(j);
                                }
                            }
                        }
                    }
                }

                if (staticLights.length === 0) {
                    newDrawCalls.push(drawCall);
                    continue;
                }

                mesh = drawCall.mesh;
                vertexBuffer = mesh.vertexBuffer;
                indexBuffer = mesh.indexBuffer[drawCall.renderStyle];
                indices = indexBuffer.bytesPerIndex === 2 ? new Uint16Array(indexBuffer.lock()) : new Uint32Array(indexBuffer.lock());
                numTris = mesh.primitive[drawCall.renderStyle].count / 3;
                baseIndex = mesh.primitive[drawCall.renderStyle].base;
                elems = vertexBuffer.format.elements;
                vertSize = vertexBuffer.format.size / 4; // / 4 because float
                verts = new Float32Array(vertexBuffer.storage);

                for (k = 0; k < elems.length; k++) {
                    if (elems[k].name === SEMANTIC_POSITION) {
                        offsetP = elems[k].offset / 4; // / 4 because float
                    }
                }

                // #ifdef PROFILER
                subTriAabbTime = now();
                // #endif

                triLightComb.length = numTris;
                for (k = 0; k < numTris; k++) {
                    // triLightComb[k] = ""; // uncomment to remove 32 lights limit
                    triLightComb[k] = 0; // comment to remove 32 lights limit
                }
                triLightCombUsed = false;

                triBounds.length = numTris * 6;
                for (k = 0; k < numTris; k++) {
                    minx = Number.MAX_VALUE;
                    miny = Number.MAX_VALUE;
                    minz = Number.MAX_VALUE;
                    maxx = -Number.MAX_VALUE;
                    maxy = -Number.MAX_VALUE;
                    maxz = -Number.MAX_VALUE;
                    for (v = 0; v < 3; v++) {
                        index = indices[k * 3 + v + baseIndex];
                        index = index * vertSize + offsetP;
                        _x = verts[index];
                        _y = verts[index + 1];
                        _z = verts[index + 2];
                        if (_x < minx) minx = _x;
                        if (_y < miny) miny = _y;
                        if (_z < minz) minz = _z;
                        if (_x > maxx) maxx = _x;
                        if (_y > maxy) maxy = _y;
                        if (_z > maxz) maxz = _z;
                    }
                    index = k * 6;
                    triBounds[index] = minx;
                    triBounds[index + 1] = miny;
                    triBounds[index + 2] = minz;
                    triBounds[index + 3] = maxx;
                    triBounds[index + 4] = maxy;
                    triBounds[index + 5] = maxz;
                }
                // #ifdef PROFILER
                triAabbTime += now() - subTriAabbTime;
                // #endif

                // #ifdef PROFILER
                subSearchTime = now();
                // #endif
                for (s = 0; s < staticLights.length; s++) {
                    j = staticLights[s];
                    light = lights[j];

                    invMatrix.copy(drawCall.node.worldTransform).invert();
                    localLightBounds.setFromTransformedAabb(lightAabb[j], invMatrix);
                    minv = localLightBounds.getMin();
                    maxv = localLightBounds.getMax();
                    bit = 1 << s;

                    for (k = 0; k < numTris; k++) {
                        index = k * 6;
                        if ((triBounds[index] <= maxv.x) && (triBounds[index + 3] >= minv.x) &&
                            (triBounds[index + 1] <= maxv.y) && (triBounds[index + 4] >= minv.y) &&
                            (triBounds[index + 2] <= maxv.z) && (triBounds[index + 5] >= minv.z)) {

                            // triLightComb[k] += j + "_";  // uncomment to remove 32 lights limit
                            triLightComb[k] |= bit; // comment to remove 32 lights limit
                            triLightCombUsed = true;
                        }
                    }
                }
                // #ifdef PROFILER
                searchTime += now() - subSearchTime;
                // #endif

                if (triLightCombUsed) {

                    // #ifdef PROFILER
                    subCombineTime = now();
                    // #endif

                    combIndices = {};
                    for (k = 0; k < numTris; k++) {
                        j = k * 3 + baseIndex; // can go beyond 0xFFFF if base was non-zero?
                        combIbName = triLightComb[k];
                        if (!combIndices[combIbName]) combIndices[combIbName] = [];
                        combIb = combIndices[combIbName];
                        combIb.push(indices[j]);
                        combIb.push(indices[j + 1]);
                        combIb.push(indices[j + 2]);
                    }

                    // #ifdef PROFILER
                    combineTime += now() - subCombineTime;
                    // #endif

                    // #ifdef PROFILER
                    subWriteMeshTime = now();
                    // #endif

                    for (combIbName in combIndices) {
                        combIb = combIndices[combIbName];
                        var ib = new IndexBuffer(device, indexBuffer.format, combIb.length, indexBuffer.usage);
                        var ib2 = ib.bytesPerIndex === 2 ? new Uint16Array(ib.lock()) : new Uint32Array(ib.lock());
                        ib2.set(combIb);
                        ib.unlock();

                        minx = Number.MAX_VALUE;
                        miny = Number.MAX_VALUE;
                        minz = Number.MAX_VALUE;
                        maxx = -Number.MAX_VALUE;
                        maxy = -Number.MAX_VALUE;
                        maxz = -Number.MAX_VALUE;
                        for (k = 0; k < combIb.length; k++) {
                            index = combIb[k];
                            _x = verts[index * vertSize + offsetP];
                            _y = verts[index * vertSize + offsetP + 1];
                            _z = verts[index * vertSize + offsetP + 2];
                            if (_x < minx) minx = _x;
                            if (_y < miny) miny = _y;
                            if (_z < minz) minz = _z;
                            if (_x > maxx) maxx = _x;
                            if (_y > maxy) maxy = _y;
                            if (_z > maxz) maxz = _z;
                        }
                        minVec.set(minx, miny, minz);
                        maxVec.set(maxx, maxy, maxz);
                        var chunkAabb = new BoundingBox();
                        chunkAabb.setMinMax(minVec, maxVec);

                        var mesh2 = new Mesh(device);
                        mesh2.vertexBuffer = vertexBuffer;
                        mesh2.indexBuffer[0] = ib;
                        mesh2.primitive[0].type = PRIMITIVE_TRIANGLES;
                        mesh2.primitive[0].base = 0;
                        mesh2.primitive[0].count = combIb.length;
                        mesh2.primitive[0].indexed = true;
                        mesh2.aabb = chunkAabb;

                        var instance = new MeshInstance(mesh2, drawCall.material, drawCall.node);
                        instance.isStatic = drawCall.isStatic;
                        instance.visible = drawCall.visible;
                        instance.layer = drawCall.layer;
                        instance.castShadow = drawCall.castShadow;
                        instance._receiveShadow = drawCall._receiveShadow;
                        instance.cull = drawCall.cull;
                        instance.pick = drawCall.pick;
                        instance.mask = drawCall.mask;
                        instance.parameters = drawCall.parameters;
                        instance._shaderDefs = drawCall._shaderDefs;
                        instance._staticSource = drawCall;

                        if (drawCall._staticLightList) {
                            instance._staticLightList = drawCall._staticLightList; // add forced assigned lights
                        } else {
                            instance._staticLightList = [];
                        }

                        // uncomment to remove 32 lights limit
                        // var lnames = combIbName.split("_");
                        // lnames.length = lnames.length - 1;
                        // for(k = 0; k < lnames.length; k++) {
                        //     instance._staticLightList[k] = lights[parseInt(lnames[k])];
                        // }

                        // comment to remove 32 lights limit
                        for (k = 0; k < staticLights.length; k++) {
                            bit = 1 << k;
                            if (combIbName & bit) {
                                lht = lights[staticLights[k]];
                                if (instance._staticLightList.indexOf(lht) < 0) {
                                    instance._staticLightList.push(lht);
                                }
                            }
                        }

                        instance._staticLightList.sort(this.lightCompare);

                        newDrawCalls.push(instance);
                    }

                    // #ifdef PROFILER
                    writeMeshTime += now() - subWriteMeshTime;
                    // #endif
                } else {
                    newDrawCalls.push(drawCall);
                }
            }
        }
        // Set array to new
        meshInstances.length = newDrawCalls.length;
        for (i = 0; i < newDrawCalls.length; i++) {
            meshInstances[i] = newDrawCalls[i];
        }
        // #ifdef PROFILER
        scene._stats.lastStaticPrepareFullTime = now() - prepareTime;
        scene._stats.lastStaticPrepareSearchTime = searchTime;
        scene._stats.lastStaticPrepareWriteTime = writeMeshTime;
        scene._stats.lastStaticPrepareTriAabbTime = triAabbTime;
        scene._stats.lastStaticPrepareCombineTime = combineTime;
        // #endif
    }

    updateShaders(drawCalls) {
        var mat, count = drawCalls.length;
        for (var i = 0; i < count; i++) {
            mat = drawCalls[i].material;
            if (mat) {
                // material not processed yet
                if (!_tempMaterialSet.has(mat)) {
                    _tempMaterialSet.add(mat);

                    if (mat.updateShader !== Material.prototype.updateShader) {
                        mat.clearVariants();
                        mat.shader = null;
                    }
                }
            }
        }

        // keep temp set empty
        _tempMaterialSet.clear();
    }

    updateLitShaders(drawCalls) {
        var mat, count = drawCalls.length;
        for (var i = 0; i < count; i++) {
            mat = drawCalls[i].material;
            if (mat) {
                // material not processed yet
                if (!_tempMaterialSet.has(mat)) {
                    _tempMaterialSet.add(mat);

                    if (mat.updateShader !== Material.prototype.updateShader) {

                        // only process lit materials
                        if (mat.useLighting && (!mat.emitter || mat.emitter.lighting)) {
                            mat.clearVariants();
                            mat.shader = null;
                        }
                    }
                }
            }
        }

        // keep temp set empty
        _tempMaterialSet.clear();
    }

    beginFrame(comp) {
        var scene = this.scene;
        var meshInstances = comp._meshInstances;
        var lights = comp._lights;

        // Update shaders if needed
        // all mesh instances (TODO: ideally can update less if only lighting changed)
        if (scene.updateShaders) {
            this.updateShaders(meshInstances);
            scene.updateShaders = false;
            scene.updateLitShaders = false;
            scene._shaderVersion++;
        } else if (scene.updateLitShaders) {
            this.updateLitShaders(meshInstances);
            scene.updateLitShaders = false;
            scene._shaderVersion++;
        }

        // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
        this.updateCpuSkinMatrices(meshInstances);

        var i;
        var len = meshInstances.length;
        for (i = 0; i < len; i++) {
            meshInstances[i].visibleThisFrame = false;
        }

        len = lights.length;
        for (i = 0; i < len; i++) {
            lights[i].visibleThisFrame = lights[i]._type === LIGHTTYPE_DIRECTIONAL;
        }
    }

    beginLayers(comp) {
        var scene = this.scene;
        var len = comp.layerList.length;
        var layer;
        var i, j;
        var shaderVersion = this.scene._shaderVersion;
        for (i = 0; i < len; i++) {
            comp.layerList[i]._postRenderCounter = 0;
        }
        var transparent;
        for (i = 0; i < len; i++) {
            layer = comp.layerList[i];
            layer._shaderVersion = shaderVersion;
            // #ifdef PROFILER
            layer._skipRenderCounter = 0;
            layer._forwardDrawCalls = 0;
            layer._shadowDrawCalls = 0;
            layer._renderTime = 0;
            // #endif

            layer._preRenderCalledForCameras = 0;
            layer._postRenderCalledForCameras = 0;
            transparent = comp.subLayerList[i];
            if (transparent) {
                layer._postRenderCounter |= 2;
            } else {
                layer._postRenderCounter |= 1;
            }
            layer._postRenderCounterMax = layer._postRenderCounter;

            for (j = 0; j < layer.cameras.length; j++) {
                // Create visible arrays for every camera inside each layer if not present
                if (!layer.instances.visibleOpaque[j]) layer.instances.visibleOpaque[j] = new VisibleInstanceList();
                if (!layer.instances.visibleTransparent[j]) layer.instances.visibleTransparent[j] = new VisibleInstanceList();
                // Mark visible arrays as not processed yet
                layer.instances.visibleOpaque[j].done = false;
                layer.instances.visibleTransparent[j].done = false;
            }

            // remove visible lists if cameras have been removed, remove one per frame
            if (layer.cameras.length < layer.instances.visibleOpaque.length) {
                layer.instances.visibleOpaque.splice(layer.cameras.length, 1);
            }

            if (layer.cameras.length < layer.instances.visibleTransparent.length) {
                layer.instances.visibleTransparent.splice(layer.cameras.length, 1);
            }

            // Generate static lighting for meshes in this layer if needed
            if (layer._needsStaticPrepare && layer._staticLightHash) {
                // TODO: reuse with the same staticLightHash
                if (layer._staticPrepareDone) {
                    this.revertStaticMeshes(layer.opaqueMeshInstances);
                    this.revertStaticMeshes(layer.transparentMeshInstances);
                }
                this.prepareStaticMeshes(layer.opaqueMeshInstances, layer._lights);
                this.prepareStaticMeshes(layer.transparentMeshInstances, layer._lights);
                comp._dirty = true;
                scene.updateShaders = true;
                layer._needsStaticPrepare = false;
                layer._staticPrepareDone = true;
            }
        }
    }

    cullLocalShadowmap(light, drawCalls) {
        var i, type, shadowCam, shadowCamNode, passes, pass, numInstances, meshInstance, visibleList, vlen, visible;
        var lightNode;
        type = light._type;
        if (type === LIGHTTYPE_DIRECTIONAL) return;
        light.visibleThisFrame = true; // force light visibility if function was manually called

        shadowCam = this.getShadowCamera(this.device, light);

        shadowCam.projection = PROJECTION_PERSPECTIVE;
        shadowCam.nearClip = light.attenuationEnd / 1000;
        shadowCam.farClip = light.attenuationEnd;
        shadowCam.aspectRatio = 1;
        if (type === LIGHTTYPE_SPOT) {
            shadowCam.fov = light._outerConeAngle * 2;
            passes = 1;
        } else {
            shadowCam.fov = 90;
            passes = 6;
        }
        shadowCamNode = shadowCam._node;
        lightNode = light._node;
        shadowCamNode.setPosition(lightNode.getPosition());
        if (type === LIGHTTYPE_SPOT) {
            shadowCamNode.setRotation(lightNode.getRotation());
            shadowCamNode.rotateLocal(-90, 0, 0); // Camera's look down negative Z, and directional lights point down negative Y // TODO: remove eulers
        }

        for (pass = 0; pass < passes; pass++) {
            if (type === LIGHTTYPE_OMNI) {
                shadowCamNode.setRotation(pointLightRotations[pass]);
                shadowCam.renderTarget = light._shadowCubeMap[pass];
            }

            this.updateCameraFrustum(shadowCam);

            visibleList = light._visibleList[pass];
            if (!visibleList) {
                visibleList = light._visibleList[pass] = [];
            }
            light._visibleLength[pass] = 0;
            vlen = 0;
            for (i = 0, numInstances = drawCalls.length; i < numInstances; i++) {
                meshInstance = drawCalls[i];
                visible = true;
                if (meshInstance.cull) {
                    visible = meshInstance._isVisible(shadowCam);
                }
                if (visible) {
                    visibleList[vlen] = meshInstance;
                    vlen++;
                    meshInstance.visibleThisFrame = true;
                }
            }
            light._visibleLength[pass] = vlen;

            if (visibleList.length !== vlen) {
                visibleList.length = vlen;
            }
            visibleList.sort(this.depthSortCompare); // sort shadowmap drawcalls here, not in render
        }
    }

    cullDirectionalShadowmap(light, drawCalls, camera, pass) {
        var i, shadowCam, shadowCamNode, lightNode, frustumSize, vlen, visibleList;
        var unitPerTexel, delta, p;
        var minx, miny, minz, maxx, maxy, maxz, centerx, centery;
        var visible, numInstances;
        var meshInstance;
        var emptyAabb;
        var drawCallAabb;
        var device = this.device;
        light.visibleThisFrame = true; // force light visibility if function was manually called

        shadowCam = this.getShadowCamera(device, light);
        shadowCamNode = shadowCam._node;
        lightNode = light._node;

        shadowCamNode.setPosition(lightNode.getPosition());
        shadowCamNode.setRotation(lightNode.getRotation());
        shadowCamNode.rotateLocal(-90, 0, 0); // Camera's look down negative Z, and directional lights point down negative Y

        // Positioning directional light frustum I
        // Construct light's orthographic frustum around camera frustum
        // Use very large near/far planes this time

        // 1. Get the frustum of the camera
        _getFrustumPoints(camera, light.shadowDistance || camera._farClip, frustumPoints);

        // 2. Figure out the maximum diagonal of the frustum in light's projected space.
        frustumSize = frustumDiagonal.sub2( frustumPoints[0], frustumPoints[6] ).length();
        frustumSize = Math.max( frustumSize, frustumDiagonal.sub2( frustumPoints[4], frustumPoints[6] ).length() );

        // 3. Transform the 8 corners of the camera frustum into the shadow camera's view space
        shadowCamView.copy( shadowCamNode.getWorldTransform() ).invert();
        c2sc.copy( shadowCamView ).mul( camera._node.getWorldTransform() );
        for (i = 0; i < 8; i++) {
            c2sc.transformPoint(frustumPoints[i], frustumPoints[i]);
        }

        // 4. Come up with a bounding box (in light-space) by calculating the min
        // and max X, Y, and Z values from your 8 light-space frustum coordinates.
        minx = miny = minz = 1000000;
        maxx = maxy = maxz = -1000000;
        for (i = 0; i < 8; i++) {
            p = frustumPoints[i];
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
        unitPerTexel = frustumSize / light._shadowResolution;
        delta = (frustumSize - (maxx - minx)) * 0.5;
        minx = Math.floor( (minx - delta) / unitPerTexel ) * unitPerTexel;
        delta = (frustumSize - (maxy - miny)) * 0.5;
        miny = Math.floor( (miny - delta) / unitPerTexel ) * unitPerTexel;
        maxx = minx + frustumSize;
        maxy = miny + frustumSize;

        // 6. Use your min and max values to create an off-center orthographic projection.
        centerx = (maxx + minx) * 0.5;
        centery = (maxy + miny) * 0.5;
        shadowCamNode.translateLocal(centerx, centery, 100000);

        shadowCam.projection = PROJECTION_ORTHOGRAPHIC;
        shadowCam.nearClip = 0;
        shadowCam.farClip = 200000;
        shadowCam.aspectRatio = 1; // The light's frustum is a cuboid.
        shadowCam.orthoHeight = frustumSize * 0.5;

        this.updateCameraFrustum(shadowCam);

        // Cull shadow casters and find their AABB
        emptyAabb = true;
        visibleList = light._visibleList[pass];
        if (!visibleList) {
            visibleList = light._visibleList[pass] = [];
        }
        vlen = light._visibleLength[pass] = 0;

        for (i = 0, numInstances = drawCalls.length; i < numInstances; i++) {
            meshInstance = drawCalls[i];
            visible = true;
            if (meshInstance.cull) {
                visible = meshInstance._isVisible(shadowCam);
            }
            if (visible) {
                visibleList[vlen] = meshInstance;
                vlen++;
                meshInstance.visibleThisFrame = true;

                drawCallAabb = meshInstance.aabb;
                if (emptyAabb) {
                    visibleSceneAabb.copy(drawCallAabb);
                    emptyAabb = false;
                } else {
                    visibleSceneAabb.add(drawCallAabb);
                }
            }
        }
        light._visibleLength[pass] = vlen;

        if (visibleList.length !== vlen) {
            visibleList.length = vlen;
        }
        visibleList.sort(this.depthSortCompare); // sort shadowmap drawcalls here, not in render

        // Positioning directional light frustum II
        // Fit clipping planes tightly around visible shadow casters

        // 1. Calculate minz/maxz based on casters' AABB
        var z = _getZFromAABBSimple( shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax(), minx, maxx, miny, maxy );

        // Always use the scene's aabb's Z value
        // Otherwise object between the light and the frustum won't cast shadow.
        maxz = z.max;
        if (z.min > minz) minz = z.min;

        // 2. Fix projection
        shadowCamNode.setPosition(lightNode.getPosition());
        shadowCamNode.translateLocal(centerx, centery, maxz + directionalShadowEpsilon);
        shadowCam.farClip = maxz - minz;

        // Save projection variables to use in rendering later
        var settings = light._visibleCameraSettings[pass];
        if (!settings) {
            settings = light._visibleCameraSettings[pass] = {};
        }
        var lpos = shadowCamNode.getPosition();
        settings.x = lpos.x;
        settings.y = lpos.y;
        settings.z = lpos.z;
        settings.orthoHeight = shadowCam.orthoHeight;
        settings.farClip = shadowCam.farClip;
    }

    gpuUpdate(drawCalls) {
        // skip everything with visibleThisFrame === false
        this.updateGpuSkinMatrices(drawCalls);
        this.updateMorphing(drawCalls);
    }

    setSceneConstants() {
        var i;
        var device = this.device;
        var scene = this.scene;

        // Set up ambient/exposure
        this.dispatchGlobalLights(scene);

        // Set up the fog
        if (scene.fog !== FOG_NONE) {
            this.fogColor[0] = scene.fogColor.r;
            this.fogColor[1] = scene.fogColor.g;
            this.fogColor[2] = scene.fogColor.b;
            if (scene.gammaCorrection) {
                for (i = 0; i < 3; i++) {
                    this.fogColor[i] = Math.pow(this.fogColor[i], 2.2);
                }
            }
            this.fogColorId.setValue(this.fogColor);
            if (scene.fog === FOG_LINEAR) {
                this.fogStartId.setValue(scene.fogStart);
                this.fogEndId.setValue(scene.fogEnd);
            } else {
                this.fogDensityId.setValue(scene.fogDensity);
            }
        }

        // Set up screen size // should be RT size?
        this._screenSize[0] = device.width;
        this._screenSize[1] = device.height;
        this._screenSize[2] = 1 / device.width;
        this._screenSize[3] = 1 / device.height;
        this.screenSizeId.setValue(this._screenSize);
    }

    updateLightStats(comp, compUpdatedFlags) {

        // #ifdef PROFILER
        if (compUpdatedFlags & COMPUPDATED_LIGHTS || !this.scene._statsUpdated) {
            var stats = this.scene._stats;
            stats.lights = comp._lights.length;
            stats.dynamicLights = 0;
            stats.bakedLights = 0;
            var l;
            for (var i = 0; i < stats.lights; i++) {
                l = comp._lights[i];
                if (l.enabled) {
                    if ((l.mask & MASK_DYNAMIC) || (l.mask & MASK_BAKED)) { // if affects dynamic or baked objects in real-time
                        stats.dynamicLights++;
                    }
                    if (l.mask & MASK_LIGHTMAP) { // if baked into lightmaps
                        stats.bakedLights++;
                    }
                }
            }
        }

        if (compUpdatedFlags & COMPUPDATED_INSTANCES || !this.scene._statsUpdated) {
            this.scene._stats.meshInstances = comp._meshInstances.length;
        }

        this.scene._statsUpdated = true;
        // #endif
    }

    renderComposition(comp) {
        var device = this.device;
        var camera;
        var renderAction, renderActions = comp._renderActions;
        var i, layer, layerIndex, transparent;

        // update the skybox, since this might change _meshInstances
        if (this.scene.updateSkybox) {
            this.scene._updateSkybox(device);
            this.scene.updateSkybox = false;
        }

        this.beginLayers(comp);

        // #ifdef PROFILER
        var layerCompositionUpdateTime = now();
        // #endif

        // Update static layer data, if something's changed
        var updated = comp._update();
        if (updated & COMPUPDATED_LIGHTS) {
            this.scene.updateLitShaders = true;
        }

        // #ifdef PROFILER
        this._layerCompositionUpdateTime += now() - layerCompositionUpdateTime;
        // #endif

        this.updateLightStats(comp, updated);

        // Single per-frame calculations
        this.beginFrame(comp);
        this.setSceneConstants();

        // Camera culling (once for each camera + layer)
        // Also applies meshInstance.visible and camera.cullingMask
        var cameraPass;
        var objects, drawCalls, visible;

        for (i = 0; i < renderActions.length; i++) {
            renderAction = renderActions[i];

            // layer
            layerIndex = renderAction.layerIndex;
            layer = comp.layerList[layerIndex];
            if (!layer.enabled || !comp.subLayerEnabled[layerIndex]) continue;
            transparent = comp.subLayerList[layerIndex];

            // camera
            cameraPass = renderAction.cameraIndex;
            camera = layer.cameras[cameraPass];
            if (!camera) continue;
            camera.frameBegin(renderAction.renderTarget);

            // update camera frustum once
            if (renderAction.firstCameraUse) {
                this.updateCameraFrustum(camera.camera);
                this._camerasRendered++;
            }

            // cull each layer's non-directional lights once with each camera
            // lights aren't collected anywhere, but marked as visible
            this.cullLights(camera.camera, layer._lights);

            // cull mesh instances
            objects = layer.instances;

            // collect them into layer arrays
            visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

            // shared objects are only culled once
            if (!visible.done) {

                if (layer.onPreCull) {
                    layer.onPreCull(cameraPass);
                }

                drawCalls = transparent ? layer.transparentMeshInstances : layer.opaqueMeshInstances;
                visible.length = this.cull(camera.camera, drawCalls, visible.list);
                visible.done = true;

                if (layer.onPostCull) {
                    layer.onPostCull(cameraPass);
                }
            }

            camera.frameEnd();
        }

        // Shadowmap culling for directional and visible local lights
        // collected into light._visibleList
        // objects are also globally marked as visible
        // Also sets up local shadow camera matrices
        var light, casters;

        // #ifdef PROFILER
        var cullTime = now();
        // #endif

        // Local light casters - culled once for the whole frame
        for (i = 0; i < comp._lights.length; i++) {
            light = comp._lights[i];
            if (!light.visibleThisFrame) continue;
            if (light._type === LIGHTTYPE_DIRECTIONAL) continue;
            if (!light.castShadows || !light.enabled || light.shadowUpdateMode === SHADOWUPDATE_NONE) continue;
            casters = comp._lightShadowCasters[i];
            this.cullLocalShadowmap(light, casters);
        }

        // Directional light casters - culled once for each camera
        var globalLightCounter = -1;
        for (i = 0; i < comp._lights.length; i++) {
            light = comp._lights[i];
            if (light._type !== LIGHTTYPE_DIRECTIONAL) continue;
            globalLightCounter++;
            if (!light.castShadows || !light.enabled || light.shadowUpdateMode === SHADOWUPDATE_NONE) continue;
            casters = comp._lightShadowCasters[i];
            let cameras = comp._globalLightCameras[globalLightCounter];
            for (let j = 0; j < cameras.length; j++) {
                this.cullDirectionalShadowmap(light, casters, cameras[j].camera, comp._globalLightCameraIds[globalLightCounter][j]);
            }
        }

        // #ifdef PROFILER
        this._cullTime += now() - cullTime;
        // #endif

        // Can call script callbacks here and tell which objects are visible

        // GPU update for all visible objects
        this.gpuUpdate(comp._meshInstances);

        // Shadow render for all local visible culled lights
        this.renderShadows(comp._splitLights[LIGHTTYPE_SPOT]);
        this.renderShadows(comp._splitLights[LIGHTTYPE_OMNI]);

        // Rendering
        var sortTime, draws, drawTime;
        for (i = 0; i < renderActions.length; i++) {
            renderAction = renderActions[i];

            // layer
            layerIndex = renderAction.layerIndex;
            layer = comp.layerList[layerIndex];
            if (!layer.enabled || !comp.subLayerEnabled[layerIndex]) continue;
            transparent = comp.subLayerList[layerIndex];

            cameraPass = renderAction.cameraIndex;
            camera = layer.cameras[cameraPass];

            // #ifdef DEBUG
            this.device.pushMarker(camera ? camera.entity.name : "noname");
            this.device.pushMarker(layer.name);
            // #endif

            // #ifdef PROFILER
            drawTime = now();
            // #endif

            if (camera) camera.frameBegin(renderAction.renderTarget);

            // Call prerender callback if there's one
            if (!transparent && layer.onPreRenderOpaque) {
                layer.onPreRenderOpaque(cameraPass);
            } else if (transparent && layer.onPreRenderTransparent) {
                layer.onPreRenderTransparent(cameraPass);
            }

            // Called for the first sublayer and for every camera
            if (!(layer._preRenderCalledForCameras & (1 << cameraPass))) {
                if (layer.onPreRender) {
                    layer.onPreRender(cameraPass);
                }
                layer._preRenderCalledForCameras |= 1 << cameraPass;
            }

            if (camera) {

                // clear buffers
                if (renderAction.clearColor || renderAction.clearDepth || renderAction.clearStencil) {

                    // TODO: refactor clearView to accept flags from renderAction directly as well
                    const backupColor = camera.camera._clearColorBuffer;
                    const backupDepth = camera.camera._clearDepthBuffer;
                    const backupStencil = camera.camera._clearStencilBuffer;

                    camera.camera._clearColorBuffer = renderAction.clearColor;
                    camera.camera._clearDepthBuffer = renderAction.clearDepth;
                    camera.camera._clearStencilBuffer = renderAction.clearStencil;

                    this.clearView(camera.camera, renderAction.renderTarget, true, true);

                    camera.camera._clearColorBuffer = backupColor;
                    camera.camera._clearDepthBuffer = backupDepth;
                    camera.camera._clearStencilBuffer = backupStencil;
                }

                // #ifdef PROFILER
                draws = this._shadowDrawCalls;
                // #endif

                // Render directional shadows once for each camera (will reject more than 1 attempt in this function)
                this.renderShadows(layer._splitLights[LIGHTTYPE_DIRECTIONAL], cameraPass);

                // #ifdef PROFILER
                layer._shadowDrawCalls += this._shadowDrawCalls - draws;
                // #endif

                // #ifdef PROFILER
                sortTime = now();
                // #endif

                layer._sortVisible(transparent, camera.camera.node, cameraPass);

                 // #ifdef PROFILER
                this._sortTime += now() - sortTime;
                 // #endif

                objects = layer.instances;
                visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

                // Set the not very clever global variable which is only useful when there's just one camera
                this.scene._activeCamera = camera.camera;

                // Set camera shader constants, viewport, scissor, render target
                this.setCamera(camera.camera, renderAction.renderTarget);

                // #ifdef PROFILER
                draws = this._forwardDrawCalls;
                // #endif
                this.renderForward(camera.camera,
                                   visible.list,
                                   visible.length,
                                   layer._splitLights,
                                   layer.shaderPass,
                                   layer.cullingMask,
                                   layer.onDrawCall,
                                   layer);
                // #ifdef PROFILER
                layer._forwardDrawCalls += this._forwardDrawCalls - draws;
                // #endif

                // Revert temp frame stuff
                device.setColorWrite(true, true, true, true);
                device.setStencilTest(false); // don't leak stencil state
                device.setAlphaToCoverage(false); // don't leak a2c state
                device.setDepthBias(false);

                camera.frameEnd();

                // trigger postprocessing for camera
                if (renderAction.triggerPostprocess && camera.onPostprocessing) {
                    camera.onPostprocessing(camera);
                }
            }

            // Call postrender callback if there's one
            if (!transparent && layer.onPostRenderOpaque) {
                layer.onPostRenderOpaque(cameraPass);
            } else if (transparent && layer.onPostRenderTransparent) {
                layer.onPostRenderTransparent(cameraPass);
            }
            if (layer.onPostRender && !(layer._postRenderCalledForCameras & (1 << cameraPass))) {
                layer._postRenderCounter &= ~(transparent ? 2 : 1);
                if (layer._postRenderCounter === 0) {
                    layer.onPostRender(cameraPass);
                    layer._postRenderCalledForCameras |= 1 << cameraPass;
                    layer._postRenderCounter = layer._postRenderCounterMax;
                }
            }

            // #ifdef DEBUG
            this.device.popMarker();
            this.device.popMarker();
            // #endif

            // #ifdef PROFILER
            layer._renderTime += now() - drawTime;
            // #endif
        }
    }
}

export { ForwardRenderer };
