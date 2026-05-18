import { math } from '../../../core/math/math.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { LAYERID_WORLD, MASK_AFFECT_LIGHTMAPPED, MASK_AFFECT_DYNAMIC, MASK_BAKE } from '../../../scene/constants.js';
import { Light, lightTypes } from '../../../scene/light.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

/**
 * @import { Color } from '../../../core/math/color.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 * @import { LightComponentSystem } from './system.js'
 * @import { Entity } from '../../entity.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 * @import { Vec2 } from '../../../core/math/vec2.js'
 */

const _properties = [
    'type',
    'color',
    'intensity',
    'luminance',
    'shape',
    'affectSpecularity',
    'castShadows',
    'shadowDistance',
    'shadowIntensity',
    'shadowResolution',
    'shadowBias',
    'numCascades',
    'cascadeBlend',
    'bakeNumSamples',
    'bakeArea',
    'cascadeDistribution',
    'normalOffsetBias',
    'range',
    'innerConeAngle',
    'outerConeAngle',
    'falloffMode',
    'shadowType',
    'vsmBlurSize',
    'vsmBlurMode',
    'vsmBias',
    'cookieAsset',
    'cookie',
    'cookieIntensity',
    'cookieFalloff',
    'cookieChannel',
    'cookieAngle',
    'cookieScale',
    'cookieOffset',
    'shadowUpdateMode',
    'mask',
    'affectDynamic',
    'affectLightmapped',
    'bake',
    'bakeDir',
    'isStatic',
    'layers',
    'penumbraSize',
    'penumbraFalloff',
    'shadowSamples',
    'shadowBlockerSamples'
];

/**
 * The LightComponent enables an {@link Entity} to light the scene. There are three types of light:
 *
 * - `directional`: A global light that emits light in the direction of the negative y-axis of the
 * owner entity. Emulates light sources that appear to be infinitely far away such as the sun. The
 * owner entity's position is effectively ignored.
 * - `omni`: A local light that emits light in all directions from the owner entity's position.
 * Emulates candles, lamps, bulbs, etc.
 * - `spot`: A local light that emits light similarly to an omni light but is bounded by a cone
 * centered on the owner entity's negative y-axis. Emulates flashlights, spotlights, etc.
 *
 * You should never need to use the LightComponent constructor directly. To add a LightComponent
 * to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * const entity = new pc.Entity();
 * entity.addComponent('light', {
 *     type: 'omni',
 *     color: new pc.Color(1, 0, 0),
 *     intensity: 2
 * });
 * ```
 *
 * Once the LightComponent is added to the entity, you can access it via the {@link Entity#light}
 * property:
 *
 * ```javascript
 * entity.light.intensity = 3; // Set the intensity of the light
 *
 * console.log(entity.light.intensity); // Get the intensity of the light
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Area Lights](https://playcanvas.github.io/#/graphics/area-lights)
 * - [Clustered Area Lights](https://playcanvas.github.io/#/graphics/clustered-area-lights)
 * - [Clustered Lighting](https://playcanvas.github.io/#/graphics/clustered-lighting)
 * - [Clustered Omni Shadows](https://playcanvas.github.io/#/graphics/clustered-omni-shadows)
 * - [Clustered Spot Shadows](https://playcanvas.github.io/#/graphics/clustered-spot-shadows)
 * - [Lights](https://playcanvas.github.io/#/graphics/lights)
 *
 * @hideconstructor
 * @category Graphics
 */
class LightComponent extends Component {
    /**
     * @type {Light}
     * @private
     */
    _light;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayersChanged = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerAdded = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerRemoved = null;

    /**
     * @type {Asset|null}
     * @private
     */
    _cookieAsset = null;

    /**
     * @type {number|null}
     * @private
     */
    _cookieAssetId = null;

    /** @private */
    _cookieAssetAdd = false;

    /**
     * @type {Vec4|null}
     * @private
     */
    _cookieMatrix = null;

    /**
     * @type {number}
     * @private
     */
    _shadowBias = 0.05;

    /**
     * @type {number}
     * @private
     */
    _cookieAngle = 0;

    /**
     * @type {Vec2|null}
     * @private
     */
    _cookieScale = null;

    /**
     * @type {boolean}
     * @private
     */
    _castShadows = false;

    /**
     * Mirrors the user-supplied value. {@link Light#affectSpecularity} silently ignores writes for
     * non-directional lights, so storing it on the component is required to round-trip the user's
     * intent and re-apply it when the type later becomes directional (via {@link refreshProperties}).
     *
     * @type {boolean}
     * @private
     */
    _affectSpecularity = true;

    /**
     * @type {boolean}
     * @private
     */
    _affectDynamic = true;

    /**
     * @type {boolean}
     * @private
     */
    _affectLightmapped = false;

    /**
     * @type {boolean}
     * @private
     */
    _bake = false;

    /**
     * @type {number[]}
     * @private
     */
    _layers = [LAYERID_WORLD];

    /**
     * Preserves the user-facing type string. Required because `'point'` and `'omni'` both map to
     * the same underlying int on the {@link Light}, so reverse-mapping would normalise the user's
     * input.
     *
     * @type {string}
     * @private
     */
    _type = 'directional';

    /**
     * Create a new LightComponent instance.
     *
     * @param {LightComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._light = new Light(system.app.graphicsDevice, system.app.scene.clusteredLightingEnabled);
        this._light._node = entity;

        // Light defaults to a sRGB color of (0.8, 0.8, 0.8); the LightComponent default is (1, 1, 1)
        this._light.setColor(1, 1, 1);
    }

    /**
     * Gets the light component's underlying Light instance.
     *
     * @type {Light}
     * @ignore
     */
    get light() {
        return this._light;
    }

    /**
     * Sets the type of the light. Can be:
     *
     * - `"directional"`: A global light that emits light in the direction of the negative y-axis
     * of the owner entity.
     * - `"omni"`: A local light that emits light in all directions from the owner entity's
     * position.
     * - `"spot"`: A local light that emits light similarly to an omni light but is bounded by a
     * cone centered on the owner entity's negative y-axis.
     *
     * Defaults to `"directional"`.
     *
     * @type {string}
     */
    set type(value) {
        if (this._type === value) return;

        // Remove from layers first so clustered-light bookkeeping uses the OLD type. Layer#removeLight
        // gates _clusteredLightsSet.delete on `light.type !== DIRECTIONAL`, so changing the type
        // before the removal would leak the entry (e.g. spot -> directional).
        this.removeLightFromLayers();

        this._type = value;
        this._light.type = lightTypes[value];
        this.refreshProperties();
    }

    /**
     * Gets the type of the light.
     *
     * @type {string}
     */
    get type() {
        return this._type;
    }

    /**
     * Sets the color of the light in sRGB space. The alpha component of the color is ignored.
     * Defaults to white (`[1, 1, 1]`).
     *
     * @type {Color}
     */
    set color(value) {
        this._light.setColor(value);
    }

    /**
     * Gets the color of the light.
     *
     * @type {Color}
     */
    get color() {
        return this._light.getColor();
    }

    /**
     * Sets the brightness of the light. Defaults to 1.
     *
     * @type {number}
     */
    set intensity(value) {
        this._light.intensity = value;
    }

    /**
     * Gets the brightness of the light.
     *
     * @type {number}
     */
    get intensity() {
        return this._light.intensity;
    }

    /**
     * Sets the physically-based luminance. Only used if `scene.physicalUnits` is true. Defaults to 0.
     *
     * @type {number}
     */
    set luminance(value) {
        this._light.luminance = value;
    }

    /**
     * Gets the physically-based luminance.
     *
     * @type {number}
     */
    get luminance() {
        return this._light.luminance;
    }

    /**
     * Sets the light source shape. Can be:
     *
     * - {@link LIGHTSHAPE_PUNCTUAL}: Infinitesimally small point.
     * - {@link LIGHTSHAPE_RECT}: Rectangle shape.
     * - {@link LIGHTSHAPE_DISK}: Disk shape.
     * - {@link LIGHTSHAPE_SPHERE}: Sphere shape.
     *
     * Defaults to {@link LIGHTSHAPE_PUNCTUAL}.
     *
     * @type {number}
     */
    set shape(value) {
        this._light.shape = value;
    }

    /**
     * Gets the light source shape.
     *
     * @type {number}
     */
    get shape() {
        return this._light.shape;
    }

    /**
     * Sets whether material specularity will be affected by this light. Only takes effect when
     * {@link type} is `"directional"`; for other types the value is preserved on the component and
     * applied if {@link type} later becomes `"directional"`. Defaults to true.
     *
     * @type {boolean}
     */
    set affectSpecularity(value) {
        this._affectSpecularity = value;
        // Light#affectSpecularity is a no-op for non-directional lights; the value is preserved on
        // the component and re-applied via refreshProperties() if the type later becomes directional.
        this._light.affectSpecularity = value;
    }

    /**
     * Gets whether material specularity will be affected by this light.
     *
     * @type {boolean}
     */
    get affectSpecularity() {
        return this._affectSpecularity;
    }

    /**
     * Sets whether the light will cast shadows. Defaults to false.
     *
     * @type {boolean}
     */
    set castShadows(value) {
        this._castShadows = value;
        this._light.castShadows = value;
    }

    /**
     * Gets whether the light will cast shadows.
     *
     * @type {boolean}
     */
    get castShadows() {
        return this._castShadows;
    }

    /**
     * Sets the distance from the viewpoint beyond which shadows are no longer rendered. Affects
     * directional lights only. Defaults to 40.
     *
     * @type {number}
     */
    set shadowDistance(value) {
        this._light.shadowDistance = value;
    }

    /**
     * Gets the distance from the viewpoint beyond which shadows are no longer rendered.
     *
     * @type {number}
     */
    get shadowDistance() {
        return this._light.shadowDistance;
    }

    /**
     * Sets the intensity of the shadow darkening. 0 having no effect and 1 meaning shadows are
     * entirely black. Defaults to 1.
     *
     * @type {number}
     */
    set shadowIntensity(value) {
        this._light.shadowIntensity = value;
    }

    /**
     * Gets the intensity of the shadow darkening.
     *
     * @type {number}
     */
    get shadowIntensity() {
        return this._light.shadowIntensity;
    }

    /**
     * Sets the size of the texture used for the shadow map. Valid sizes are 64, 128, 256, 512,
     * 1024, 2048. Defaults to 1024.
     *
     * @type {number}
     */
    set shadowResolution(value) {
        this._light.shadowResolution = value;
    }

    /**
     * Gets the size of the texture used for the shadow map.
     *
     * @type {number}
     */
    get shadowResolution() {
        return this._light.shadowResolution;
    }

    /**
     * Set the depth bias for tuning the appearance of the shadow mapping generated by this light. Valid
     * range is 0 to 1. Defaults to 0.05.
     *
     * @type {number}
     */
    set shadowBias(value) {
        this._shadowBias = value;
        this._light.shadowBias = -0.01 * math.clamp(value, 0, 1);
    }

    /**
     * Get the depth bias for tuning the appearance of the shadow mapping generated by this light.
     *
     * @type {number}
     */
    get shadowBias() {
        return this._shadowBias;
    }

    /**
     * Sets the number of shadow cascades. Can be 1, 2, 3 or 4. Defaults to 1, representing no
     * cascades.
     *
     * @type {number}
     */
    set numCascades(value) {
        this._light.numCascades = math.clamp(Math.floor(value), 1, 4);
    }

    /**
     * Gets the number of shadow cascades.
     *
     * @type {number}
     */
    get numCascades() {
        return this._light.numCascades;
    }

    /**
     * Sets the blend factor for cascaded shadow maps, defining the fraction of each cascade level
     * used for blending between adjacent cascades. The value should be between 0 and 1. Defaults
     * to 0, which disables blending between cascades.
     *
     * @type {number}
     */
    set cascadeBlend(value) {
        this._light.cascadeBlend = math.clamp(value, 0, 1);
    }

    /**
     * Gets the blend factor for cascaded shadow maps.
     *
     * @type {number}
     */
    get cascadeBlend() {
        return this._light.cascadeBlend;
    }

    /**
     * Sets the number of samples used to bake this light into the lightmap. Defaults to 1. Maximum
     * value is 255.
     *
     * @type {number}
     */
    set bakeNumSamples(value) {
        this._light.bakeNumSamples = math.clamp(Math.floor(value), 1, 255);
    }

    /**
     * Gets the number of samples used to bake this light into the lightmap.
     *
     * @type {number}
     */
    get bakeNumSamples() {
        return this._light.bakeNumSamples;
    }

    /**
     * Sets the angular size in degrees of the area used when baking soft shadow boundaries for the
     * directional light into the lightmap. Range is 0 to 180. Requires {@link bake} to be set to
     * true and {@link type} to be `"directional"`. Defaults to 0.
     *
     * @type {number}
     */
    set bakeArea(value) {
        this._light.bakeArea = math.clamp(value, 0, 180);
    }

    /**
     * Gets the angular size in degrees of the area used when baking soft shadow boundaries for
     * the directional light into the lightmap.
     *
     * @type {number}
     */
    get bakeArea() {
        return this._light.bakeArea;
    }

    /**
     * Sets the distribution of subdivision of the camera frustum for individual shadow cascades.
     * Only used if {@link numCascades} is larger than 1. Can be a value in range of 0 and 1. Value
     * of 0 represents a linear distribution, value of 1 represents a logarithmic distribution.
     * Defaults to 0.5. Larger value increases the resolution of the shadows in the near distance.
     *
     * @type {number}
     */
    set cascadeDistribution(value) {
        this._light.cascadeDistribution = math.clamp(value, 0, 1);
    }

    /**
     * Gets the distribution of subdivision of the camera frustum for individual shadow cascades.
     *
     * @type {number}
     */
    get cascadeDistribution() {
        return this._light.cascadeDistribution;
    }

    /**
     * Sets the normal offset depth bias. Valid range is 0 to 1. Defaults to 0.
     *
     * @type {number}
     */
    set normalOffsetBias(value) {
        this._light.normalOffsetBias = math.clamp(value, 0, 1);
    }

    /**
     * Gets the normal offset depth bias.
     *
     * @type {number}
     */
    get normalOffsetBias() {
        return this._light.normalOffsetBias;
    }

    /**
     * Sets the range of the light. Affects omni and spot lights only. Defaults to 10.
     *
     * @type {number}
     */
    set range(value) {
        this._light.attenuationEnd = value;
    }

    /**
     * Gets the range of the light.
     *
     * @type {number}
     */
    get range() {
        return this._light.attenuationEnd;
    }

    /**
     * Sets the half-angle (measured in degrees from the light's direction axis to the cone edge)
     * at which the spotlight cone starts to fade off. The full inner beam angle is twice this
     * value. Affects spot lights only. Defaults to 40 (i.e. an 80-degree full inner beam).
     *
     * @type {number}
     */
    set innerConeAngle(value) {
        this._light.innerConeAngle = value;
    }

    /**
     * Gets the half-angle (measured in degrees from the light's direction axis to the cone edge)
     * at which the spotlight cone starts to fade off.
     *
     * @type {number}
     */
    get innerConeAngle() {
        return this._light.innerConeAngle;
    }

    /**
     * Sets the half-angle (measured in degrees from the light's direction axis to the cone edge)
     * at which the spotlight cone has faded to nothing. The full outer beam angle is twice this
     * value. Affects spot lights only. Defaults to 45 (i.e. a 90-degree full outer beam).
     *
     * @type {number}
     */
    set outerConeAngle(value) {
        this._light.outerConeAngle = value;
    }

    /**
     * Gets the half-angle (measured in degrees from the light's direction axis to the cone edge)
     * at which the spotlight cone has faded to nothing.
     *
     * @type {number}
     */
    get outerConeAngle() {
        return this._light.outerConeAngle;
    }

    /**
     * Sets the fall off mode for the light. This controls the rate at which a light attenuates
     * from its position. Can be:
     *
     * - {@link LIGHTFALLOFF_LINEAR}: Linear.
     * - {@link LIGHTFALLOFF_INVERSESQUARED}: Inverse squared.
     *
     * Affects omni and spot lights only. Defaults to {@link LIGHTFALLOFF_LINEAR}.
     *
     * @type {number}
     */
    set falloffMode(value) {
        this._light.falloffMode = value;
    }

    /**
     * Gets the fall off mode for the light.
     *
     * @type {number}
     */
    get falloffMode() {
        return this._light.falloffMode;
    }

    /**
     * Sets the type of shadows being rendered by this light. Can be:
     *
     * - {@link SHADOW_PCF1_32F}
     * - {@link SHADOW_PCF3_32F}
     * - {@link SHADOW_PCF5_32F}
     * - {@link SHADOW_PCF1_16F}
     * - {@link SHADOW_PCF3_16F}
     * - {@link SHADOW_PCF5_16F}
     * - {@link SHADOW_VSM_16F}
     * - {@link SHADOW_VSM_32F}
     * - {@link SHADOW_PCSS_32F}
     *
     * Defaults to {@link SHADOW_PCF3_32F}.
     *
     * @type {number}
     */
    set shadowType(value) {
        this._light.shadowType = value;
    }

    /**
     * Gets the type of shadows being rendered by this light.
     *
     * @type {number}
     */
    get shadowType() {
        return this._light.shadowType;
    }

    /**
     * Sets the number of samples used for blurring a variance shadow map. Only odd values are
     * supported; even values are rounded up to the next odd value. Values should be between 1 and
     * 25. Defaults to 11.
     *
     * @type {number}
     */
    set vsmBlurSize(value) {
        this._light.vsmBlurSize = value;
    }

    /**
     * Gets the number of samples used for blurring a variance shadow map.
     *
     * @type {number}
     */
    get vsmBlurSize() {
        return this._light.vsmBlurSize;
    }

    /**
     * Sets the blurring mode for variance shadow maps. Can be:
     *
     * - {@link BLUR_BOX}: Box filter.
     * - {@link BLUR_GAUSSIAN}: Gaussian filter. May look smoother than box, but requires more samples.
     *
     * Defaults to {@link BLUR_GAUSSIAN}.
     *
     * @type {number}
     */
    set vsmBlurMode(value) {
        this._light.vsmBlurMode = value;
    }

    /**
     * Gets the blurring mode for variance shadow maps.
     *
     * @type {number}
     */
    get vsmBlurMode() {
        return this._light.vsmBlurMode;
    }

    /**
     * Sets the bias used to fight shadow acne when rendering variance shadow maps. Range is 0 to
     * 1. Defaults to 0.0025.
     *
     * @type {number}
     */
    set vsmBias(value) {
        this._light.vsmBias = math.clamp(value, 0, 1);
    }

    /**
     * Gets the VSM bias value.
     *
     * @type {number}
     */
    get vsmBias() {
        return this._light.vsmBias;
    }

    /**
     * Sets the id of the texture asset to be used as the cookie for this light. Only spot and
     * omni lights can have cookies. Spot lights expect a 2D texture; omni lights expect a
     * cubemap. Defaults to null.
     *
     * @type {number|null}
     */
    set cookieAsset(value) {
        if (
            this._cookieAssetId &&
            ((value instanceof Asset && value.id === this._cookieAssetId) || value === this._cookieAssetId)
        ) {
            return;
        }

        this.onCookieAssetRemove();
        this._cookieAssetId = null;

        if (value instanceof Asset) {
            this._cookieAssetId = value.id;
            this.onCookieAssetAdd(value);
        } else if (typeof value === 'number') {
            this._cookieAssetId = value;
            const asset = this.system.app.assets.get(value);
            if (asset) {
                this.onCookieAssetAdd(asset);
            } else {
                this._cookieAssetAdd = true;
                this.system.app.assets.on(`add:${this._cookieAssetId}`, this.onCookieAssetAdd, this);
            }
        }
    }

    /**
     * Gets the id of the texture asset used as the cookie for this light, or null if none is set.
     *
     * @type {number|null}
     */
    get cookieAsset() {
        return this._cookieAssetId;
    }

    /**
     * Sets the texture to be used as the cookie for this light. Only spot and omni lights can have
     * cookies. Spot lights expect a 2D texture; omni lights expect a cubemap. Defaults to null.
     *
     * @type {Texture|null}
     */
    set cookie(value) {
        this._light.cookie = value;
    }

    /**
     * Gets the texture to be used as the cookie for this light.
     *
     * @type {Texture|null}
     */
    get cookie() {
        return this._light.cookie;
    }

    /**
     * Sets the cookie texture intensity. Defaults to 1.
     *
     * @type {number}
     */
    set cookieIntensity(value) {
        this._light.cookieIntensity = math.clamp(value, 0, 1);
    }

    /**
     * Gets the cookie texture intensity.
     *
     * @type {number}
     */
    get cookieIntensity() {
        return this._light.cookieIntensity;
    }

    /**
     * Sets whether normal spotlight falloff is active when a cookie texture is set. When set to
     * false, a spotlight will work like a pure texture projector (only fading with distance).
     * Defaults to true.
     *
     * @type {boolean}
     */
    set cookieFalloff(value) {
        this._light.cookieFalloff = value;
    }

    /**
     * Gets whether normal spotlight falloff is active when a cookie texture is set.
     *
     * @type {boolean}
     */
    get cookieFalloff() {
        return this._light.cookieFalloff;
    }

    /**
     * Sets the color channels of the cookie texture to use. Can be `"r"`, `"g"`, `"b"`, `"a"` or
     * `"rgb"`. Defaults to `"rgb"`.
     *
     * @type {string}
     */
    set cookieChannel(value) {
        this._light.cookieChannel = value;
    }

    /**
     * Gets the color channels of the cookie texture to use.
     *
     * @type {string}
     */
    get cookieChannel() {
        return this._light.cookieChannel;
    }

    /**
     * Sets the angle for spotlight cookie rotation in degrees. Defaults to 0.
     *
     * @type {number}
     */
    set cookieAngle(value) {
        if (this._cookieAngle === value) return;
        this._cookieAngle = value;
        if (value !== 0 || this._cookieScale !== null) {
            if (!this._cookieMatrix) this._cookieMatrix = new Vec4();
            let scx = 1;
            let scy = 1;
            if (this._cookieScale) {
                scx = this._cookieScale.x;
                scy = this._cookieScale.y;
            }
            const c = Math.cos(value * math.DEG_TO_RAD);
            const s = Math.sin(value * math.DEG_TO_RAD);
            this._cookieMatrix.set(c / scx, -s / scx, s / scy, c / scy);
            this._light.cookieTransform = this._cookieMatrix;
        } else {
            this._light.cookieTransform = null;
        }
    }

    /**
     * Gets the angle for spotlight cookie rotation (in degrees).
     *
     * @type {number}
     */
    get cookieAngle() {
        return this._cookieAngle;
    }

    /**
     * Sets the spotlight cookie scale. Set to null to use no scaling. Defaults to null.
     *
     * @type {Vec2|null}
     */
    set cookieScale(value) {
        this._cookieScale = value;
        if (value !== null || this._cookieAngle !== 0) {
            if (!this._cookieMatrix) this._cookieMatrix = new Vec4();
            const scx = value ? value.x : 1;
            const scy = value ? value.y : 1;
            const c = Math.cos(this._cookieAngle * math.DEG_TO_RAD);
            const s = Math.sin(this._cookieAngle * math.DEG_TO_RAD);
            this._cookieMatrix.set(c / scx, -s / scx, s / scy, c / scy);
            this._light.cookieTransform = this._cookieMatrix;
        } else {
            this._light.cookieTransform = null;
        }
    }

    /**
     * Gets the spotlight cookie scale.
     *
     * @type {Vec2|null}
     */
    get cookieScale() {
        return this._cookieScale;
    }

    /**
     * Sets the spotlight cookie position offset. Defaults to null.
     *
     * @type {Vec2|null}
     */
    set cookieOffset(value) {
        this._light.cookieOffset = value;
    }

    /**
     * Gets the spotlight cookie position offset.
     *
     * @type {Vec2|null}
     */
    get cookieOffset() {
        return this._light.cookieOffset;
    }

    /**
     * Sets the shadow update mode. This tells the renderer how often shadows must be updated for
     * this light. Can be:
     *
     * - {@link SHADOWUPDATE_NONE}: Don't render shadows.
     * - {@link SHADOWUPDATE_THISFRAME}: Render shadows only once (then automatically switches to
     * {@link SHADOWUPDATE_NONE}).
     * - {@link SHADOWUPDATE_REALTIME}: Render shadows every frame.
     *
     * Defaults to {@link SHADOWUPDATE_REALTIME}.
     *
     * @type {number}
     */
    set shadowUpdateMode(value) {
        this._light.shadowUpdateMode = value;
    }

    /**
     * Gets the shadow update mode.
     *
     * @type {number}
     */
    get shadowUpdateMode() {
        return this._light.shadowUpdateMode;
    }

    /**
     * Sets the bitmask that determines which {@link MeshInstance}s are lit by this light. The
     * value is composed from {@link MASK_AFFECT_DYNAMIC}, {@link MASK_AFFECT_LIGHTMAPPED} and
     * {@link MASK_BAKE}. The {@link affectDynamic}, {@link affectLightmapped} and {@link bake}
     * helpers write to the same underlying mask but maintain their own state and are not
     * recomputed from `mask`, so writing `mask` directly will not update those helpers (and a
     * subsequent write to a helper may overwrite bits set via `mask`). Defaults to
     * {@link MASK_AFFECT_DYNAMIC}.
     *
     * @type {number}
     */
    set mask(value) {
        this._light.mask = value;
    }

    /**
     * Gets the mask to determine which {@link MeshInstance}s are lit by this light.
     *
     * @type {number}
     */
    get mask() {
        return this._light.mask;
    }

    /**
     * Sets whether the light will affect non-lightmapped objects. Toggles the
     * {@link MASK_AFFECT_DYNAMIC} bit on {@link mask}. Defaults to true.
     *
     * @type {boolean}
     */
    set affectDynamic(value) {
        if (this._affectDynamic === value) return;
        this._affectDynamic = value;
        if (value) {
            this._light.mask |= MASK_AFFECT_DYNAMIC;
        } else {
            this._light.mask &= ~MASK_AFFECT_DYNAMIC;
        }
        this._light.layersDirty();
    }

    /**
     * Gets whether the light will affect non-lightmapped objects.
     *
     * @type {boolean}
     */
    get affectDynamic() {
        return this._affectDynamic;
    }

    /**
     * Sets whether the light will affect lightmapped objects. Toggles the
     * {@link MASK_AFFECT_LIGHTMAPPED} bit on {@link mask}. Mutually exclusive with {@link bake} on
     * the mask: enabling one clears the other's mask bit. Defaults to false.
     *
     * @type {boolean}
     */
    set affectLightmapped(value) {
        if (this._affectLightmapped === value) return;
        this._affectLightmapped = value;
        if (value) {
            this._light.mask |= MASK_AFFECT_LIGHTMAPPED;
            if (this._bake) this._light.mask &= ~MASK_BAKE;
        } else {
            this._light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
            if (this._bake) this._light.mask |= MASK_BAKE;
        }
    }

    /**
     * Gets whether the light will affect lightmapped objects.
     *
     * @type {boolean}
     */
    get affectLightmapped() {
        return this._affectLightmapped;
    }

    /**
     * Sets whether the light will be rendered into lightmaps. Toggles the {@link MASK_BAKE} bit
     * on {@link mask}. Mutually exclusive with {@link affectLightmapped} on the mask: enabling one
     * clears the other's mask bit. Defaults to false.
     *
     * @type {boolean}
     */
    set bake(value) {
        if (this._bake === value) return;
        this._bake = value;
        if (value) {
            this._light.mask |= MASK_BAKE;
            if (this._affectLightmapped) this._light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
        } else {
            this._light.mask &= ~MASK_BAKE;
            if (this._affectLightmapped) this._light.mask |= MASK_AFFECT_LIGHTMAPPED;
        }
        this._light.layersDirty();
    }

    /**
     * Gets whether the light will be rendered into lightmaps.
     *
     * @type {boolean}
     */
    get bake() {
        return this._bake;
    }

    /**
     * Sets whether the light's direction will contribute to directional lightmaps. The light must
     * be enabled and {@link bake} set to true. Be aware that the directional lightmap is an
     * approximation and can only hold a single direction per pixel. Intersecting multiple lights
     * with {@link bakeDir} set to true may lead to incorrect-looking specular/bump mapping in the
     * area of intersection. The error is not always visible though, and is highly scene-dependent.
     * Defaults to true.
     *
     * @type {boolean}
     */
    set bakeDir(value) {
        this._light.bakeDir = value;
    }

    /**
     * Gets whether the light's direction will contribute to directional lightmaps.
     *
     * @type {boolean}
     */
    get bakeDir() {
        return this._light.bakeDir;
    }

    /**
     * Sets whether the light ever moves. This is an optimization hint. Defaults to false.
     *
     * @type {boolean}
     */
    set isStatic(value) {
        this._light.isStatic = value;
    }

    /**
     * Gets whether the light ever moves.
     *
     * @type {boolean}
     */
    get isStatic() {
        return this._light.isStatic;
    }

    /**
     * Sets the array of layer IDs ({@link Layer#id}) to which this light should belong. Don't
     * push/pop/splice or modify this array. If you want to change it, set a new one instead.
     * Defaults to [{@link LAYERID_WORLD}].
     *
     * @type {number[]}
     */
    set layers(value) {
        const oldValue = this._layers;
        for (let i = 0; i < oldValue.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
            if (!layer) continue;
            layer.removeLight(this);
            this._light.removeLayer(layer);
        }
        this._layers = value;
        for (let i = 0; i < value.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(value[i]);
            if (!layer) continue;
            if (this.enabled && this.entity.enabled) {
                layer.addLight(this);
                this._light.addLayer(layer);
            }
        }
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this light should belong.
     *
     * @type {number[]}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Sets an array of SHADOWUPDATE_ settings per shadow cascade. Set to null if not used.
     * Defaults to null.
     *
     * @type {number[]|null}
     */
    set shadowUpdateOverrides(values) {
        this._light.shadowUpdateOverrides = values;
    }

    /**
     * Gets an array of SHADOWUPDATE_ settings per shadow cascade.
     *
     * @type {number[]|null}
     */
    get shadowUpdateOverrides() {
        return this._light.shadowUpdateOverrides;
    }

    /**
     * Sets the number of shadow samples used for soft shadows when the shadow type is
     * {@link SHADOW_PCSS_32F}. This value should be a positive whole number starting at 1. Higher
     * values result in smoother shadows but can significantly decrease performance. Defaults to 16.
     *
     * @type {number}
     */
    set shadowSamples(value) {
        this._light.shadowSamples = value;
    }

    /**
     * Gets the number of shadow samples used for soft shadows.
     *
     * @type {number}
     */
    get shadowSamples() {
        return this._light.shadowSamples;
    }

    /**
     * Sets the number of blocker samples used for soft shadows when the shadow type is
     * {@link SHADOW_PCSS_32F}. These samples are used to estimate the distance between the shadow
     * caster and the shadow receiver, which is then used for the estimation of contact hardening
     * in the shadow. This value should be a non-negative whole number. Higher values improve
     * shadow quality by considering more occlusion points, but can decrease performance. When set
     * to 0, contact hardening is disabled and the shadow has constant softness. Defaults to 16.
     * Note that this value can be lower than shadowSamples to optimize performance, often without
     * large impact on quality.
     *
     * @type {number}
     */
    set shadowBlockerSamples(value) {
        this._light.shadowBlockerSamples = value;
    }

    /**
     * Gets the number of blocker samples used for contact hardening shadows.
     *
     * @type {number}
     */
    get shadowBlockerSamples() {
        return this._light.shadowBlockerSamples;
    }

    /**
     * Sets the size of penumbra for contact hardening shadows. For area lights, acts as a
     * multiplier with the dimensions of the area light. For punctual and directional lights it's
     * the area size of the light. Defaults to 1.
     *
     * @type {number}
     */
    set penumbraSize(value) {
        this._light.penumbraSize = value;
    }

    /**
     * Gets the size of penumbra for contact hardening shadows.
     *
     * @type {number}
     */
    get penumbraSize() {
        return this._light.penumbraSize;
    }

    /**
     * Sets the falloff rate for shadow penumbra for contact hardening shadows. This is a value larger
     * than or equal to 1. This parameter determines how quickly the shadow softens with distance.
     * Higher values result in a faster softening of the shadow, while lower values produce a more
     * gradual transition. Defaults to 1.
     *
     * @type {number}
     */
    set penumbraFalloff(value) {
        this._light.penumbraFalloff = value;
    }

    /**
     * Gets the falloff rate for shadow penumbra for contact hardening shadows.
     *
     * @type {number}
     */
    get penumbraFalloff() {
        return this._light.penumbraFalloff;
    }

    addLightToLayers() {
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.addLight(this);
                this._light.addLayer(layer);
            }
        }
    }

    removeLightFromLayers() {
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.removeLight(this);
                this._light.removeLayer(layer);
            }
        }
    }

    onLayersChanged(oldComp, newComp) {
        if (this.enabled && this.entity.enabled) {
            this.addLightToLayers();
        }
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        const index = this._layers.indexOf(layer.id);
        if (index >= 0 && this.enabled && this.entity.enabled) {
            layer.addLight(this);
            this._light.addLayer(layer);
        }
    }

    onLayerRemoved(layer) {
        const index = this._layers.indexOf(layer.id);
        if (index >= 0) {
            layer.removeLight(this);
            this._light.removeLayer(layer);
        }
    }

    refreshProperties() {
        for (let i = 0; i < _properties.length; i++) {
            const name = _properties[i];

            /* eslint-disable no-self-assign */
            this[name] = this[name];
            /* eslint-enable no-self-assign */
        }
        if (this.enabled && this.entity.enabled) {
            this.onEnable();
        }
    }

    onCookieAssetSet() {
        let forceLoad = false;

        if (this._cookieAsset.type === 'cubemap' && !this._cookieAsset.loadFaces) {
            this._cookieAsset.loadFaces = true;
            forceLoad = true;
        }

        if (!this._cookieAsset.resource || forceLoad) this.system.app.assets.load(this._cookieAsset);

        if (this._cookieAsset.resource) {
            this.onCookieAssetLoad();
        }
    }

    onCookieAssetAdd(asset) {
        if (this._cookieAssetId !== asset.id) return;

        this._cookieAsset = asset;

        if (this._light.enabled) {
            this.onCookieAssetSet();
        }

        this._cookieAsset.on('load', this.onCookieAssetLoad, this);
        this._cookieAsset.on('remove', this.onCookieAssetRemove, this);
    }

    onCookieAssetLoad() {
        if (!this._cookieAsset || !this._cookieAsset.resource) {
            return;
        }

        this.cookie = this._cookieAsset.resource;
    }

    onCookieAssetRemove() {
        if (!this._cookieAssetId) {
            return;
        }

        if (this._cookieAssetAdd) {
            this.system.app.assets.off(`add:${this._cookieAssetId}`, this.onCookieAssetAdd, this);
            this._cookieAssetAdd = false;
        }

        if (this._cookieAsset) {
            this._cookieAsset.off('load', this.onCookieAssetLoad, this);
            this._cookieAsset.off('remove', this.onCookieAssetRemove, this);
            this._cookieAsset = null;
        }

        this.cookie = null;
    }

    onEnable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        this._light.enabled = true;

        this._evtLayersChanged?.off();
        this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);

        if (layers) {
            this._evtLayerAdded?.off();
            this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);

            this._evtLayerRemoved?.off();
            this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
        }

        if (this.enabled && this.entity.enabled) {
            this.addLightToLayers();
        }

        if (this._cookieAsset && !this.cookie) {
            this.onCookieAssetSet();
        }
    }

    onDisable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        this._light.enabled = false;

        this._evtLayersChanged?.off();
        this._evtLayersChanged = null;

        if (layers) {
            this._evtLayerAdded?.off();
            this._evtLayerAdded = null;
            this._evtLayerRemoved?.off();
            this._evtLayerRemoved = null;
        }

        this.removeLightFromLayers();
    }

    onRemove() {
        // remove from layers
        this.onDisable();

        // destroy light node
        this._light.destroy();

        // remove cookie asset events
        this.cookieAsset = null;
    }
}

export { _properties, LightComponent };
