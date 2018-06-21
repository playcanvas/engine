Object.assign(pc, function() {
    var IndexedList = function() {
        this._list = [];
        this._index = {};
    };

    IndexedList.prototype.push = function(key, item) {
        if (this._index[key]) {
            throw Error("Key already in index " + key);
        }
        var location = this._list.push(item) - 1;
        this._index[key] = location;
    };

    IndexedList.prototype.has = function(key) {
        return this._index[key] !== undefined;
    };

    IndexedList.prototype.get = function(key) {
        var location = this._index[key];
        if (location !== undefined) {
            return this._list[location];
        } else {
            return null;
        }
    };

    IndexedList.prototype.remove = function(key) {
        var location = this._index[key];
        if (location !== undefined) {
            this._list.splice(location, 1);
            delete this._index[key];
            return true;
      }

      return false;
    };

    IndexedList.prototype.list = function() {
        return this._list;
    };

    IndexedList.prototype.clear = function() {
        this._list.length = 0;

        for (var prop in this._index) {
            delete this._index[prop];
        }
    };

    return {
        IndexedList: IndexedList
    };
}());
