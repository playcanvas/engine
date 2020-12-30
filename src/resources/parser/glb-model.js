import { getDefaultMaterial } from '../../scene/materials/default-material.js';

import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(device) {
        this._device = device;
        this._defaultMaterial = getDefaultMaterial();
    }

    parse(data) {
        var glb = GlbParser.parse("filename.glb", data, this._device);
        if (!glb) {
            return null;
        }
        return GlbParser.createModel(glb, this._defaultMaterial);
    }
}

export { GlbModelParser };
