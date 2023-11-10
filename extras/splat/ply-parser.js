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
    device;

    assets;

    maxRetries;

    constructor(device, assets, maxRetries) {
        this.device = device;
        this.assets = assets;
        this.maxRetries = maxRetries;
    }

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

    open(url, data) {
        return data;
    }
}

const registerPlyParser = (app) => {
    const containerHandler = app.loader.getHandler('container');
    containerHandler.parsers.ply = new PlyParser(app.graphicsDevice, app.assets, app.loader.maxRetries);
};

const getDefaultPlyElements = () => {
    return defaultElements.slice();
};

export { registerPlyParser, getDefaultPlyElements };
