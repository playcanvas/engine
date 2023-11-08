import { SplatContainerResource } from './splat-container-resource.js';
import { SplatData } from './splat-data.js';
import { readPly } from './ply-reader.js';

// filter out element data we're not going to use
const elements = [
    'x', 'y', 'z',
    'red', 'green', 'blue',
    'opacity',
    'f_dc_0', 'f_dc_1', 'f_dc_2',
    'scale_0', 'scale_1', 'scale_2',
    'rot_0', 'rot_1', 'rot_2', 'rot_3'
];

class PlyParser {
    device;

    assets;

    maxRetries;

    constructor(device, assets, maxRetries) {
        this.device = device;
        this.assets = assets;
        this.maxRetries = maxRetries;
    }

    async load(url, callback) {
        const response = await fetch(url.load);
        readPly(response.body.getReader(), new Set(elements))
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

export { registerPlyParser };
