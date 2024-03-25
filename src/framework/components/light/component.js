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
     * @type {boolean}
     */
    set enabled(arg) {
        this._setValue('enabled', arg, function (newValue, oldValue) {
            this.onSetEnabled(null, oldValue, newValue);
        });
    }

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

    get light() {
        return this.data.light;
    }

    /**
     * The type of light. Can be:
     *
     * - "directional": A light that is infinitely far away and lights the entire scene from one
     * direction.
     * - "omni": An omni-directional light that illuminates in all directions from the light source.
     * - "spot": An omni-directional light but is bounded by a cone.
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

    get type() {
        return this.data.type;
    }

    /**
     * The Color of the light. The alpha component of the color is ignored.
     * Defaults to white (1, 1, 1).
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

    get color() {
        return this.data.color;
    }

    /**
     * The brightness of the light. Defaults to 1.
     *
     * @type {number}
     */
    set intensity(arg) {
        this._setValue('intensity', arg, function (newValue, oldValue) {
            this.light.intensity = newValue;
        });
    }

    get intensity() {
        return this.data.intensity;
    }

    /**
     * The physically based luminance. Only used if scene.physicalUnits is true. Defaults to 0.
     *
     * @type {number}
     */
    set luminance(arg) {
        this._setValue('luminance', arg, function (newValue, oldValue) {
            this.light.luminance = newValue;
        });
    }

    get luminance() {
        return this.data.luminance;
    }

    /**
     * The light source shape. Can be:
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

    get shape() {
        return this.data.shape;
    }

    /**
     * If enabled, material specularity will be affected by this light.
     * Ignored for lights other than {@link LIGHTTYPE_DIRECTIONAL}. Defaults to true.
     *
     * @type {boolean}
     */
    set affectSpecularity(arg) {
        this._setValue('affectSpecularity', arg, function (newValue, oldValue) {
            this.light.affectSpecularity = newValue;
        });
    }

    get affectSpecularity() {
        return this.data.affectSpecularity;
    }

    /**
     * If enabled the light will cast shadows. Defaults to false.
     *
     * @type {boolean}
     */
    set castShadows(arg) {
        this._setValue('castShadows', arg, function (newValue, oldValue) {
            this.light.castShadows = newValue;
        });
    }

    get castShadows() {
        return this.data.castShadows;
    }

    /**
     * The distance from the viewpoint beyond which shadows are no
     * longer rendered. Affects directional lights only. Defaults to 40.
     *
     * @type {number}
     */
    set shadowDistance(arg) {
        this._setValue('shadowDistance', arg, function (newValue, oldValue) {
            this.light.shadowDistance = newValue;
        });
    }

    get shadowDistance() {
        return this.data.shadowDistance;
    }

    /**
     * The intensity of the shadow darkening, 1 being shadows are entirely black.
     * Defaults to 1.
     *
     * @type {number}
     */
    set shadowIntensity(arg) {
        this._setValue('shadowIntensity', arg, function (newValue, oldValue) {
            this.light.shadowIntensity = newValue;
        });
    }

    get shadowIntensity() {
        return this.data.shadowIntensity;
    }

    /**
     * The size of the texture used for the shadow map. Valid sizes
     * are 64, 128, 256, 512, 1024, 2048. Defaults to 1024.
     *
     * @type {number}
     */
    set shadowResolution(arg) {
        this._setValue('shadowResolution', arg, function (newValue, oldValue) {
            this.light.shadowResolution = newValue;
        });
    }

    get shadowResolution() {
        return this.data.shadowResolution;
    }

    /**
     * The depth bias for tuning the appearance of the shadow mapping generated by this light. Valid
     * range is 0 to 1. Defaults to 0.05.
     *
     * @type {number}
     */
    set shadowBias(arg) {
        this._setValue('shadowBias', arg, function (newValue, oldValue) {
            this.light.shadowBias = -0.01 * math.clamp(newValue, 0, 1);
        });
    }

    get shadowBias() {
        return this.data.shadowBias;
    }

    /**
     * Number of shadow cascades. Can be 1, 2, 3 or 4. Defaults to 1,
     * representing no cascades.
     *
     * @type {number}
     */
    set numCascades(arg) {
        this._setValue('numCascades', arg, function (newValue, oldValue) {
            this.light.numCascades = math.clamp(Math.floor(newValue), 1, 4);
        });
    }

    get numCascades() {
        return this.data.numCascades;
    }

    /**
     * If bake is true, this specifies the number of samples used to
     * bake this light into the lightmap. Defaults to 1. Maximum value is 255.
     *
     * @type {number}
     */
    set bakeNumSamples(arg) {
        this._setValue('bakeNumSamples', arg, function (newValue, oldValue) {
            this.light.bakeNumSamples = math.clamp(Math.floor(newValue), 1, 255);
        });
    }

    get bakeNumSamples() {
        return this.data.bakeNumSamples;
    }

    /**
     * If bake is true and the light type is {@link LIGHTTYPE_DIRECTIONAL},
     * this specifies the penumbra angle in degrees, allowing a soft shadow boundary. Defaults to 0.
     *
     * @type {number}
     */
    set bakeArea(arg) {
        this._setValue('bakeArea', arg, function (newValue, oldValue) {
            this.light.bakeArea = math.clamp(newValue, 0, 180);
        });
    }

    get bakeArea() {
        return this.data.bakeArea;
    }

    /**
     * The distribution of subdivision of the camera frustum for individual shadow cascades.
     * Only used if {@link LightComponent#numCascades} is larger than 1.
     * Can be a value in range of 0 and 1. Value of 0 represents a linear distribution, value of 1
     * represents a logarithmic distribution. Defaults to 0.5. Larger value increases the resolution of
     * the shadows in the near distance.
     *
     * @type {number}
     */
    set cascadeDistribution(arg) {
        this._setValue('cascadeDistribution', arg, function (newValue, oldValue) {
            this.light.cascadeDistribution = math.clamp(newValue, 0, 1);
        });
    }

    get cascadeDistribution() {
        return this.data.cascadeDistribution;
    }

    /**
     * Normal offset depth bias. Valid range is 0 to 1. Defaults to 0.
     *
     * @type {number}
     */
    set normalOffsetBias(arg) {
        this._setValue('normalOffsetBias', arg, function (newValue, oldValue) {
            this.light.normalOffsetBias = math.clamp(newValue, 0, 1);
        });
    }

    get normalOffsetBias() {
        return this.data.normalOffsetBias;
    }

    /**
     * The range of the light. Affects omni and spot lights only. Defaults to 10.
     *
     * @type {number}
     */
    set range(arg) {
        this._setValue('range', arg, function (newValue, oldValue) {
            this.light.attenuationEnd = newValue;
        });
    }

    get range() {
        return this.data.range;
    }

    /**
     * The angle at which the spotlight cone starts to fade off. The
     * angle is specified in degrees. Affects spot lights only. Defaults to 40.
     *
     * @type {number}
     */
    set innerConeAngle(arg) {
        this._setValue('innerConeAngle', arg, function (newValue, oldValue) {
            this.light.innerConeAngle = newValue;
        });
    }

    get innerConeAngle() {
        return this.data.innerConeAngle;
    }

    /**
     * The angle at which the spotlight cone has faded to nothing.
     * The angle is specified in degrees. Affects spot lights only. Defaults to 45.
     *
     * @type {number}
     */
    set outerConeAngle(arg) {
        this._setValue('outerConeAngle', arg, function (newValue, oldValue) {
            this.light.outerConeAngle = newValue;
        });
    }

    get outerConeAngle() {
        return this.data.outerConeAngle;
    }

    /**
     * Controls the rate at which a light attenuates from its position. Can be:
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

    get falloffMode() {
        return this.data.falloffMode;
    }

    /**
     * Type of shadows being rendered by this light. Options:
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

    get shadowType() {
        return this.data.shadowType;
    }

    /**
     * Number of samples used for blurring a variance shadow map. Only uneven numbers work,
     * even are incremented. Minimum value is 1, maximum is 25. Defaults to 11.
     *
     * @type {number}
     */
    set vsmBlurSize(arg) {
        this._setValue('vsmBlurSize', arg, function (newValue, oldValue) {
            this.light.vsmBlurSize = newValue;
        });
    }

    get vsmBlurSize() {
        return this.data.vsmBlurSize;
    }

    /**
     * Blurring mode for variance shadow maps. Can be:
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

    get vsmBlurMode() {
        return this.data.vsmBlurMode;
    }

    /**
     * TODO:
     *
     * @type {number}
     */
    set vsmBias(arg) {
        this._setValue('vsmBias', arg, function (newValue, oldValue) {
            this.light.vsmBias = math.clamp(newValue, 0, 1);
        });
    }

    get vsmBias() {
        return this.data.vsmBias;
    }

    /**
     * Asset that has texture that will be assigned to cookie internally
     * once asset resource is available.
     *
     * @type {number}
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

    get cookieAsset() {
        return this.data.cookieAsset;
    }

    /**
     * Projection texture. Must be 2D for spot and cubemap for omni light
     * (ignored if incorrect type is used).
     *
     * @type {import('../../../platform/graphics/texture.js').Texture}
     */
    set cookie(arg) {
        this._setValue('cookie', arg, function (newValue, oldValue) {
            this.light.cookie = newValue;
        });
    }

    get cookie() {
        return this.data.cookie;
    }

    /**
     * Projection texture intensity (default is 1).
     *
     * @type {number}
     */
    set cookieIntensity(arg) {
        this._setValue('cookieIntensity', arg, function (newValue, oldValue) {
            this.light.cookieIntensity = math.clamp(newValue, 0, 1);
        });
    }

    get cookieIntensity() {
        return this.data.cookieIntensity;
    }

    /**
     * Toggle normal spotlight falloff when projection texture is used. When set to false,
     * spotlight will work like a pure texture projector (only fading with
     * distance). Default is false.
     *
     * @type {boolean}
     */
    set cookieFalloff(arg) {
        this._setValue('cookieFalloff', arg, function (newValue, oldValue) {
            this.light.cookieFalloff = newValue;
        });
    }

    get cookieFalloff() {
        return this.data.cookieFalloff;
    }

    /**
     * Color channels of the projection texture to use. Can be "r", "g", "b", "a", "rgb".
     *
     * @type {string}
     */
    set cookieChannel(arg) {
        this._setValue('cookieChannel', arg, function (newValue, oldValue) {
            this.light.cookieChannel = newValue;
        });
    }

    get cookieChannel() {
        return this.data.cookieChannel;
    }

    /**
     * Angle for spotlight cookie rotation.
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

    get cookieAngle() {
        return this.data.cookieAngle;
    }

    /**
     * Spotlight cookie scale.
     *
     * @type {import('../../../core/math/vec2.js').Vec2}
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

    get cookieScale() {
        return this.data.cookieScale;
    }

    /**
     * Spotlight cookie position offset.
     *
     * @type {import('../../../core/math/vec2.js').Vec2}
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

    get cookieOffset() {
        return this.data.cookieOffset;
    }

    /**
     * Tells the renderer how often shadows must be updated for
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

    get shadowUpdateMode() {
        return this.data.shadowUpdateMode;
    }

    /**
     * Defines a mask to determine which {@link MeshInstance}s are lit by this
     * light. Defaults to 1.
     *
     * @type {number}
     */
    set mask(arg) {
        this._setValue('mask', arg, function (newValue, oldValue) {
            this.light.mask = newValue;
        });
    }

    get mask() {
        return this.data.mask;
    }

    /**
     * If enabled the light will affect non-lightmapped objects.
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

    get affectDynamic() {
        return this.data.affectDynamic;
    }

    /**
     * If enabled the light will affect lightmapped objects.
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

    get affectLightmapped() {
        return this.data.affectLightmapped;
    }

    /**
     * If enabled the light will be rendered into lightmaps.
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

    get bake() {
        return this.data.bake;
    }

    /**
     * If enabled and bake=true, the light's direction will contribute to
     * directional lightmaps. Be aware, that directional lightmap is an approximation and can only hold
     * single direction per pixel. Intersecting multiple lights with bakeDir=true may lead to incorrect
     * look of specular/bump-mapping in the area of intersection. The error is not always visible
     * though, and highly scene-dependent.
     *
     * @type {boolean}
     */
    set bakeDir(arg) {
        this._setValue('bakeDir', arg, function (newValue, oldValue) {
            this.light.bakeDir = newValue;
        });
    }

    get bakeDir() {
        return this.data.bakeDir;
    }

    /**
     * Mark light as non-movable (optimization).
     *
     * @type {boolean}
     */
    set isStatic(arg) {
        this._setValue('isStatic', arg, function (newValue, oldValue) {
            this.light.isStatic = newValue;
        });
    }

    get isStatic() {
        return this.data.isStatic;
    }

    /**
     * An array of layer IDs ({@link Layer#id}) to which this light should
     * belong. Don't push/pop/splice or modify this array, if you want to change it - set a new one
     * instead.
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

    get layers() {
        return this.data.layers;
    }

    /**
     * Returns an array of SHADOWUPDATE_ settings per shadow cascade, or undefined if not used.
     *
     * @type {number[] | null}
     */
    set shadowUpdateOverrides(values) {
        this.light.shadowUpdateOverrides = values;
    }

    get shadowUpdateOverrides() {
        return this.light.shadowUpdateOverrides;
    }

    /**
     * Size of penumbra for contact hardening shadows. For area lights acts as a multiplier with
     * the dimensions of the area light. For punctual and directional lights
     * it's the area size of the light. Defaults to 1.0.
     *
     * @type {number}
     */
    set penumbraSize(value) {
        this.light.penumbraSize = value;
    }

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
