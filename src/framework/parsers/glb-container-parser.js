import { path } from '../../core/path.js';
import { Asset } from '../../framework/asset/asset.js';
import { GlbParser } from './glb-parser.js';
import { GlbContainerResource } from './glb-container-resource.js';

class GlbContainerParser {
    _gltfExtensions = new Map();

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

    /**
     * Registers a glTF resource extension used by this parser.
     *
     * @param {object} extension - The extension implementation.
     * @ignore
     */
    registerGltfExtension(extension) {
        this._gltfExtensions.set(extension.name, extension);
    }

    /**
     * Unregisters a glTF resource extension used by this parser.
     *
     * @param {string} name - The glTF extension name.
     * @ignore
     */
    unregisterGltfExtension(name) {
        this._gltfExtensions.delete(name);
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
                    Array.from(this._gltfExtensions.values()),
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
