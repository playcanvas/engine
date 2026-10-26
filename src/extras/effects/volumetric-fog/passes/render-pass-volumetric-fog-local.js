import { Color } from '../../../../core/math/color.js';
import { Mat4 } from '../../../../core/math/mat4.js';
import { Vec3 } from '../../../../core/math/vec3.js';
import { Vec4 } from '../../../../core/math/vec4.js';
import { BoundingSphere } from '../../../../core/shape/bounding-sphere.js';
import {
    BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ZERO, SEMANTIC_POSITION
} from '../../../../platform/graphics/constants.js';
import { BlendState } from '../../../../platform/graphics/blend-state.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { LIGHTFALLOFF_LINEAR, LIGHTTYPE_SPOT } from '../../../../scene/constants.js';
import { LightCamera } from '../../../../scene/renderer/light-camera.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';

/**
 * @import { Light } from '../../../../scene/light.js'
 * @import { RenderPassForward } from '../../../../scene/renderer/render-pass-forward.js'
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
     * @returns {import('../../../../scene/lighting/world-clusters.js').WorldClusters|null} The clusters.
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
     * @param {import('../../../../scene/camera.js').Camera} camera - The camera.
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
                super.execute();
            }
        }
    }
}

export { RenderPassVolumetricFogLocal };
