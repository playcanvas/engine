import { Material } from '../../scene/materials/material.js';
import { ContainerResource } from '../container.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(device) {
        this._device = device;
    }

    parse(data) {
        const glbResources = GlbParser.parse("filename.glb", data, this._device);
        if (glbResources) {
            const model = ContainerResource.createModel(glbResources, Material.defaultMaterial);
            glbResources.destroy();
            return model;
        }
        return null;
    }
}

export { GlbModelParser };
