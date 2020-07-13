function Decompress(node, srcToDst) {
    this._node = node;

    this._srcToDst = srcToDst;
}

Object.assign(Decompress.prototype, {
    run: function () {
        if (Array.isArray(this._node)) {
            this._handleArray();

        } else if (this._isMapNode()) {
            this._handleMap();

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
        var newKey = this._handleTreeKey(origKey);

        this._result[newKey] = new Decompress(this._node[origKey], this._srcToDst).run();
    },

    _handleArray: function () {
        this._result = [];

        this._node.forEach(this._handleArElt, this);
    },

    _handleArElt: function (elt) {
        var v = new Decompress(elt, this._srcToDst).run();

        this._result.push(v);
    },

    _handleTreeKey: function (k) {
        return (k.length <= 2 && this._srcToDst[k]) || k;
    },

    _isMapNode: function () { // after array check
        return typeof this._node === "object" &&
            this._node !== null;
    }
});

export { Decompress };
