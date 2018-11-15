Object.assign(pc, function () {
    var SyncQueue = function () {
        this._index = [];
        this._values = [];
    };

    SyncQueue.prototype.runSync = function () {
        for (var i = 0, len = this._values.length; i < len; i++) {
            this._values[i].syncHierarchy();
        }
        this._values.length = 0;
        this._index.length = 0;
    };

    SyncQueue.prototype.erase = function (n) {
        var idx = this._values.indexOf(n);
        if (idx >= 0) {
            this._index.splice(idx, 1);
            this._values.splice(idx, 1);
        }
    };

    var bs = function (index, s, e, k) {
        if (s === e) return s;
        var m = Math.floor((s + e) / 2);
        if (index[m] > k)
            return bs(index, s, m, k);
        else if (index[m] < k)
            return bs(index, m + 1, e, k);
        return m;
    };

    SyncQueue.prototype.push = function (p, v) {
        var i = bs(this._index, 0, this._index.length, p);
        this._values.splice(i, 0, v);
        this._index.splice(i, 0, p);
    };

    return {
        SyncQueue: SyncQueue
    };
}());
