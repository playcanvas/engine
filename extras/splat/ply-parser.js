import { SplatContainerResource } from './splat-container-resource.js';
import { SplatData } from './splat-data.js';
import { readPly } from './ply-reader.js';

// filter out element data we're not going to use
const defaultElements = [
    'x', 'y', 'z',
    'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
    'rot_0', 'rot_1', 'rot_2', 'rot_3',
    'scale_0', 'scale_1', 'scale_2'
];

const defaultElementsSet = new Set(defaultElements);
const defaultElementFilter = val => defaultElementsSet.has(val);

class PlyParser {
    /** @type {import('playcanvas').GraphicsDevice} */
    device;

    /** @type {import('playcanvas').AssetRegistry} */
    assets;

    /** @type {number} */
    maxRetries;

    /**
     * @param {import('playcanvas').GraphicsDevice} device - The graphics device.
     * @param {import('playcanvas').AssetRegistry} assets - The asset registry.
     * @param {number} maxRetries - Maximum amount of retries.
     */
    constructor(device, assets, maxRetries) {
        this.device = device;
        this.assets = assets;
        this.maxRetries = maxRetries;
    }

    /**
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {import('playcanvas').ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {import('playcanvas').Asset} asset - Container asset.
     */
    async load(url, callback, asset) {
        const response = await fetch(url.load);
        readPly(response.body.getReader(), asset.data.elementFilter ?? defaultElementFilter)
            .then((response) => {
                callback(null, new SplatContainerResource(this.device, new SplatData(response)));
            })
            .catch((err) => {
                callback(err, null);
            });
    }

    /**
     * @param {string} url - The URL.
     * @param {SplatContainerResource} data - The data.
     * @returns {SplatContainerResource} Return the data.
     */
    open(url, data) {
        return data;
    }
}

/**
 * @param {import('playcanvas').AppBase} app - The application.
 */
const registerPlyParser = (app) => {
    const containerHandler = app.loader.getHandler('container');
    containerHandler.parsers.ply = new PlyParser(app.graphicsDevice, app.assets, containerHandler.maxRetries);
};

const getDefaultPlyElements = () => {
    return defaultElements.slice();
};

export { registerPlyParser, getDefaultPlyElements };
