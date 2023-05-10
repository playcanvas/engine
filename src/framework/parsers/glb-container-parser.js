import { path } from '../../core/path.js';
import { Asset } from '../../framework/asset/asset.js';
import { GlbParser } from "./glb-parser.js";
import { GlbContainerResource } from './glb-container-resource.js';

class GlbContainerParser {
    constructor(device, assets, maxRetries) {
        this._device = device;
        this._assets = assets;
        this._defaultMaterial = GlbParser.createDefaultMaterial();
        this.maxRetries = maxRetries;
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
        }, asset, this.maxRetries);
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
