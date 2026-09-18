import { path } from '../../core/path.js';
import { Http } from '../../platform/net/http.js';
import { GlbContainerResource } from './glb-container-resource.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
    constructor(modelHandler) {
        this._device = modelHandler.device;
        this._defaultMaterial = modelHandler.defaultMaterial;
        this._assets = modelHandler.assets;
    }

    canParse(context) {
        return context.ext === 'glb';
    }

    load(url, callback, asset) {
        const loadUrl = typeof url === 'string' ? url : url.load;
        this.handler.fetch(url, Http.ResponseType.ARRAY_BUFFER, (err, data) => {
            if (err) {
                callback(err);
            } else {
                this.parse(data, callback, asset, loadUrl);
            }
        }, asset);
    }

    /**
     * @param {ArrayBuffer} data - The glb data.
     * @param {Function} callback - Invoked with the resulting model.
     * @param {Asset} [asset] - The asset being loaded.
     * @param {string} [loadUrl] - The URL the glb was loaded from. Buffers and images the glb
     * references by a relative uri resolve against its directory, so without this they would be
     * requested relative to the document instead.
     */
    parse(data, callback, asset, loadUrl = '') {
        GlbParser.parse('filename.glb', path.extractPath(loadUrl), data, this._device, this._assets, asset?.options ?? {}, [], (err, result) => {
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
