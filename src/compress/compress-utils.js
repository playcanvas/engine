import { Decompress } from './decompress.js';

var CompressUtils = {
    KEY_MAP_FIELD: 'playcanvas_compressed',

    decompress: function (data) {
        var srcToDst = data[CompressUtils.KEY_MAP_FIELD];

        if (srcToDst) {
            delete data[CompressUtils.KEY_MAP_FIELD];

            return new Decompress(data, srcToDst).run();
        } else {
            return data;
        }
    }
};

export { CompressUtils };
