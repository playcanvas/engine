import { Decompress } from './decompress.js';

var CompressUtils = {
    decompressEntities: function (data, compressed) {
        data.entities = new Decompress(data.entities, compressed.fieldMap).run();
    },

    setCompressedPRS: function (entity, data, compressed) {
        var a = compressed.locationData.singleVecs;

        var b, i;

        var v = data.___1;

        if (!v) {
            b = compressed.locationData.tripleVecs;

            i = data.___2;
        }

        var n = v ? v[0] : b[i];

        entity.setLocalPosition(a[n], a[n+1], a[n+2]);

        n = v ? v[1] : b[i+1];

        entity.setLocalEulerAngles(a[n], a[n+1], a[n+2]);

        n = v ? v[2] : b[i+2];

        entity.setLocalScale(a[n], a[n+1], a[n+2]);
    }
};

export { CompressUtils };
