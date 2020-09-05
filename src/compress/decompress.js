import { CompressUtils } from './compress-utils';

/**
 * @private
 * @class
 * @name pc.Decompress
 * @classdesc Reconstruct original object field names in a
 *   compressed scene
 * @param {object} node - The current node of the object being
 *   decompressed, initially the 'entities' field of a scene
 * @param {object} data - Compression metadata
 */
function Decompress(node, data) {
    this._node = node;

    this._data = data;
}

Object.assign(Decompress.prototype, {
    run: function () {
        var type = Object.prototype.toString.call(this._node);

        if (type === '[object Object]') {
            this._handleMap();

        } else if (type === '[object Array]') {
            this._handleArray();

        } else {
            this._result = this._node;
        }

        return this._result;
    },

    _handleMap: function () {
        this._result = {};

        var a = Object.keys(this._node);

        a.forEach(this._handleKey, this);
    },

    _handleKey: function (origKey) {
        var newKey = origKey;

        var len = origKey.length;

        if (len === 1) {
            newKey = CompressUtils.oneCharToKey(origKey, this._data);
        } else if (len === 2) {
            newKey = CompressUtils.multCharToKey(origKey, this._data);
        }

        this._result[newKey] = new Decompress(this._node[origKey], this._data).run();
    },

    _handleArray: function () {
        this._result = [];

        this._node.forEach(this._handleArElt, this);
    },

    _handleArElt: function (elt) {
        var v = new Decompress(elt, this._data).run();

        this._result.push(v);
    }
});

export { Decompress };
