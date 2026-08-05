import { getDefaultMaterial } from '../../scene/materials/default-material.js';
import { GlbModelParser } from '../parsers/glb-model.js';
import { JsonModelParser } from '../parsers/json-model.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Resource handler used for loading {@link Model} resources.
 *
 * @category Graphics
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
        this.addParser(new JsonModelParser(this));
        this.addParser(new GlbModelParser(this));
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
