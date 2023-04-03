import { GlbContainerResource } from './glb-container-resource.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(modelHandler) {
        this.modelHandler = modelHandler;
    }

    parse(data, callback, asset) {
        GlbParser.parse('filename.glb', '', data, this.modelHandler.device, this.modelHandler.assets, asset?.options, (err, result) => {
            if (err) {
                callback(err);
            } else {
                const model = GlbContainerResource.createModel(result, this.modelHandler.defaultMaterial);
                result.destroy();
                callback(null, model);
            }
        });
    }
}

export { GlbModelParser };
