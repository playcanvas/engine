import { Color } from '../../../../core/math/color.js';
import { Vec3 } from '../../../../core/math/vec3.js';
import { SEMANTIC_POSITION } from '../../../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';

/**
 * @import { Light, LightRenderData } from '../../../../scene/light.js'
 */

const _tempDir = new Vec3();

// the cascade distances of a directional shadow with shadow bounds, which covers the bounds at any
// distance from the camera
const _boundsCascadeDistances = new Float32Array([1e30, 1e30, 1e30, 1e30]);

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

            // a shadow with shadow bounds covers the bounds at any distance from the camera
            const bounds = light.shadowBounds;

            this.shadowMapId.setValue(lightRenderData.shadowBuffer);
            this.shadowMatrixPaletteId.setValue(light._shadowMatrixPalette);
            this.shadowCascadeDistancesId.setValue(bounds ? _boundsCascadeDistances : light._shadowCascadeDistances);

            this._shadowParams[0] = light.shadowCascadeCount;
            this._shadowParams[1] = biases.bias;
            this._shadowParams[2] = 0;
            this._shadowParams[3] = bounds ? 1e30 : light.shadowDistance;
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

export { RenderPassVolumetricFog };
