import { Vec3 } from "../../math/vec3.js";

// clustered lighting parameters
class WorldClustersParams {
    constructor() {
        this.cells = new Vec3(10, 3, 10);
        this.maxLights = 255;
        this.cookiesEnabled = false;
        this.shadowsEnabled = true;
        this.areaLightsEnabled = false;
    }
}

export { WorldClustersParams };
