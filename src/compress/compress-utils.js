var CompressUtils = {
    /**
     * @private
     * @function
     * @name CompressUtils#setCompressedPRS
     * @description Set position, rotation and scale of an entity
     *   using compressed scene format
     * @param {Entity} entity - The entity
     * @param {object} data - Json entity data from a compressed scene
     * @param {object} compressed - Compression metadata
     */
    setCompressedPRS: function (entity, data, compressed) {
        var a = compressed.singleVecs;

        var b, i;

        var v = data.___1;

        if (!v) {
            b = compressed.tripleVecs;

            i = data.___2;
        }

        var n = v ? v[0] : b[i];

        entity.setLocalPosition(a[n], a[n + 1], a[n + 2]);

        n = v ? v[1] : b[i + 1];

        entity.setLocalEulerAngles(a[n], a[n + 1], a[n + 2]);

        n = v ? v[2] : b[i + 2];

        entity.setLocalScale(a[n], a[n + 1], a[n + 2]);
    },

    /**
     * @private
     * @function
     * @name CompressUtils#oneCharToKey
     * @description Retrieve the original field name (key) for a
     *   single character key from a compressed entity
     * @param {string} s - The compressed key string
     * @param {object} data - Compression metadata
     * @returns {string} The original key
     */
    oneCharToKey: function (s, data) {
        var i = s.charCodeAt(0) - data.fieldFirstCode;

        return data.fieldArray[i];
    },

    /**
     * @private
     * @function
     * @name CompressUtils#multCharToKey
     * @description Retrieve the original field name (key) for a
     *   multi-character key from a compressed entity
     * @param {string} s - The compressed key string
     * @param {object} data - Compression metadata
     * @returns {string} The original key
     */
    multCharToKey: function (s, data) {
        var ind = 0;

        for (var i = 0; i < s.length; i++) {
            ind = ind * data.fieldCodeBase + s.charCodeAt(i) - data.fieldFirstCode;
        }

        return data.fieldArray[ind];
    }
};

export { CompressUtils };
