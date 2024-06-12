import { math } from '../../../core/math/math.js';
import { Vec4 } from '../../../core/math/vec4.js';

import { MASK_AFFECT_LIGHTMAPPED, MASK_AFFECT_DYNAMIC, MASK_BAKE } from '../../../scene/constants.js';

import { Asset } from '../../asset/asset.js';

import { Component } from '../component.js';

import { properties } from './data.js';

/**
 * The Light Component enables the Entity to light the scene. There are three types of light:
 * directional, omni and spot. Directional lights are global in that they are considered to be
 * infinitely far away and light the entire scene. Omni and spot lights are local in that they have
 * a position and a range. A spot light is a specialization of an omni light where light is emitted
 * in a cone rather than in all directions. Lights also have the ability to cast shadows to add
 * realism to your scenes.
 *
 * ```javascript
 * // Add a pc.LightComponent to an entity
 * const entity = new pc.Entity();
 * entity.addComponent('light', {
 *     type: "omni",
 *     color: new pc.Color(1, 0, 0),
 *     range: 10
 * });
 *
 * // Get the pc.LightComponent on an entity
 * const lightComponent = entity.light;
 *
 * // Update a property on a light component
 * entity.light.range = 20;
 * ```
 *
 * @category Graphics
 */
class LightComponent extends Component {
    /**
     * Creates a new LightComponent instance.
     *
     * @param {import('./system.js').LightComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._cookieAsset = null;
        this._cookieAssetId = null;
        this._cookieAssetAdd = false;
        this._cookieMatrix = null;
    }

    // TODO: Remove this override in upgrading component
    /**
     * @type {import('./data.js').LightComponentData}
     * @ignore
     */
    get data() {
        const record = this.system.store[this.entity.getGuid()];
        return record ? record.data : null;
    }

    /**
     * Sets the enabled state of the component.
     *
     * @type {boolean}
     */
    set enabled(arg) {
        this._setValue('enabled', arg, function (newValue, oldValue) {
            this.onSetEnabled(null, oldValue, newValue);
        });
    }

    /**
     * Gets the enabled state of the component.
     *
     * @type {boolean}
     */
    get enabled() {
        return this.data.enabled;
    }

    /**
     * @type {import('../../../scene/light.js').Light}
     * @ignore
     */
    set light(arg) {
        this._setValue('light', arg);
    }

    /**
     * @type {import('../../../scene/light.js').Light}
     * @ignore
     */
    get light() {
        return this.data.light;
    }

    /**
     * Sets the type of the light. Can be:
     *
     * - "directional": A light that is infinitely far away and lights the entire scene from one
     * direction.
     * - "omni": An omni-directional light that illuminates in all directions from the light source.
     * - "spot": An omni-directional light but is bounded by a cone.
     *
     * Defaults to "directional".
     *
     * @type {string}
     */
    set type(arg) {
        this._setValue('type', arg, function (newValue, oldValue) {
            this.system.changeType(this, oldValue, newValue);
            this.refreshProperties();
        });
    }

    /**
     * Gets the type of the light.
     *
     * @type {string}
     */
    get type() {
        return this.data.type;
    }

    /**
     * Sets the color of the light. The alpha component of the color is ignored. Defaults to white
     * (`[1, 1, 1]`).
     *
     * @type {import('../../../core/math/color.js').Color};
     */
    set color(arg) {
        this._setValue(
            'color',
            arg,
            function (newValue, oldValue) {
                this.light.setColor(newValue);
            },
            true
        );
    }

    /**
     * Gets the color of the light.
     *
     * @type {import('../../../core/math/color.js').Color};
     */
    get color() {
        return this.data.color;
    }

    /**
     * Sets the brightness of the light. Defaults to 1.
     *
     * @type {number}
     */
    set intensity(arg) {
        this._setValue('intensity', arg, function (newValue, oldValue) {
            this.light.intensity = newValue;
        });
    }

    /**
     * Gets the brightness of the light.
     *
     * @type {number}
     */
    get intensity() {
        return this.data.intensity;
    }

    /**
     * Sets the physically-based luminance. Only used if `scene.physicalUnits` is true. Defaults to 0.
     *
     * @type {number}
     */
    set luminance(arg) {
        this._setValue('luminance', arg, function (newValue, oldValue) {
            this.light.luminance = newValue;
        });
    }

    /**
     * Gets the physically-based luminance.
     *
     * @type {number}
     */
    get luminance() {
        return this.data.luminance;
    }

    /**
     * Sets the light source shape. Can be:
     *
     * - {@link LIGHTSHAPE_PUNCTUAL}: Infinitesimally small point.
     * - {@link LIGHTSHAPE_RECT}: Rectangle shape.
     * - {@link LIGHTSHAPE_DISK}: Disk shape.
     * - {@link LIGHTSHAPE_SPHERE}: Sphere shape.
     *
     * Defaults to pc.LIGHTSHAPE_PUNCTUAL.
     *
     * @type {number}
     */
    set shape(arg) {
        this._setValue('shape', arg, function (newValue, oldValue) {
            this.light.shape = newValue;
        });
    }

    /**
     * Gets the light source shape.
     *
     * @type {number}
     */
    get shape() {
        return this.data.shape;
    }

    /**
     * Sets whether material specularity will be affected by this light. Ignored for lights other
     * than {@link LIGHTTYPE_DIRECTIONAL}. Defaults to true.
     *
     * @type {boolean}
     */
    set affectSpecularity(arg) {
        this._setValue('affectSpecularity', arg, function (newValue, oldValue) {
            this.light.affectSpecularity = newValue;
        });
    }

    /**
     * Gets whether material specularity will be affected by this light.
     *
     * @type {boolean}
     */
    get affectSpecularity() {
        return this.data.affectSpecularity;
    }

    /**
     * Sets whether the light will cast shadows. Defaults to false.
     *
     * @type {boolean}
     */
    set castShadows(arg) {
        this._setValue('castShadows', arg, function (newValue, oldValue) {
            this.light.castShadows = newValue;
        });
    }

    /**
     * Gets whether the light will cast shadows.
     *
     * @type {boolean}
     */
    get castShadows() {
        return this.data.castShadows;
    }

    /**
     * Sets the distance from the viewpoint beyond which shadows are no longer rendered. Affects
     * directional lights only. Defaults to 40.
     *
     * @type {number}
     */
    set shadowDistance(arg) {
        this._setValue('shadowDistance', arg, function (newValue, oldValue) {
            this.light.shadowDistance = newValue;
        });
    }

    /**
     * Gets the distance from the viewpoint beyond which shadows are no longer rendered.
     *
     * @type {number}
     */
    get shadowDistance() {
        return this.data.shadowDistance;
    }

    /**
     * Sets the intensity of the shadow darkening. 0 having no effect and 1 meaning shadows are
     * entirely black. Defaults to 1.
     *
     * @type {number}
     */
    set shadowIntensity(arg) {
        this._setValue('shadowIntensity', arg, function (newValue, oldValue) {
            this.light.shadowIntensity = newValue;
        });
    }

    /**
     * Gets the intensity of the shadow darkening.
     *
     * @type {number}
     */
    get shadowIntensity() {
        return this.data.shadowIntensity;
    }

    /**
     * Sets the size of the texture used for the shadow map. Valid sizes are 64, 128, 256, 512,
     * 1024, 2048. Defaults to 1024.
     *
     * @type {number}
     */
    set shadowResolution(arg) {
        this._setValue('shadowResolution', arg, function (newValue, oldValue) {
            this.light.shadowResolution = newValue;
        });
    }

    /**
     * Gets the size of the texture used for the shadow map.
     *
     * @type {number}
     */
    get shadowResolution() {
        return this.data.shadowResolution;
    }

    /**
     * Set the depth bias for tuning the appearance of the shadow mapping generated by this light. Valid
     * range is 0 to 1. Defaults to 0.05.
     *
     * @type {number}
     */
    set shadowBias(arg) {
        this._setValue('shadowBias', arg, function (newValue, oldValue) {
            this.light.shadowBias = -0.01 * math.clamp(newValue, 0, 1);
        });
    }

    /**
     * Get the depth bias for tuning the appearance of the shadow mapping generated by this light.
     *
     * @type {number}
     */
    get shadowBias() {
        return this.data.shadowBias;
    }

    /**
     * Sets the number of shadow cascades. Can be 1, 2, 3 or 4. Defaults to 1, representing no
     * cascades.
     *
     * @type {number}
     */
    set numCascades(arg) {
        this._setValue('numCascades', arg, function (newValue, oldValue) {
            this.light.numCascades = math.clamp(Math.floor(newValue), 1, 4);
        });
    }

    /**
     * Gets the number of shadow cascades.
     *
     * @type {number}
     */
    get numCascades() {
        return this.data.numCascades;
    }

    /**
     * Sets the number of samples used to bake this light into the lightmap. Defaults to 1. Maximum
     * value is 255.
     *
     * @type {number}
     */
    set bakeNumSamples(arg) {
        this._setValue('bakeNumSamples', arg, function (newValue, oldValue) {
            this.light.bakeNumSamples = math.clamp(Math.floor(newValue), 1, 255);
        });
    }

    /**
     * Gets the number of samples used to bake this light into the lightmap.
     *
     * @type {number}
     */
    get bakeNumSamples() {
        return this.data.bakeNumSamples;
    }

    /**
     * Sets the penumbra angle in degrees, allowing for a soft shadow boundary. Defaults to 0.
     * Requires `bake` to be set to true and the light type is {@link LIGHTTYPE_DIRECTIONAL}.
     *
     * @type {number}
     */
    set bakeArea(arg) {
        this._setValue('bakeArea', arg, function (newValue, oldValue) {
            this.light.bakeArea = math.clamp(newValue, 0, 180);
        });
    }

    /**
     * Gets the penumbra angle in degrees.
     *
     * @type {number}
     */
    get bakeArea() {
        return this.data.bakeArea;
    }

    /**
     * Sets the distribution of subdivision of the camera frustum for individual shadow cascades.
     * Only used if {@link LightComponent#numCascades} is larger than 1. Can be a value in range of
     * 0 and 1. Value of 0 represents a linear distribution, value of 1 represents a logarithmic
     * distribution. Defaults to 0.5. Larger value increases the resolution of the shadows in the
     * near distance.
     *
     * @type {number}
     */
    set cascadeDistribution(arg) {
        this._setValue('cascadeDistribution', arg, function (newValue, oldValue) {
            this.light.cascadeDistribution = math.clamp(newValue, 0, 1);
        });
    }

    /**
     * Gets the distribution of subdivision of the camera frustum for individual shadow cascades.
     *
     * @type {number}
     */
    get cascadeDistribution() {
        return this.data.cascadeDistribution;
    }

    /**
     * Sets the normal offset depth bias. Valid range is 0 to 1. Defaults to 0.
     *
     * @type {number}
     */
    set normalOffsetBias(arg) {
        this._setValue('normalOffsetBias', arg, function (newValue, oldValue) {
            this.light.normalOffsetBias = math.clamp(newValue, 0, 1);
        });
    }

    /**
     * Gets the normal offset depth bias.
     *
     * @type {number}
     */
    get normalOffsetBias() {
        return this.data.normalOffsetBias;
    }

    /**
     * Sets the range of the light. Affects omni and spot lights only. Defaults to 10.
     *
     * @type {number}
     */
    set range(arg) {
        this._setValue('range', arg, function (newValue, oldValue) {
            this.light.attenuationEnd = newValue;
        });
    }

    /**
     * Gets the range of the light.
     *
     * @type {number}
     */
    get range() {
        return this.data.range;
    }

    /**
     * Sets the angle at which the spotlight cone starts to fade off. The angle is specified in
     * degrees. Affects spot lights only. Defaults to 40.
     *
     * @type {number}
     */
    set innerConeAngle(arg) {
        this._setValue('innerConeAngle', arg, function (newValue, oldValue) {
            this.light.innerConeAngle = newValue;
        });
    }

    /**
     * Gets the angle at which the spotlight cone starts to fade off.
     *
     * @type {number}
     */
    get innerConeAngle() {
        return this.data.innerConeAngle;
    }

    /**
     * Sets the angle at which the spotlight cone has faded to nothing. The angle is specified in
     * degrees. Affects spot lights only. Defaults to 45.
     *
     * @type {number}
     */
    set outerConeAngle(arg) {
        this._setValue('outerConeAngle', arg, function (newValue, oldValue) {
            this.light.outerConeAngle = newValue;
        });
    }

    /**
     * Gets the angle at which the spotlight cone has faded to nothing.
     *
     * @type {number}
     */
    get outerConeAngle() {
        return this.data.outerConeAngle;
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
    set falloffMode(arg) {
        this._setValue('falloffMode', arg, function (newValue, oldValue) {
            this.light.falloffMode = newValue;
        });
    }

    /**
     * Gets the fall off mode for the light.
     *
     * @type {number}
     */
    get falloffMode() {
        return this.data.falloffMode;
    }

    /**
     * Sets the type of shadows being rendered by this light. Can be:
     *
     * - {@link SHADOW_PCF3}: Render depth (color-packed on WebGL 1.0), can be used for PCF 3x3
     * sampling.
     * - {@link SHADOW_VSM8}: Render packed variance shadow map. All shadow receivers must also cast
     * shadows for this mode to work correctly.
     * - {@link SHADOW_VSM16}: Render 16-bit exponential variance shadow map. Requires
     * OES_texture_half_float extension. Falls back to {@link SHADOW_VSM8}, if not supported.
     * - {@link SHADOW_VSM32}: Render 32-bit exponential variance shadow map. Requires
     * OES_texture_float extension. Falls back to {@link SHADOW_VSM16}, if not supported.
     * - {@link SHADOW_PCF5}: Render depth buffer only, can be used for hardware-accelerated PCF 5x5
     * sampling. Requires WebGL2. Falls back to {@link SHADOW_PCF3} on WebGL 1.0.
     * - {@link SHADOW_PCSS}: Render depth as color, and use the software sampled PCSS method for shadows.
     *
     * @type {number}
     */
    set shadowType(arg) {
        this._setValue('shadowType', arg, function (newValue, oldValue) {
            this.light.shadowType = newValue;
        });
    }

    /**
     * Gets the type of shadows being rendered by this light.
     *
     * @type {number}
     */
    get shadowType() {
        return this.data.shadowType;
    }

    /**
     * Sets the number of samples used for blurring a variance shadow map. Only uneven numbers
     * work, even are incremented. Minimum value is 1, maximum is 25. Defaults to 11.
     *
     * @type {number}
     */
    set vsmBlurSize(arg) {
        this._setValue('vsmBlurSize', arg, function (newValue, oldValue) {
            this.light.vsmBlurSize = newValue;
        });
    }

    /**
     * Gets the number of samples used for blurring a variance shadow map.
     *
     * @type {number}
     */
    get vsmBlurSize() {
        return this.data.vsmBlurSize;
    }

    /**
     * Sets the blurring mode for variance shadow maps. Can be:
     *
     * - {@link BLUR_BOX}: Box filter.
     * - {@link BLUR_GAUSSIAN}: Gaussian filter. May look smoother than box, but requires more samples.
     *
     * @type {number}
     */
    set vsmBlurMode(arg) {
        this._setValue('vsmBlurMode', arg, function (newValue, oldValue) {
            this.light.vsmBlurMode = newValue;
        });
    }

    /**
     * Gets the blurring mode for variance shadow maps.
     *
     * @type {number}
     */
    get vsmBlurMode() {
        return this.data.vsmBlurMode;
    }

    /**
     * Sets the VSM bias value.
     *
     * @type {number}
     */
    set vsmBias(arg) {
        this._setValue('vsmBias', arg, function (newValue, oldValue) {
            this.light.vsmBias = math.clamp(newValue, 0, 1);
        });
    }

    /**
     * Gets the VSM bias value.
     *
     * @type {number}
     */
    get vsmBias() {
        return this.data.vsmBias;
    }

    /**
     * Sets the texture asset to be used as the cookie for this light. Only spot and omni lights can
     * have cookies. Defaults to null.
     *
     * @type {number|null}
     */
    set cookieAsset(arg) {
        this._setValue('cookieAsset', arg, function (newValue, oldValue) {
            if (
                this._cookieAssetId &&
                ((newValue instanceof Asset && newValue.id === this._cookieAssetId) || newValue === this._cookieAssetId)
            )
                return;
            this.onCookieAssetRemove();
            this._cookieAssetId = null;
            if (newValue instanceof Asset) {
                this.data.cookieAsset = newValue.id;
                this._cookieAssetId = newValue.id;
                this.onCookieAssetAdd(newValue);
            } else if (typeof newValue === 'number') {
                this._cookieAssetId = newValue;
                const asset = this.system.app.assets.get(newValue);
                if (asset) {
                    this.onCookieAssetAdd(asset);
                } else {
                    this._cookieAssetAdd = true;
                    this.system.app.assets.on('add:' + this._cookieAssetId, this.onCookieAssetAdd, this);
                }
            }
        });
    }

    /**
     * Gets the texture asset to be used as the cookie for this light.
     *
     * @type {number|null}
     */
    get cookieAsset() {
        return this.data.cookieAsset;
    }

    /**
     * Sets the texture to be used as the cookie for this light. Only spot and omni lights can have
     * cookies. Defaults to null.
     *
     * @type {import('../../../platform/graphics/texture.js').Texture|null}
     */
    set cookie(arg) {
        this._setValue('cookie', arg, function (newValue, oldValue) {
            this.light.cookie = newValue;
        });
    }

    /**
     * Gets the texture to be used as the cookie for this light.
     *
     * @type {import('../../../platform/graphics/texture.js').Texture|null}
     */
    get cookie() {
        return this.data.cookie;
    }

    /**
     * Sets the cookie texture intensity. Defaults to 1.
     *
     * @type {number}
     */
    set cookieIntensity(arg) {
        this._setValue('cookieIntensity', arg, function (newValue, oldValue) {
            this.light.cookieIntensity = math.clamp(newValue, 0, 1);
        });
    }

    /**
     * Gets the cookie texture intensity.
     *
     * @type {number}
     */
    get cookieIntensity() {
        return this.data.cookieIntensity;
    }

    /**
     * Sets whether normal spotlight falloff is active when a cookie texture is set. When set to
     * false, a spotlight will work like a pure texture projector (only fading with distance).
     * Default is false.
     *
     * @type {boolean}
     */
    set cookieFalloff(arg) {
        this._setValue('cookieFalloff', arg, function (newValue, oldValue) {
            this.light.cookieFalloff = newValue;
        });
    }

    /**
     * Gets whether normal spotlight falloff is active when a cookie texture is set.
     *
     * @type {boolean}
     */
    get cookieFalloff() {
        return this.data.cookieFalloff;
    }

    /**
     * Sets the color channels of the cookie texture to use. Can be "r", "g", "b", "a", "rgb".
     *
     * @type {string}
     */
    set cookieChannel(arg) {
        this._setValue('cookieChannel', arg, function (newValue, oldValue) {
            this.light.cookieChannel = newValue;
        });
    }

    /**
     * Gets the color channels of the cookie texture to use.
     *
     * @type {string}
     */
    get cookieChannel() {
        return this.data.cookieChannel;
    }

    /**
     * Sets the angle for spotlight cookie rotation (in degrees).
     *
     * @type {number}
     */
    set cookieAngle(arg) {
        this._setValue('cookieAngle', arg, function (newValue, oldValue) {
            if (newValue !== 0 || this.cookieScale !== null) {
                if (!this._cookieMatrix) this._cookieMatrix = new Vec4();
                let scx = 1;
                let scy = 1;
                if (this.cookieScale) {
                    scx = this.cookieScale.x;
                    scy = this.cookieScale.y;
                }
                const c = Math.cos(newValue * math.DEG_TO_RAD);
                const s = Math.sin(newValue * math.DEG_TO_RAD);
                this._cookieMatrix.set(c / scx, -s / scx, s / scy, c / scy);
                this.light.cookieTransform = this._cookieMatrix;
            } else {
                this.light.cookieTransform = null;
            }
        });
    }

    /**
     * Gets the angle for spotlight cookie rotation (in degrees).
     *
     * @type {number}
     */
    get cookieAngle() {
        return this.data.cookieAngle;
    }

    /**
     * Sets the spotlight cookie scale.
     *
     * @type {import('../../../core/math/vec2.js').Vec2|null}
     */
    set cookieScale(arg) {
        this._setValue(
            'cookieScale',
            arg,
            function (newValue, oldValue) {
                if (newValue !== null || this.cookieAngle !== 0) {
                    if (!this._cookieMatrix) this._cookieMatrix = new Vec4();
                    const scx = newValue.x;
                    const scy = newValue.y;
                    const c = Math.cos(this.cookieAngle * math.DEG_TO_RAD);
                    const s = Math.sin(this.cookieAngle * math.DEG_TO_RAD);
                    this._cookieMatrix.set(c / scx, -s / scx, s / scy, c / scy);
                    this.light.cookieTransform = this._cookieMatrix;
                } else {
                    this.light.cookieTransform = null;
                }
            },
            true
        );
    }

    /**
     * Gets the spotlight cookie scale.
     *
     * @type {import('../../../core/math/vec2.js').Vec2|null}
     */
    get cookieScale() {
        return this.data.cookieScale;
    }

    /**
     * Sets the spotlight cookie position offset.
     *
     * @type {import('../../../core/math/vec2.js').Vec2|null}
     */
    set cookieOffset(arg) {
        this._setValue(
            'cookieOffset',
            arg,
            function (newValue, oldValue) {
                this.light.cookieOffset = newValue;
            },
            true
        );
    }

    /**
     * Gets the spotlight cookie position offset.
     *
     * @type {import('../../../core/math/vec2.js').Vec2|null}
     */
    get cookieOffset() {
        return this.data.cookieOffset;
    }

    /**
     * Sets the shadow update model. This tells the renderer how often shadows must be updated for
     * this light. Can be:
     *
     * - {@link SHADOWUPDATE_NONE}: Don't render shadows.
     * - {@link SHADOWUPDATE_THISFRAME}: Render shadows only once (then automatically switches
     * to {@link SHADOWUPDATE_NONE}.
     * - {@link SHADOWUPDATE_REALTIME}: Render shadows every frame (default).
     *
     * @type {number}
     */
    set shadowUpdateMode(arg) {
        this._setValue(
            'shadowUpdateMode',
            arg,
            function (newValue, oldValue) {
                this.light.shadowUpdateMode = newValue;
            },
            true
        );
    }

    /**
     * Gets the shadow update model.
     *
     * @type {number}
     */
    get shadowUpdateMode() {
        return this.data.shadowUpdateMode;
    }

    /**
     * Sets the mask to determine which {@link MeshInstance}s are lit by this light. Defaults to 1.
     *
     * @type {number}
     */
    set mask(arg) {
        this._setValue('mask', arg, function (newValue, oldValue) {
            this.light.mask = newValue;
        });
    }

    /**
     * Gets the mask to determine which {@link MeshInstance}s are lit by this light.
     *
     * @type {number}
     */
    get mask() {
        return this.data.mask;
    }

    /**
     * Sets whether the light will affect non-lightmapped objects.
     *
     * @type {boolean}
     */
    set affectDynamic(arg) {
        this._setValue('affectDynamic', arg, function (newValue, oldValue) {
            if (newValue) {
                this.light.mask |= MASK_AFFECT_DYNAMIC;
            } else {
                this.light.mask &= ~MASK_AFFECT_DYNAMIC;
            }
            this.light.layersDirty();
        });
    }

    /**
     * Gets whether the light will affect non-lightmapped objects.
     *
     * @type {boolean}
     */
    get affectDynamic() {
        return this.data.affectDynamic;
    }

    /**
     * Sets whether the light will affect lightmapped objects.
     *
     * @type {boolean}
     */
    set affectLightmapped(arg) {
        this._setValue('affectLightmapped', arg, function (newValue, oldValue) {
            if (newValue) {
                this.light.mask |= MASK_AFFECT_LIGHTMAPPED;
                if (this.bake) this.light.mask &= ~MASK_BAKE;
            } else {
                this.light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
                if (this.bake) this.light.mask |= MASK_BAKE;
            }
        });
    }

    /**
     * Gets whether the light will affect lightmapped objects.
     *
     * @type {boolean}
     */
    get affectLightmapped() {
        return this.data.affectLightmapped;
    }

    /**
     * Sets whether the light will be rendered into lightmaps.
     *
     * @type {boolean}
     */
    set bake(arg) {
        this._setValue('bake', arg, function (newValue, oldValue) {
            if (newValue) {
                this.light.mask |= MASK_BAKE;
                if (this.affectLightmapped) this.light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
            } else {
                this.light.mask &= ~MASK_BAKE;
                if (this.affectLightmapped) this.light.mask |= MASK_AFFECT_LIGHTMAPPED;
            }
            this.light.layersDirty();
        });
    }

    /**
     * Gets whether the light will be rendered into lightmaps.
     *
     * @type {boolean}
     */
    get bake() {
        return this.data.bake;
    }

    /**
     * Sets whether the light's direction will contribute to directional lightmaps. The light must
     * be enabled and `bake` set to true. Be aware, that directional lightmap is an approximation
     * and can only hold single direction per pixel. Intersecting multiple lights with bakeDir=true
     * may lead to incorrect look of specular/bump-mapping in the area of intersection. The error
     * is not always visible though, and highly scene-dependent.
     *
     * @type {boolean}
     */
    set bakeDir(arg) {
        this._setValue('bakeDir', arg, function (newValue, oldValue) {
            this.light.bakeDir = newValue;
        });
    }

    /**
     * Gets whether the light's direction will contribute to directional lightmaps.
     *
     * @type {boolean}
     */
    get bakeDir() {
        return this.data.bakeDir;
    }

    /**
     * Sets whether the light ever moves. This is an optimization hint.
     *
     * @type {boolean}
     */
    set isStatic(arg) {
        this._setValue('isStatic', arg, function (newValue, oldValue) {
            this.light.isStatic = newValue;
        });
    }

    /**
     * Gets whether the light ever moves.
     *
     * @type {boolean}
     */
    get isStatic() {
        return this.data.isStatic;
    }

    /**
     * Sets the array of layer IDs ({@link Layer#id}) to which this light should belong. Don't
     * push/pop/splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(arg) {
        this._setValue('layers', arg, function (newValue, oldValue) {
            for (let i = 0; i < oldValue.length; i++) {
                const layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
                if (!layer) continue;
                layer.removeLight(this);
                this.light.removeLayer(layer);
            }
            for (let i = 0; i < newValue.length; i++) {
                const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
                if (!layer) continue;
                if (this.enabled && this.entity.enabled) {
                    layer.addLight(this);
                    this.light.addLayer(layer);
                }
            }
        });
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this light should belong.
     *
     * @type {number[]}
     */
    get layers() {
        return this.data.layers;
    }

    /**
     * Sets an array of SHADOWUPDATE_ settings per shadow cascade. Set to undefined if not used.
     *
     * @type {number[] | null}
     */
    set shadowUpdateOverrides(values) {
        this.light.shadowUpdateOverrides = values;
    }

    /**
     * Gets an array of SHADOWUPDATE_ settings per shadow cascade.
     *
     * @type {number[] | null}
     */
    get shadowUpdateOverrides() {
        return this.light.shadowUpdateOverrides;
    }

    /**
     * Sets the size of penumbra for contact hardening shadows. For area lights, acts as a
     * multiplier with the dimensions of the area light. For punctual and directional lights it's
     * the area size of the light. Defaults to 1.
     *
     * @type {number}
     */
    set penumbraSize(value) {
        this.light.penumbraSize = value;
    }

    /**
     * Gets the size of penumbra for contact hardening shadows.
     *
     * @type {number}
     */
    get penumbraSize() {
        return this.light.penumbraSize;
    }

    /** @ignore */
    _setValue(name, value, setFunc, skipEqualsCheck) {
        const data = this.data;
        const oldValue = data[name];
        if (!skipEqualsCheck && oldValue === value) return;
        data[name] = value;
        if (setFunc) setFunc.call(this, value, oldValue);
    }

    addLightToLayers() {
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (layer) {
                layer.addLight(this);
                this.light.addLayer(layer);
            }
        }
    }

    removeLightFromLayers() {
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (layer) {
                layer.removeLight(this);
                this.light.removeLayer(layer);
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
        const index = this.layers.indexOf(layer.id);
        if (index >= 0 && this.enabled && this.entity.enabled) {
            layer.addLight(this);
            this.light.addLayer(layer);
        }
    }

    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index >= 0) {
            layer.removeLight(this);
            this.light.removeLayer(layer);
        }
    }

    refreshProperties() {
        for (let i = 0; i < properties.length; i++) {
            const name = properties[i];

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

        if (this.light.enabled) {
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
            this.system.app.assets.off('add:' + this._cookieAssetId, this.onCookieAssetAdd, this);
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
        this.light.enabled = true;

        this.system.app.scene.on('set:layers', this.onLayersChanged, this);
        if (this.system.app.scene.layers) {
            this.system.app.scene.layers.on('add', this.onLayerAdded, this);
            this.system.app.scene.layers.on('remove', this.onLayerRemoved, this);
        }

        if (this.enabled && this.entity.enabled) {
            this.addLightToLayers();
        }

        if (this._cookieAsset && !this.cookie) {
            this.onCookieAssetSet();
        }
    }

    onDisable() {
        this.light.enabled = false;

        this.system.app.scene.off('set:layers', this.onLayersChanged, this);
        if (this.system.app.scene.layers) {
            this.system.app.scene.layers.off('add', this.onLayerAdded, this);
            this.system.app.scene.layers.off('remove', this.onLayerRemoved, this);
        }

        this.removeLightFromLayers();
    }

    onRemove() {
        // remove from layers
        this.onDisable();

        // destroy light node
        this.light.destroy();

        // remove cookie asset events
        this.cookieAsset = null;
    }
}

export { LightComponent };
