import { Vec3 } from "../../math/vec3.js";
import { math } from "../../math/math.js";
import { SHADOW_PCF3 } from "../constants.js";

class LightingParams {
    constructor(supportsAreaLights, maxTextureSize, dirtyLightsFnc) {
        this._maxTextureSize = maxTextureSize;
        this._supportsAreaLights = supportsAreaLights;
        this._dirtyLightsFnc = dirtyLightsFnc;

        this._areaLightsEnabled = false;

        this._cells = new Vec3(10, 3, 10);
        this._maxLightsPerCell = 255;

        this._shadowsEnabled = true;
        this._shadowType = SHADOW_PCF3;
        this._shadowAtlasResolution = 2048;

        this._cookiesEnabled = false;
        this._cookieAtlasResolution = 2048;

        // atlas split strategy
        // null: per frame split atlas into equally sized squares for each shadowmap needed
        // array: first number specifies top subdivision of the atlas, following numbers split next level (2 levels only)
        this.atlasSplit = null;

        // Layer ID of a layer for which the debug clustering is rendered
        this.debugLayer = undefined;
    }

    set cells(value) {
        this._cells.copy(value);
    }

    get cells() {
        return this._cells;
    }

    set maxLightsPerCell(value) {
        this._maxLightsPerCell = math.clamp(value, 1, 255);
    }

    get maxLightsPerCell() {
        return this._maxLightsPerCell;
    }

    set cookieAtlasResolution(value) {
        this._cookieAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
    }

    get cookieAtlasResolution() {
        return this._cookieAtlasResolution;
    }

    set shadowAtlasResolution(value) {
        this._shadowAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
    }

    get shadowAtlasResolution() {
        return this._shadowAtlasResolution;
    }

    set shadowType(value) {
        if (this._shadowType !== value) {
            this._shadowType = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    get shadowType() {
        return this._shadowType;
    }

    set cookiesEnabled(value) {
        if (this._cookiesEnabled !== value) {
            this._cookiesEnabled = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    get cookiesEnabled() {
        return this._cookiesEnabled;
    }

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

    get areaLightsEnabled() {
        return this._areaLightsEnabled;
    }

    set shadowsEnabled(value) {
        if (this._shadowsEnabled !== value) {
            this._shadowsEnabled = value;

            // lit shaders need to be rebuilt
            this._dirtyLightsFnc();
        }
    }

    get shadowsEnabled() {
        return this._shadowsEnabled;
    }
}

export { LightingParams };
