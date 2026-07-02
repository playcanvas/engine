import { path } from '../../core/path.js';
import { Asset } from '../../framework/asset/asset.js';
import { GlbParser } from './glb-parser.js';
import { GlbContainerResource } from './glb-container-resource.js';

class GlbContainerParser {
    constructor(device, assets) {
        this._device = device;
        this._assets = assets;
        this._defaultMaterial = GlbParser.createDefaultMaterial();
    }

    canParse() {
        // GLB is the only built-in container format (it handles both .glb and .gltf); it acts as the
        // catch-all, so any container asset resolves to it unless a more specific parser is registered
        return true;
    }

    _getUrlWithoutParams(url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    }

    load(url, callback, asset) {
        Asset.fetchArrayBuffer(url.load, (err, result) => {
            if (err) {
                callback(err);
            } else {
                GlbParser.parse(
                    this._getUrlWithoutParams(url.original),
                    path.extractPath(url.load),
                    result,
                    this._device,
                    asset.registry,
                    asset.options,
                    (err, result) => {
                        if (err) {
                            callback(err);
                        } else {
                            // return everything
                            callback(null, new GlbContainerResource(result, asset, this._assets, this._defaultMaterial));
                        }
                    });
            }
        }, asset, this.handler.maxRetries);
    }

    open(url, data, asset) {
        return data;
    }

    patch(asset, assets) {

    }
}

export {
    GlbContainerParser
};
