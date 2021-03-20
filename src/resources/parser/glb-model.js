import { Material } from '../../scene/materials/material.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(device) {
        this._device = device;
    }

    parse(data) {
        var glb = GlbParser.parse("filename.glb", data, this._device);
        if (!glb) {
            return null;
        }
        return GlbParser.createModel(glb, Material.defaultMaterial);
    }
}

export { GlbModelParser };
