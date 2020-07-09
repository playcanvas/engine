function Decompress(node, srcToDst) {
    this.node = node;

    this.srcToDst = srcToDst;
}

Object.assign(Decompress.prototype, {
    run: function () {
        if (this.isMapObj(this.node)) {
            this.handleMap();

        } else if (Array.isArray(this.node)) {
            this.handleArray();

        } else {
            this.handleLeaf();
        }

        return this.result;
    },

    handleMap: function () {
        this.result = {};

        var a = Object.keys(this.node);

        a.forEach(this.handleKey, this);
    },

    handleKey: function (origKey) {
        var newKey = this.handleTreeKey(origKey);

        this.result[newKey] = new Decompress(this.node[origKey], this.srcToDst).run();
    },

    handleArray: function () {
        this.result = [];

        this.node.forEach(this.handleArElt, this);
    },

    handleArElt: function (elt) {
        var v = new Decompress(elt, this.srcToDst).run();

        this.result.push(v);
    },

    handleLeaf: function () {
        this.result = this.node;
    },

    handleTreeKey: function (k) {
        return this.srcToDst[k] || k; // new guids -- no need - guids have len > 2
    },

    isMapObj: function (obj) {
        var isObj = typeof obj === "object";

        var isNull = obj === null;

        return isObj && !isNull && !Array.isArray(obj);
    }
});

export { Decompress };
