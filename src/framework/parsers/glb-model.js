import { GlbContainerResource } from './glb-container-resource.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(modelHandler) {
        this._device = modelHandler.device;
        this._defaultMaterial = modelHandler.defaultMaterial;
        this._assets = modelHandler.assets;
    }

    parse(data, callback, asset) {
        GlbParser.parse('filename.glb', '', data, this._device, this._assets, asset?.options ?? {}, (err, result) => {
            if (err) {
                callback(err);
            } else {
                const model = GlbContainerResource.createModel(result, this._defaultMaterial);
                result.destroy();
                callback(null, model);
            }
        });
    }
}

export { GlbModelParser };
