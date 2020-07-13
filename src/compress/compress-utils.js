import { Decompress } from './decompress.js';

var CompressUtils = {
    decompressEntities: function (data, compressed) {
        data.entities = new Decompress(data.entities, compressed.fieldMap).run();
    },

    setCompressedPRS: function (entity, data, compressed) {
        var a = compressed.locationData.singleVecs;

        var v = data.___1 || compressed.locationData.tripleVecs[data.___2];

        var n = v[0];

        entity.setLocalPosition(a[n], a[n+1], a[n+2]);

        n = v[1];

        entity.setLocalEulerAngles(a[n], a[n+1], a[n+2]);

        n = v[2];

        entity.setLocalScale(a[n], a[n+1], a[n+2]);
    }
};

export { CompressUtils };
