import { Material } from '../../scene/materials/material.js';
import { ContainerResource } from '../container.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(device) {
        this._device = device;
    }

    parse(data) {
        const glb = GlbParser.parse("filename.glb", data, this._device);
        if (!glb) {
            return null;
        }
        return ContainerResource.createModel(glb, Material.defaultMaterial);
    }
}

export { GlbModelParser };
