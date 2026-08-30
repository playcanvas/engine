import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import {
    ADDRESS_CLAMP_TO_EDGE, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC_ALPHA, BLENDMODE_ZERO,
    FILTER_LINEAR, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { LIGHTFALLOFF_LINEAR, LIGHTTYPE_SPOT, shadowTypeInfo } from '../../scene/constants.js';
import { LightCamera } from '../../scene/renderer/light-camera.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslVolumetricFogPS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/volumetricFog.js';
import wgslVolumetricFogPS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/volumetricFog.js';
import glslVolumetricFogCombinePS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/volumetricFogCombine.js';
import wgslVolumetricFogCombinePS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/volumetricFogCombine.js';
import glslVolumetricFogLocalPS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/volumetricFogLocal.js';
import wgslVolumetricFogLocalPS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/volumetricFogLocal.js';
import glslVolumetricFogLocalVS from '../../scene/shader-lib/glsl/chunks/render-pass/vert/volumetricFogLocal.js';
import wgslVolumetricFogLocalVS from '../../scene/shader-lib/wgsl/chunks/render-pass/vert/volumetricFogLocal.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Light, LightRenderData } from '../../scene/light.js'
 * @import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js'
 */

const _tempDir = new Vec3();
const _tempVec3 = new Vec3();
const _tempSphere = new BoundingSphere();
const _tempCorner = new Vec4();
const _tempProjected = new Vec4();
const _tempRect = new Vec4();

// cookie channel mask matching the channel selection of the light
const _cookieChannelMasks = {
    'rrr': [1, 0, 0, 0],
    'ggg': [0, 1, 0, 0],
    'bbb': [0, 0, 1, 0],
    'aaa': [0, 0, 0, 1],
    'rgb': [1, 1, 1, 0]
};

// mask assigned for a light which does not use a cookie, as the uniform is still declared
const _cookieChannelMaskNone = [0, 0, 0, 0];

/**
 * Render pass implementing the volumetric fog raymarch. Renders in-scattered light (rgb) and
 * transmittance (a) into a reduced resolution texture, sampling the directional light's cascaded
 * shadow map along the ray.
 *
 * @ignore
 */
class RenderPassVolumetricFog extends RenderPassShaderQuad {
    /** @type {Light|null} */
    light = null;

    shadowsEnabled = false;

    /**
     * The shadow data of the light for the fog camera, when the shadow map is available.
     *
     * @type {LightRenderData|null}
     */
    lightRenderData = null;

    tint = new Color(1, 1, 1);

    density = 0.01;

    heightBase = 0;

    heightFalloff = 0.05;

    extinction = 1;

    anisotropy = 0.6;

    intensity = 1;

    ambientColor = new Color(1, 1, 1);

    ambientIntensity = 0.02;

    maxDistance = 300;

    steps = 24;

    noiseOffset = 0;

    exposure = 1;

    /** @type {string|null} */
    _variantKey = null;

    constructor(device, cameraComponent) {
        super(device);
        this.cameraComponent = cameraComponent;

        const scope = device.scope;
        this.cameraPosId = scope.resolve('uFogCameraPos');
        this.cameraFwdId = scope.resolve('uFogCameraFwd');
        this.invViewId = scope.resolve('uFogInvView');
        this.projScaleId = scope.resolve('uFogProjScale');
        this.tintId = scope.resolve('uFogTint');
        this.lightColorId = scope.resolve('uFogLightColor');
        this.lightDirId = scope.resolve('uFogLightDir');
        this.ambientId = scope.resolve('uFogAmbient');
        this.fogParamsId = scope.resolve('uFogParams');
        this.scatterParamsId = scope.resolve('uFogScatterParams');
        this.extinctionId = scope.resolve('uFogExtinction');
        this.shadowMapId = scope.resolve('uFogShadowMap');
        this.shadowMatrixPaletteId = scope.resolve('uFogShadowMatrixPalette[0]');
        this.shadowCascadeDistancesId = scope.resolve('uFogShadowCascadeDistances');
        this.shadowParamsId = scope.resolve('uFogShadowParams');

        this._cameraPos = new Float32Array(3);
        this._cameraFwd = new Float32Array(3);
        this._projScale = new Float32Array(2);
        this._tint = new Float32Array(3);
        this._lightColor = new Float32Array(3);
        this._lightDir = new Float32Array(3);
        this._ambient = new Float32Array(3);
        this._fogParams = new Float32Array(4);
        this._scatterParams = new Float32Array(4);
        this._shadowParams = new Float32Array(4);
    }

    /**
     * Creates the shader matching the shadow sampling requirements, when those change.
     *
     * @param {boolean} shadows - True if the shadow map should be sampled.
     * @param {boolean} pcf - True if the shadow map is a depth format texture using hardware
     * comparison, false when it stores depth in a color texture (PCSS / VSM).
     */
    updateShaderVariant(shadows, pcf) {

        const depthKey = ShaderUtils.getScreenDepthChunkKey(this.cameraComponent.shaderParams);
        const key = `${shadows}-${pcf}${depthKey}`;
        if (this._variantKey !== key) {
            this._variantKey = key;

            const defines = new Map();
            ShaderUtils.addScreenDepthChunkDefines(this.cameraComponent.shaderParams, defines);
            if (shadows) defines.set('FOG_SHADOWS', '');
            if (pcf) defines.set('FOG_SHADOW_PCF', '');

            this.shader = ShaderUtils.createShader(this.device, {
                uniqueName: `VolumetricFogShader-${key}`,
                attributes: { aPosition: SEMANTIC_POSITION },
                vertexChunk: 'quadVS',
                fragmentChunk: 'volumetricFogPS',
                fragmentDefines: defines
            });
        }
    }

    execute() {

        const { light } = this;
        const camera = this.cameraComponent.camera;
        const node = camera._node;

        // camera ray reconstruction
        this.invViewId.setValue(node.getWorldTransform().data);

        const pos = node.getPosition();
        this._cameraPos[0] = pos.x;
        this._cameraPos[1] = pos.y;
        this._cameraPos[2] = pos.z;
        this.cameraPosId.setValue(this._cameraPos);

        const fwd = node.forward;
        this._cameraFwd[0] = fwd.x;
        this._cameraFwd[1] = fwd.y;
        this._cameraFwd[2] = fwd.z;
        this.cameraFwdId.setValue(this._cameraFwd);

        const projData = camera.projectionMatrix.data;
        this._projScale[0] = 1 / projData[0];
        this._projScale[1] = 1 / projData[5];
        this.projScaleId.setValue(this._projScale);

        // light, scaled by the scene exposure to match the lit scene
        const lightScale = this.intensity * this.exposure;
        if (light) {
            // direction towards the light - directional lights shine down their negative Y axis
            light._node.getWorldTransform().getY(_tempDir).normalize();
            this._lightDir[0] = _tempDir.x;
            this._lightDir[1] = _tempDir.y;
            this._lightDir[2] = _tempDir.z;

            const color = light._colorLinear;
            this._lightColor[0] = color[0] * lightScale;
            this._lightColor[1] = color[1] * lightScale;
            this._lightColor[2] = color[2] * lightScale;
        } else {
            this._lightDir[0] = 0;
            this._lightDir[1] = 1;
            this._lightDir[2] = 0;
            this._lightColor[0] = 0;
            this._lightColor[1] = 0;
            this._lightColor[2] = 0;
        }
        this.lightDirId.setValue(this._lightDir);
        this.lightColorId.setValue(this._lightColor);

        if (this.shadowsEnabled && light && this.lightRenderData) {
            const lightRenderData = this.lightRenderData;
            const biases = light._getUniformBiasValues(lightRenderData);

            this.shadowMapId.setValue(lightRenderData.shadowBuffer);
            this.shadowMatrixPaletteId.setValue(light._shadowMatrixPalette);
            this.shadowCascadeDistancesId.setValue(light._shadowCascadeDistances);

            this._shadowParams[0] = light.numCascades;
            this._shadowParams[1] = biases.bias;
            this._shadowParams[2] = 0;
            this._shadowParams[3] = light.shadowDistance;
            this.shadowParamsId.setValue(this._shadowParams);
        }

        // fog parameters
        const { tint, ambientColor, ambientIntensity } = this;
        this._tint[0] = tint.r;
        this._tint[1] = tint.g;
        this._tint[2] = tint.b;
        this.tintId.setValue(this._tint);

        const ambientScale = ambientIntensity * this.exposure;
        this._ambient[0] = ambientColor.r * ambientScale;
        this._ambient[1] = ambientColor.g * ambientScale;
        this._ambient[2] = ambientColor.b * ambientScale;
        this.ambientId.setValue(this._ambient);

        this._fogParams[0] = this.density;
        this._fogParams[1] = this.heightBase;
        this._fogParams[2] = this.heightFalloff;
        this._fogParams[3] = this.maxDistance;
        this.fogParamsId.setValue(this._fogParams);

        this.extinctionId.setValue(this.extinction);

        this._scatterParams[0] = this.anisotropy;
        this._scatterParams[1] = this.steps;
        this._scatterParams[2] = this.noiseOffset;
        this._scatterParams[3] = light ? light.shadowIntensity : 1;
        this.scatterParamsId.setValue(this._scatterParams);

        super.execute();
    }
}

/**
 * Render pass adding the light scattered by the clustered omni and spot lights into the volumetric
 * fog texture. Each light is rendered as a separate quad covering the screen space bounds of its
 * volume, and the ray of each of its pixels is marched only over the part of it which is inside the
 * light volume.
 *
 * @ignore
 */
class RenderPassVolumetricFogLocal extends RenderPassShaderQuad {
    /**
     * The forward pass rendering the scene, used to obtain the light clusters of the layers the
     * camera renders, and with it the list of the lights lighting the scene.
     *
     * @type {RenderPassForward|null}
     */
    scenePass = null;

    /**
     * True when the omni lights of the cluster scatter light in the fog.
     */
    omniLights = true;

    /**
     * True when the spot lights of the cluster scatter light in the fog.
     */
    spotLights = true;

    tint = new Color(1, 1, 1);

    density = 0.01;

    heightBase = 0;

    heightFalloff = 0.05;

    extinction = 1;

    anisotropy = 0.6;

    intensity = 1;

    maxDistance = 300;

    steps = 12;

    noiseOffset = 0;

    exposure = 1;

    /** @type {string|null} */
    _variantKey = null;

    constructor(device, cameraComponent) {
        super(device);
        this.cameraComponent = cameraComponent;

        // in-scattered light is added to the fog texture, the transmittance it stores in alpha is
        // written by the directional pass and is preserved
        this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE,
            BLENDEQUATION_ADD, BLENDMODE_ZERO, BLENDMODE_ONE);

        const scope = device.scope;
        this.cameraPosId = scope.resolve('uVolCameraPos');
        this.cameraFwdId = scope.resolve('uVolCameraFwd');
        this.invViewId = scope.resolve('uVolInvView');
        this.projScaleId = scope.resolve('uVolProjScale');
        this.tintId = scope.resolve('uVolTint');
        this.fogParamsId = scope.resolve('uVolFogParams');
        this.marchParamsId = scope.resolve('uVolMarchParams');

        this.lightRectId = scope.resolve('uVolLightRect');
        this.lightPosRangeId = scope.resolve('uVolLightPosRange');
        this.lightSphereId = scope.resolve('uVolLightSphere');
        this.lightColorId = scope.resolve('uVolLightColor');
        this.lightDirId = scope.resolve('uVolLightDir');
        this.lightSpotId = scope.resolve('uVolLightSpot');
        this.lightAttenId = scope.resolve('uVolLightAtten');
        this.lightProjMatrixId = scope.resolve('uVolLightProjMatrix');
        this.lightAtlasId = scope.resolve('uVolLightAtlas');
        this.lightCookieChannelId = scope.resolve('uVolLightCookieChannel');

        this._cameraPos = new Float32Array(3);
        this._cameraFwd = new Float32Array(3);
        this._projScale = new Float32Array(2);
        this._tint = new Float32Array(3);
        this._fogParams = new Float32Array(4);
        this._marchParams = new Float32Array(4);
        this._lightRect = new Float32Array(4);
        this._lightPosRange = new Float32Array(4);
        this._lightSphere = new Float32Array(4);
        this._lightColor = new Float32Array(3);
        this._lightDir = new Float32Array(4);
        this._lightSpot = new Float32Array(4);
        this._lightAtten = new Float32Array(4);
        this._lightAtlas = new Float32Array(4);
    }

    /**
     * Creates the shader matching the enabled clustered lighting features, when those change.
     *
     * @param {boolean} shadows - True if the lights can sample the shadow atlas.
     * @param {boolean} cookies - True if the lights can sample the cookie atlas.
     */
    updateShaderVariant(shadows, cookies) {

        const depthKey = ShaderUtils.getScreenDepthChunkKey(this.cameraComponent.shaderParams);
        const key = `${shadows}-${cookies}${depthKey}`;
        if (this._variantKey !== key) {
            this._variantKey = key;

            const defines = new Map();
            ShaderUtils.addScreenDepthChunkDefines(this.cameraComponent.shaderParams, defines);
            if (shadows) defines.set('VOL_SHADOWS', '');
            if (cookies) defines.set('VOL_COOKIES', '');

            this.shader = ShaderUtils.createShader(this.device, {
                uniqueName: `VolumetricFogLocalShader-${key}`,
                attributes: { aPosition: SEMANTIC_POSITION },
                vertexChunk: 'volumetricFogLocalVS',
                fragmentChunk: 'volumetricFogLocalPS',
                fragmentDefines: defines
            });
        }
    }

    /**
     * Returns the light clusters used by the layers the camera renders, or null when the camera
     * renders no layer with clustered lights.
     *
     * @returns {import('../../scene/lighting/world-clusters.js').WorldClusters|null} The clusters.
     * @private
     */
    _getLightClusters() {
        const steps = this.scenePass?.layerRenderSteps;
        if (steps) {
            for (let i = 0; i < steps.length; i++) {
                const clusters = steps[i].lightClusters;
                if (clusters && clusters.usedLights.length > 1) {
                    return clusters;
                }
            }
        }
        return null;
    }

    /**
     * Evaluates the normalized device coordinates the light volume projects to, to limit the
     * rendering to the part of the screen the light can affect.
     *
     * @param {Light} light - The light.
     * @param {import('../../scene/camera.js').Camera} camera - The camera.
     * @param {Vec4} rect - The rectangle to fill in, as min.xy and max.xy.
     * @returns {boolean} True if the light volume is visible.
     * @private
     */
    _evalLightRect(light, camera, rect) {

        // the bounding sphere of the light volume in the view space
        light.getBoundingSphere(_tempSphere);
        const radius = _tempSphere.radius;
        camera.viewMatrix.transformPoint(_tempSphere.center, _tempVec3);

        // the projection of a volume crossing the near plane is not bounded, use the whole screen
        if (-_tempVec3.z - radius <= camera.nearClip) {
            rect.set(-1, -1, 1, 1);
            return true;
        }

        // project the corners of the view space bounds of the sphere - all of them are in front of
        // the near plane, and so the perspective divide is safe
        const projection = camera.projectionMatrix;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < 8; i++) {
            _tempCorner.set(
                _tempVec3.x + ((i & 1) ? radius : -radius),
                _tempVec3.y + ((i & 2) ? radius : -radius),
                _tempVec3.z + ((i & 4) ? radius : -radius),
                1
            );

            projection.transformVec4(_tempCorner, _tempProjected);
            const x = _tempProjected.x / _tempProjected.w;
            const y = _tempProjected.y / _tempProjected.w;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }

        rect.set(Math.max(minX, -1), Math.max(minY, -1), Math.min(maxX, 1), Math.min(maxY, 1));
        return rect.x < rect.z && rect.y < rect.w;
    }

    /**
     * Assigns the uniforms of a single light, and returns false when the light does not need to be
     * rendered.
     *
     * @param {Light} light - The light.
     * @param {boolean} shadows - True if the shader samples the shadow atlas.
     * @param {boolean} cookies - True if the shader samples the cookie atlas.
     * @returns {boolean} True if the light was set up for rendering.
     * @private
     */
    _setupLight(light, shadows, cookies) {

        const camera = this.cameraComponent.camera;
        const isSpot = light._type === LIGHTTYPE_SPOT;

        // screen space bounds of the light volume
        if (!this._evalLightRect(light, camera, _tempRect)) {
            return false;
        }
        this._lightRect[0] = _tempRect.x;
        this._lightRect[1] = _tempRect.y;
        this._lightRect[2] = _tempRect.z;
        this._lightRect[3] = _tempRect.w;
        this.lightRectId.setValue(this._lightRect);

        // the bounding sphere the ray is marched over, evaluated by _evalLightRect
        this._lightSphere[0] = _tempSphere.center.x;
        this._lightSphere[1] = _tempSphere.center.y;
        this._lightSphere[2] = _tempSphere.center.z;
        this._lightSphere[3] = _tempSphere.radius;
        this.lightSphereId.setValue(this._lightSphere);

        const pos = light._node.getPosition();
        this._lightPosRange[0] = pos.x;
        this._lightPosRange[1] = pos.y;
        this._lightPosRange[2] = pos.z;
        this._lightPosRange[3] = light.attenuationEnd;
        this.lightPosRangeId.setValue(this._lightPosRange);

        // light color, scaled to match the lit scene
        const scale = this.intensity * this.exposure * light.volumetricScattering;
        const color = light._colorLinear;
        this._lightColor[0] = color[0] * scale;
        this._lightColor[1] = color[1] * scale;
        this._lightColor[2] = color[2] * scale;
        this.lightColorId.setValue(this._lightColor);

        // spot lights shine down the negative Y axis of their node
        if (isSpot) {
            light._node.getWorldTransform().getY(_tempDir).mulScalar(-1).normalize();
        }
        this._lightDir[0] = isSpot ? _tempDir.x : 0;
        this._lightDir[1] = isSpot ? _tempDir.y : 0;
        this._lightDir[2] = isSpot ? _tempDir.z : 0;
        this._lightDir[3] = isSpot ? 1 : 0;
        this.lightDirId.setValue(this._lightDir);

        this._lightAtten[0] = light._falloffMode === LIGHTFALLOFF_LINEAR ? 1 : 0;
        this.lightAttenId.setValue(this._lightAtten);

        // a light only samples the atlases when it was allocated a slot in them. The shadow map
        // condition matches the one the clustered lighting uses to select the projection matrix of
        // a spot light, so the fog and the surfaces sample the atlases the same way.
        const hasAtlasSlot = light.atlasViewportAllocated;
        const hasShadowMap = shadows && hasAtlasSlot && light.castShadows;
        const useShadow = hasShadowMap && light.shadowIntensity > 0;
        const useCookie = cookies && hasAtlasSlot && !!light._cookie && light.cookieIntensity > 0;

        this._lightSpot[0] = light._innerConeAngleCos;
        this._lightSpot[1] = light._outerConeAngleCos;
        this._lightSpot[2] = useShadow ? light.shadowIntensity : 0;
        this._lightSpot[3] = useCookie ? light.cookieIntensity : 0;
        this.lightSpotId.setValue(this._lightSpot);

        // The atlas uniforms below are declared by the shader whenever the shadow or the cookie
        // sampling is compiled in, and so they are assigned for every light, even one which samples
        // neither - the shader ignores the values in that case, but leaving a declared uniform unset
        // is reported as an error.
        if (shadows || cookies) {

            const lightRenderData = hasShadowMap ? light.getRenderData(null, 0) : null;

            // the projection matrix of a spot light transforms the world space position to the
            // atlas slot of the light, and is shared by the shadow map and the cookie
            if (isSpot) {
                const matrix = lightRenderData?.shadowMatrix ??
                    (useCookie ? LightCamera.evalSpotCookieMatrix(light) : Mat4.IDENTITY);
                this.lightProjMatrixId.setValue(matrix.data);
            } else {
                this.lightProjMatrixId.setValue(Mat4.IDENTITY.data);
            }

            // an omni light uses a cube face stored in the atlas viewport of the light, subdivided
            // into a 3x3 grid of faces
            const viewport = light.atlasViewport;
            this._lightAtlas[0] = viewport.x;
            this._lightAtlas[1] = viewport.y;
            this._lightAtlas[2] = viewport.z / 3;
            this._lightAtlas[3] = lightRenderData ? light._getUniformBiasValues(lightRenderData).bias : 0;
            this.lightAtlasId.setValue(this._lightAtlas);
        }

        if (cookies) {
            this.lightCookieChannelId.setValue(useCookie ?
                (_cookieChannelMasks[light._cookieChannel] ?? _cookieChannelMasks.rgb) :
                _cookieChannelMaskNone);
        }

        return true;
    }

    execute() {

        const clusters = this._getLightClusters();
        if (!clusters || !this.quadRender) {
            return;
        }

        const camera = this.cameraComponent.camera;
        const node = camera._node;
        const { lighting } = this.cameraComponent.system.app.scene;

        // camera ray reconstruction, shared by all the lights
        this.invViewId.setValue(node.getWorldTransform().data);

        const pos = node.getPosition();
        this._cameraPos[0] = pos.x;
        this._cameraPos[1] = pos.y;
        this._cameraPos[2] = pos.z;
        this.cameraPosId.setValue(this._cameraPos);

        const fwd = node.forward;
        this._cameraFwd[0] = fwd.x;
        this._cameraFwd[1] = fwd.y;
        this._cameraFwd[2] = fwd.z;
        this.cameraFwdId.setValue(this._cameraFwd);

        const projData = camera.projectionMatrix.data;
        this._projScale[0] = 1 / projData[0];
        this._projScale[1] = 1 / projData[5];
        this.projScaleId.setValue(this._projScale);

        const { tint } = this;
        this._tint[0] = tint.r;
        this._tint[1] = tint.g;
        this._tint[2] = tint.b;
        this.tintId.setValue(this._tint);

        this._fogParams[0] = this.density;
        this._fogParams[1] = this.heightBase;
        this._fogParams[2] = this.heightFalloff;
        this._fogParams[3] = this.maxDistance;
        this.fogParamsId.setValue(this._fogParams);

        this._marchParams[0] = this.anisotropy;
        this._marchParams[1] = this.steps;
        this._marchParams[2] = this.noiseOffset;
        this._marchParams[3] = this.extinction;
        this.marchParamsId.setValue(this._marchParams);

        // render state, shared by all the lights
        this.device.setDrawStates(this.blendState, this.depthState, this.cullMode, this.frontFace,
            this.stencilFront, this.stencilBack);

        // a quad per light, covering the screen space bounds of its volume. Index 0 of the cluster
        // lights is reserved for 'no light'.
        const { shadowsEnabled, cookiesEnabled } = lighting;
        const { omniLights, spotLights } = this;
        const lights = clusters.usedLights;
        for (let i = 1; i < lights.length; i++) {
            const light = lights[i].light;

            // the two light types are enabled separately, and a light can opt out of the fog
            const enabled = light?.volumetricScattering > 0 &&
                (light._type === LIGHTTYPE_SPOT ? spotLights : omniLights);

            if (enabled && this._setupLight(light, shadowsEnabled, cookiesEnabled)) {
                this.quadRender.render();
            }
        }
    }
}

/**
 * Render pass which composites the volumetric fog texture over the scene render target, using a
 * depth-aware upsample, blending as scene * transmittance + inscatter.
 *
 * @ignore
 */
class RenderPassVolumetricFogCombine extends RenderPassShaderQuad {
    constructor(device, cameraComponent, fogTexture) {
        super(device);
        this.fogTexture = fogTexture;

        const defines = new Map();
        const depthKey = ShaderUtils.addScreenDepthChunkDefines(cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `VolumetricFogCombineShader${depthKey}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'volumetricFogCombinePS',
            fragmentDefines: defines
        });

        // scene.rgb * fog.a + fog.rgb, scene alpha is preserved
        this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ZERO, BLENDMODE_ONE);

        this.fogTextureId = device.scope.resolve('uFogTexture');
        this.fogTextureSizeId = device.scope.resolve('uFogTextureSize');
        this._fogTextureSize = new Float32Array(4);
    }

    execute() {

        const { fogTexture } = this;
        this.fogTextureId.setValue(fogTexture);

        this._fogTextureSize[0] = fogTexture.width;
        this._fogTextureSize[1] = fogTexture.height;
        this._fogTextureSize[2] = 1 / fogTexture.width;
        this._fogTextureSize[3] = 1 / fogTexture.height;
        this.fogTextureSizeId.setValue(this._fogTextureSize);

        super.execute();
    }
}

/**
 * Frame pass implementation of volumetric fog lit by a directional light. A reduced resolution
 * raymarch pass accumulates in-scattered light and transmittance along each view ray, sampling
 * the light's cascaded shadow map to form visible light shafts, and a combine pass blends the
 * result over the scene render target using a depth-aware upsample.
 *
 * Algorithm details:
 *
 * The raymarch pass renders a full-screen quad into an RGBA16F texture sized as a fraction
 * (scale) of the scene render target, storing the in-scattered light in rgb and the
 * transmittance in alpha. For each pixel, a world space view ray is reconstructed from the
 * camera's inverse view matrix and projection scale, and marched from the camera to the scene
 * surface - the distance is derived from the linear depth prepass texture and clamped to
 * maxDistance. The march uses a fixed number of steps, with the sample positions offset along
 * the ray by per-pixel interleaved gradient noise to hide banding. When TAA is enabled, the
 * noise pattern additionally cycles each frame using a golden-ratio sequence, and TAA
 * accumulates the dithered results into a smooth solution over time.
 *
 * The fog media is modeled as exponential height fog: the density is constant below heightBase
 * and decays exponentially above it, controlled by heightFalloff. At each step, the light
 * visibility is evaluated with a single tap of the directional light's cascaded shadow map -
 * the cascade is selected from the sample's view depth, and the tap uses hardware depth
 * comparison for depth-format shadow maps (PCF) or a manual comparison for color-format maps
 * storing depth (PCSS / VSM). The in-scattered radiance combines the light color scaled by the
 * Henyey-Greenstein phase function (evaluated once per ray, as the light direction is constant)
 * with an ambient term that keeps fog in shadowed areas visible. The scattering is accumulated
 * front-to-back weighted by the current transmittance, and the transmittance is attenuated per
 * step using Beer-Lambert extinction, with an early out once it becomes negligible.
 *
 * Optionally the clustered omni and spot lights scatter light in the fog as well, which is added
 * into the fog texture by a second raymarch pass. As the radiance of a local light varies rapidly
 * along the ray, a march shared by all the lights would need an impractical number of steps, and
 * so each light is instead rendered as a separate quad covering the screen space bounds of its
 * volume, with the ray marched only over the part of it which is inside the volume - the segment
 * is evaluated analytically by intersecting the ray with the bounding sphere of the light, further
 * clipped to the cone slab of a spot light. The light properties come from the light directly, and
 * the visibility and the cookie of the light are sampled from the clustered lighting atlases with
 * a single tap per step. The transmittance between the camera and each sample is evaluated
 * analytically from the closed form of the height fog optical depth, as the samples of this pass
 * are not contiguous, and only the in-scattered light is blended in, leaving the transmittance
 * stored in the alpha channel to the directional pass.
 *
 * The combine pass runs at full resolution and blends the fog texture over the scene render
 * target as scene * transmittance + inscatter, using alpha blending so no extra copy of the
 * scene is needed. To upsample the low resolution fog without leaking across geometry edges,
 * it takes the 4 nearest fog texels and weights them by their bilinear factors multiplied by
 * the depth similarity between the full resolution pixel and each low resolution sample. The
 * pass executes before TAA and bloom in the frame, so the fog participates in temporal
 * anti-aliasing and bright shafts contribute to the bloom.
 *
 * @category Graphics
 * @ignore
 */
class FramePassVolumetricFog extends FramePass {
    /**
     * The directional light providing the scattered light, or null for unlit (ambient only) fog.
     *
     * @type {Light|null}
     */
    light = null;

    /**
     * The fog albedo.
     *
     * @type {Color}
     */
    tint = new Color(1, 1, 1);

    /**
     * The fog density at the base height.
     */
    density = 0.01;

    /**
     * The world space height at which the density starts to falloff. Below it the density is
     * constant.
     */
    heightBase = 0;

    /**
     * The exponential falloff of the density with height.
     */
    heightFalloff = 0.05;

    /**
     * A scale of how quickly the fog absorbs the light passing through it, without affecting how
     * much light it scatters.
     */
    extinction = 1;

    /**
     * The anisotropy of the Henyey-Greenstein phase function, 0..1 range, larger values scatter
     * more light forward, making the fog brighter when looking towards the light.
     */
    anisotropy = 0.6;

    /**
     * The intensity of the light scattering.
     */
    intensity = 1;

    /**
     * The color of the ambient in-scattered light, allowing the fog in shadowed areas to remain
     * visible.
     *
     * @type {Color}
     */
    ambientColor = new Color(1, 1, 1);

    /**
     * The intensity of the ambient in-scattered light.
     */
    ambientIntensity = 0.02;

    /**
     * The maximum world space distance the fog is raymarched to.
     */
    maxDistance = 300;

    /**
     * The number of raymarching steps.
     */
    steps = 24;

    /**
     * True when the noise pattern changes each frame, to be resolved by TAA.
     */
    temporalDither = false;

    /**
     * True when the clustered omni lights scatter light in the fog as well.
     */
    localOmniLights = false;

    /**
     * True when the clustered spot lights scatter light in the fog as well.
     */
    localSpotLights = false;

    /**
     * The intensity of the light scattering of the local lights.
     */
    localIntensity = 1;

    /**
     * The number of raymarching steps used inside the volume of each local light.
     */
    localSteps = 12;

    /** @type {number} */
    _scale = 0.5;

    /** @type {number} */
    _frameIndex = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera component.
     * @param {Texture} sceneTexture - The scene color texture, used to size the fog texture.
     * @param {RenderTarget} sceneRenderTarget - The scene render target the fog is blended into.
     * @param {RenderPassForward|null} scenePass - The forward pass rendering the scene, providing
     * the light clusters used by the local lights pass.
     */
    constructor(device, cameraComponent, sceneTexture, sceneRenderTarget, scenePass = null) {
        super(device);
        this.cameraComponent = cameraComponent;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogPS', glslVolumetricFogPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogPS', wgslVolumetricFogPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogCombinePS', glslVolumetricFogCombinePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogCombinePS', wgslVolumetricFogCombinePS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogLocalPS', glslVolumetricFogLocalPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogLocalPS', wgslVolumetricFogLocalPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogLocalVS', glslVolumetricFogLocalVS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogLocalVS', wgslVolumetricFogLocalVS);

        // reduced resolution texture storing in-scattered light (rgb) and transmittance (a)
        const format = device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F], true, 1) ?? PIXELFORMAT_RGBA8;
        this.fogTexture = new Texture(device, {
            name: 'VolumetricFogTexture',
            width: 4,
            height: 4,
            format: format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        this.fogRenderTarget = new RenderTarget({
            name: 'VolumetricFogRT',
            colorBuffer: this.fogTexture,
            depth: false
        });

        // raymarch pass
        this.fogPass = new RenderPassVolumetricFog(device, cameraComponent);
        this.fogPass.init(this.fogRenderTarget, {
            resizeSource: sceneTexture,
            scaleX: this._scale,
            scaleY: this._scale
        });
        this.fogPass.setClearColor(new Color(0, 0, 0, 1));
        this.beforePasses.push(this.fogPass);

        // local lights pass, adding the scattering of the clustered lights into the fog texture.
        // It renders to the same render target as the raymarch pass, which owns its resizing.
        this.localPass = new RenderPassVolumetricFogLocal(device, cameraComponent);
        this.localPass.scenePass = scenePass;
        this.localPass.init(this.fogRenderTarget);
        this.beforePasses.push(this.localPass);

        // combine pass, blending the fog over the scene render target
        this.combinePass = new RenderPassVolumetricFogCombine(device, cameraComponent, this.fogTexture);
        this.combinePass.init(sceneRenderTarget);
        this.beforePasses.push(this.combinePass);
    }

    destroy() {
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;
        this.fogPass = null;
        this.localPass = null;
        this.combinePass = null;

        if (this.fogRenderTarget) {
            this.fogRenderTarget.destroyTextureBuffers();
            this.fogRenderTarget.destroy();
            this.fogRenderTarget = null;
            this.fogTexture = null;
        }
    }

    /**
     * Sets the resolution scale of the fog texture, relative to the scene render target.
     *
     * @type {number}
     */
    set scale(value) {
        this._scale = value;
        this.fogPass.scaleX = value;
        this.fogPass.scaleY = value;
    }

    /**
     * Gets the resolution scale of the fog texture.
     *
     * @type {number}
     */
    get scale() {
        return this._scale;
    }

    frameUpdate() {
        super.frameUpdate();

        const { light, fogPass, localPass } = this;
        const camera = this.cameraComponent.camera;
        const scene = this.cameraComponent.system.app.scene;

        // shadow sampling variant - only used when the shadow map already exists, as for a newly
        // enabled light the shadow map is created by the shadow rendering later in the frame
        let shadows = false;
        let pcf = false;
        let lightRenderData = null;
        if (light && light.castShadows && light.shadowIntensity > 0) {
            lightRenderData = light.getRenderData(camera, 0);
            if (lightRenderData.shadowBuffer) {
                shadows = true;
                pcf = !!shadowTypeInfo.get(light._shadowType)?.pcf;
            }
        }
        fogPass.updateShaderVariant(shadows, pcf);
        fogPass.shadowsEnabled = shadows;
        fogPass.lightRenderData = shadows ? lightRenderData : null;

        // mirror the parameters to the raymarch pass
        fogPass.light = light;
        fogPass.tint.copy(this.tint);
        fogPass.density = this.density;
        fogPass.heightBase = this.heightBase;
        fogPass.heightFalloff = this.heightFalloff;
        fogPass.extinction = this.extinction;
        fogPass.anisotropy = this.anisotropy;
        fogPass.intensity = this.intensity;
        fogPass.ambientColor.copy(this.ambientColor);
        fogPass.ambientIntensity = this.ambientIntensity;
        fogPass.maxDistance = this.maxDistance;
        fogPass.steps = Math.max(1, Math.floor(this.steps));

        // match the lit scene exposure each frame
        fogPass.exposure = scene.exposure;

        // cycle the noise pattern over frames when TAA resolves it to a smooth result
        this._frameIndex = (this._frameIndex + 1) % 16;
        fogPass.noiseOffset = this.temporalDither ? this._frameIndex * 0.618034 : 0;

        // local lights are only supported by the clustered lighting, which owns the shadow and the
        // cookie atlas the pass samples
        const { localOmniLights, localSpotLights } = this;
        localPass.enabled = (localOmniLights || localSpotLights) && scene.clusteredLightingEnabled;
        if (localPass.enabled) {

            const { shadowsEnabled, cookiesEnabled } = scene.lighting;
            localPass.updateShaderVariant(shadowsEnabled, cookiesEnabled);

            localPass.omniLights = localOmniLights;
            localPass.spotLights = localSpotLights;

            // the fog media is shared with the directional pass
            localPass.tint.copy(this.tint);
            localPass.density = this.density;
            localPass.heightBase = this.heightBase;
            localPass.heightFalloff = this.heightFalloff;
            localPass.extinction = this.extinction;
            localPass.anisotropy = this.anisotropy;
            localPass.maxDistance = this.maxDistance;

            localPass.intensity = this.localIntensity;
            localPass.steps = Math.max(1, Math.floor(this.localSteps));
            localPass.exposure = scene.exposure;
            localPass.noiseOffset = fogPass.noiseOffset;
        }
    }
}

export { FramePassVolumetricFog };
