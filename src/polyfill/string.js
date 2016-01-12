// String.startsWith polyfill
if (! String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function(str) {
            var that = this;
            for(var i = 0, ceil = str.length; i < ceil; i++)
                if(that[i] !== str[i]) return false;
            return true;
        }
    });
}

// String.endsWith polyfill
if (! String.prototype.endsWith) {
    Object.defineProperty(String.prototype, 'endsWith', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function(str) {
            var that = this;
            for(var i = 0, ceil = str.length; i < ceil; i++)
                if (that[i + that.length - ceil] !== str[i])
                    return false;
            return true;
        }
    });
}
