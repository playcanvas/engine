function Decompress(node, srcToDst) {
    this._node = node;

    this._srcToDst = srcToDst;
}

Object.assign(Decompress.prototype, {
    run: function () {
        if (this._isMapObj(this._node)) {
            this._handleMap();

        } else if (Array.isArray(this._node)) {
            this._handleArray();

        } else {
            this._handleLeaf();
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

    _handleLeaf: function () {
        this._result = this._node;
    },

    _handleTreeKey: function (k) {
        return this._srcToDst[k] || k; // new guids -- no need - guids have len > 2
    },

    _isMapObj: function (obj) {
        var isObj = typeof obj === "object";

        var isNull = obj === null;

        return isObj && !isNull && !Array.isArray(obj);
    }
});

export { Decompress };
