import { getDefaultMaterial } from '../../scene/materials/default-material.js';

import { GlbParser } from './glb-parser.js';

function GlbModelParser(device) {
    this._device = device;
    this._defaultMaterial = getDefaultMaterial();
}

Object.assign(GlbModelParser.prototype, {
    parse: function (data) {
        var glb = GlbParser.parse("filename.glb", data, this._device);
        if (!glb) {
            return null;
        }
        return GlbParser.createModel(glb, this._defaultMaterial);
    }
});

export { GlbModelParser };
