import { Vec3 } from "../../math/vec3.js";
import { SHADOW_PCF3 } from "../constants.js";

// clustered lighting parameters
class WorldClustersParams {
    constructor() {
        this.cells = new Vec3(10, 3, 10);
        this.maxLights = 255;
        this.areaLightsEnabled = false;

        this.shadowsEnabled = true;
        this.shadowType = SHADOW_PCF3;
        this.shadowAtlasResolution = 2048;

        this.cookiesEnabled = false;
        this.cookieAtlasResolution = 2048;
    }
}

export { WorldClustersParams };
