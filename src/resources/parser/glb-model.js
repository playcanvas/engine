import { GlbContainerResource } from './glb-container-resource.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(device, defaultMaterial) {
        this._device = device;
        this._defaultMaterial = defaultMaterial;
    }

    parse(data) {
        const glbResources = GlbParser.parse("filename.glb", data, this._device);
        if (glbResources) {
            const model = GlbContainerResource.createModel(glbResources, this._defaultMaterial);
            glbResources.destroy();
            return model;
        }
        return null;
    }
}

export { GlbModelParser };
