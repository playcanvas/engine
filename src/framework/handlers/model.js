import { Debug } from '../../core/debug.js';
import { getDefaultMaterial } from '../../scene/materials/default-material.js';
import { GlbModelParser } from '../parsers/glb-model.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { Asset } from '../asset/asset.js'
 * @import { AppBase } from '../app-base.js'
 * @import { ResourceHandlerCallback } from './handler.js'
 */

/**
 * Resource handler for the `model` asset type. Loads GLB files into a {@link Model}. OBJ files are
 * supported once the `ObjModelParser` shipped in `playcanvas/scripts/esm/parsers/obj-model.mjs` is
 * registered with {@link ResourceHandler#addParser}.
 *
 * @category Asset
 */
class ModelHandler extends ResourceHandler {
    /**
     * Create a new ModelHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'model');

        this.device = app.graphicsDevice;
        this.assets = app.assets;
        this.defaultMaterial = getDefaultMaterial(this.device);

        // parsers self-fetch (via this.handler.fetch) and produce a Model; the base handler selects one
        this.addParser(new GlbModelParser(this));
    }

    /**
     * Loads a model using the registered parser that claims it.
     *
     * @param {string | {load: string, original: string}} url - The URL of the resource to load.
     * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
     * an error occurs.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     */
    load(url, callback, asset) {
        // a parser registered by the user (for example one for .json) still takes precedence
        Debug.call(() => {
            const context = this._makeContext(url, asset);
            if (context.ext === 'json' && !this._selectParser(context)) {
                Debug.removed(`ModelHandler: the legacy PlayCanvas JSON model format was removed, and ${context.url} cannot be loaded. ` +
                    'Convert your models to GLB instead. In the Editor, enable Project Settings > Asset Import > Convert to GLB ' +
                    'and reimport the model assets.');
            }
        });

        super.load(url, callback, asset);
    }

    patch(asset, assets) {
        if (!asset.resource) {
            return;
        }

        const data = asset.data;

        const self = this;
        asset.resource.meshInstances.forEach((meshInstance, i) => {
            if (data.mapping) {
                const handleMaterial = function (asset) {
                    if (asset.resource) {
                        meshInstance.material = asset.resource;
                    } else {
                        asset.once('load', handleMaterial);
                        assets.load(asset);
                    }

                    asset.once('remove', (asset) => {
                        if (meshInstance.material === asset.resource) {
                            meshInstance.material = self.defaultMaterial;
                        }
                    });
                };

                if (!data.mapping[i]) {
                    meshInstance.material = self.defaultMaterial;
                    return;
                }

                const id = data.mapping[i].material;
                const url = data.mapping[i].path;
                let material;

                if (id !== undefined) { // id mapping
                    if (!id) {
                        meshInstance.material = self.defaultMaterial;
                    } else {
                        material = assets.get(id);
                        if (material) {
                            handleMaterial(material);
                        } else {
                            assets.once(`add:${id}`, handleMaterial);
                        }
                    }
                } else if (url) {
                    // url mapping
                    const path = asset.getAbsoluteUrl(data.mapping[i].path);
                    material = assets.getByUrl(path);

                    if (material) {
                        handleMaterial(material);
                    } else {
                        assets.once(`add:url:${path}`, handleMaterial);
                    }
                }
            }
        });
    }
}

export { ModelHandler };
