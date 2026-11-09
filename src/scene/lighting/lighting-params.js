import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE, SHADOW_PCF3_32F } from '../constants.js';

/**
 * Lighting parameters, allow configuration of the global lighting parameters. For details see
 * [Clustered Lighting](https://developer.playcanvas.com/user-manual/graphics/lighting/clustered-lighting/).
 *
 * @category Graphics
 */
class LightingParams {
    /** @private */
    _areaLightsEnabled = false;

    /** @private */
    _areaLightRectEnabled = true;

    /** @private */
    _areaLightDiskEnabled = true;

    /** @private */
    _areaLightSphereEnabled = true;

    /** @private */
    _cells = new Vec3(10, 3, 10);

    /** @private */
    _maxLightsPerCell = 255;

    /** @private */
    _maxLights = 255;

    /** @private */
    _shadowsEnabled = true;

    /** @private */
    _shadowType = SHADOW_PCF3_32F;

    /** @private */
    _shadowAtlasResolution = 2048;

    /** @private */
    _cookiesEnabled = false;

    /** @private */
    _cookieAtlasResolution = 2048;

    /**
     * Layer ID of a layer to contain the debug rendering of clustered lighting. Defaults to
     * undefined, which disables the debug rendering. Debug rendering is only included in the debug
     * version of the engine.
     *
     * @type {number}
     */
    debugLayer;

    /**
     * Atlas textures split description, which applies to both the shadow and cookie texture atlas.
     * Defaults to null, which enables to automatic split mode. For details see [Configuring Atlas
     * Split](https://developer.playcanvas.com/user-manual/graphics/lighting/clustered-lighting/#configuring-atlas).
     *
     * @type {number[]|null}
     */
    atlasSplit = null;

    /**
     * Creates a new LightingParams object.
     *
     * @ignore
     */
    constructor(supportsAreaLights, maxTextureSize, dirtyLightsFnc) {
        this._supportsAreaLights = supportsAreaLights;
        this._maxTextureSize = maxTextureSize;
        this._dirtyLightsFnc = dirtyLightsFnc;
    }

    applySettings(render) {
        this.shadowsEnabled = render.lightingShadowsEnabled ?? this.shadowsEnabled;
        this.cookiesEnabled = render.lightingCookiesEnabled ?? this.cookiesEnabled;
        this.areaLightsEnabled = render.lightingAreaLightsEnabled ?? this.areaLightsEnabled;
        this.shadowAtlasResolution = render.lightingShadowAtlasResolution ?? this.shadowAtlasResolution;
        this.cookieAtlasResolution = render.lightingCookieAtlasResolution ?? this.cookieAtlasResolution;
        this.maxLightsPerCell = render.lightingMaxLightsPerCell ?? this.maxLightsPerCell;
        this.maxLights = render.lightingMaxLights ?? this.maxLights;
        this.shadowType = render.lightingShadowType ?? this.shadowType;
        if (render.lightingCells) {
            this.cells = new Vec3(render.lightingCells);
        }
    }

    /**
     * Sets the number of cells along each world space axis the space containing lights is
     * subdivided into. Defaults to `[10, 3, 10]`.
     *
     * @type {Vec3}
     */
    set cells(value) {
        this._cells.copy(value);
    }

    /**
     * Gets the number of cells along each world space axis the space containing lights is
     * subdivided into.
     *
     * @type {Vec3}
     */
    get cells() {
        return this._cells;
    }

    /**
     * Sets the maximum number of lights a cell can store. Defaults to 255.
     *
     * @type {number}
     */
    set maxLightsPerCell(value) {
        this._maxLightsPerCell = math.clamp(value, 1, 255);
    }

    /**
     * Gets the maximum number of lights a cell can store.
     *
     * @type {number}
     */
    get maxLightsPerCell() {
        return this._maxLightsPerCell;
    }

    /**
     * Sets the maximum number of lights the clustered lighting can use in a single frame. Lights
     * over this limit are ignored, and a warning is reported.
     *
     * Values up to 255 store the light index in the light grid using 8 bits, larger values use 16
     * bits and so double the size of the texture the grid is stored in. Defaults to 255.
     *
     * @type {number}
     */
    set maxLights(value) {
        this._maxLights = math.clamp(value, 1, Math.min(65535, this._maxTextureSize - 1));
    }

    /**
     * Gets the maximum number of lights the clustered lighting can use in a single frame.
     *
     * @type {number}
     */
    get maxLights() {
        return this._maxLights;
    }

    /**
     * Sets the resolution of the atlas texture storing all non-directional cookie textures.
     * Defaults to 2048.
     *
     * @type {number}
     */
    set cookieAtlasResolution(value) {
        this._cookieAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
    }

    /**
     * Gets the resolution of the atlas texture storing all non-directional cookie textures.
     *
     * @type {number}
     */
    get cookieAtlasResolution() {
        return this._cookieAtlasResolution;
    }

    /**
     * Sets the resolution of the atlas texture storing all non-directional shadow textures.
     * Defaults to 2048.
     *
     * @type {number}
     */
    set shadowAtlasResolution(value) {
        this._shadowAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
    }

    /**
     * Gets the resolution of the atlas texture storing all non-directional shadow textures.
     *
     * @type {number}
     */
    get shadowAtlasResolution() {
        return this._shadowAtlasResolution;
    }

    /**
     * Sets the type of shadow filtering used by all shadows. Can be:
     *
     * - {@link SHADOW_PCF1_32F}
     * - {@link SHADOW_PCF3_32F}
     * - {@link SHADOW_PCF5_32F}
     * - {@link SHADOW_PCF1_16F}
     * - {@link SHADOW_PCF3_16F}
     * - {@link SHADOW_PCF5_16F}
     *
     * Defaults to {@link SHADOW_PCF3_32F}
     *
     * @type {number}
     */
    set shadowType(value) {
        if (this._shadowType !== value) {
            this._shadowType = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    /**
     * Gets the type of shadow filtering used by all shadows.
     *
     * @type {number}
     */
    get shadowType() {
        return this._shadowType;
    }

    /**
     * Sets whether clustered lighting supports cookie textures. Defaults to false.
     *
     * @type {boolean}
     */
    set cookiesEnabled(value) {
        if (this._cookiesEnabled !== value) {
            this._cookiesEnabled = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    /**
     * Gets whether clustered lighting supports cookie textures.
     *
     * @type {boolean}
     */
    get cookiesEnabled() {
        return this._cookiesEnabled;
    }

    /**
     * Sets whether clustered lighting supports area lights. Defaults to false.
     *
     * @type {boolean}
     */
    set areaLightsEnabled(value) {

        // ignore if not supported
        if (this._supportsAreaLights) {
            if (this._areaLightsEnabled !== value) {
                this._areaLightsEnabled = value;

                // lit shaders need to be rebuilt
                this._dirtyLightsFnc();
            }
        }
    }

    /**
     * Gets whether clustered lighting supports area lights.
     *
     * @type {boolean}
     */
    get areaLightsEnabled() {
        return this._areaLightsEnabled;
    }

    /**
     * Sets whether clustered lighting supports area lights of rectangular shape
     * ({@link LIGHTSHAPE_RECT}). The lit shaders only include the code of the enabled area light
     * shapes, so disabling the shapes a scene does not use makes them faster to compile, most
     * noticeably on Windows. Area lights of a disabled shape are rendered as punctual lights. Only
     * used when {@link LightingParams#areaLightsEnabled} is true. Defaults to true.
     *
     * @type {boolean}
     */
    set areaLightRectEnabled(value) {
        if (this._areaLightRectEnabled !== value) {
            this._areaLightRectEnabled = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    /**
     * Gets whether clustered lighting supports area lights of rectangular shape.
     *
     * @type {boolean}
     */
    get areaLightRectEnabled() {
        return this._areaLightRectEnabled;
    }

    /**
     * Sets whether clustered lighting supports area lights of disk shape ({@link LIGHTSHAPE_DISK}).
     * Area lights of a disabled shape are rendered as punctual lights, see
     * {@link LightingParams#areaLightRectEnabled}. Defaults to true.
     *
     * @type {boolean}
     */
    set areaLightDiskEnabled(value) {
        if (this._areaLightDiskEnabled !== value) {
            this._areaLightDiskEnabled = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    /**
     * Gets whether clustered lighting supports area lights of disk shape.
     *
     * @type {boolean}
     */
    get areaLightDiskEnabled() {
        return this._areaLightDiskEnabled;
    }

    /**
     * Sets whether clustered lighting supports area lights of sphere shape
     * ({@link LIGHTSHAPE_SPHERE}). Area lights of a disabled shape are rendered as punctual lights,
     * see {@link LightingParams#areaLightRectEnabled}. Defaults to true.
     *
     * @type {boolean}
     */
    set areaLightSphereEnabled(value) {
        if (this._areaLightSphereEnabled !== value) {
            this._areaLightSphereEnabled = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    /**
     * Gets whether clustered lighting supports area lights of sphere shape.
     *
     * @type {boolean}
     */
    get areaLightSphereEnabled() {
        return this._areaLightSphereEnabled;
    }

    /**
     * Bit mask (1 << shape) of the area light shapes the clustered lighting supports, 0 when area
     * lights are disabled.
     *
     * @type {number}
     * @ignore
     */
    get areaLightShapes() {
        if (!this._areaLightsEnabled) return 0;
        return (this._areaLightRectEnabled ? 1 << LIGHTSHAPE_RECT : 0) |
            (this._areaLightDiskEnabled ? 1 << LIGHTSHAPE_DISK : 0) |
            (this._areaLightSphereEnabled ? 1 << LIGHTSHAPE_SPHERE : 0);
    }

    /**
     * Sets whether clustered lighting supports shadow casting. Defaults to true.
     *
     * @type {boolean}
     */
    set shadowsEnabled(value) {
        if (this._shadowsEnabled !== value) {
            this._shadowsEnabled = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    /**
     * Gets whether clustered lighting supports shadow casting.
     *
     * @type {boolean}
     */
    get shadowsEnabled() {
        return this._shadowsEnabled;
    }
}

export { LightingParams };
