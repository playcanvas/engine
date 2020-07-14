import { Decompress } from './decompress.js';

var CompressUtils = {
    decompressEntities: function (data, compressed) {
        if (compressed) {
            data.entities = new Decompress(data.entities, compressed).run();
        }
    },

    setCompressedPRS: function (entity, data, compressed) {
        var a = compressed.singleVecs;

        var b, i;

        var v = data.___1;

        if (!v) {
            b = compressed.tripleVecs;

            i = data.___2;
        }

        var n = v ? v[0] : b[i];

        entity.setLocalPosition(a[n], a[n+1], a[n+2]);

        n = v ? v[1] : b[i+1];

        entity.setLocalEulerAngles(a[n], a[n+1], a[n+2]);

        n = v ? v[2] : b[i+2];

        entity.setLocalScale(a[n], a[n+1], a[n+2]);
    },

    oneCharToKey: function (s, data) {
        var i = s.charCodeAt(0) - data.fieldFirstCode;

        return data.fieldArray[i];
    },

    multCharToKey: function (s, data) {
        var ind = 0;

        for (var i = 0; i < s.length; i++) {
            ind = ind * data.fieldCodeBase + s.charCodeAt(i) - data.fieldFirstCode;
        }

        return data.fieldArray[ind];
    }
};

export { CompressUtils };
