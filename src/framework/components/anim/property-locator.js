Object.assign(pc, function () {
    var AnimPropertyLocator = function () {
    };
    Object.assign(AnimPropertyLocator.prototype, {
        // split a path string into its segments and resolve character escaping
        _splitPath: function(path) {
            var result = [];
            var curr = "";
            var i = 0;
            while (i < path.length) {
                var c = path[i++];

                if (c === '\\' && i < path.length) {
                    c = path[i++];
                    if (c === '\\' || c === '.') {
                        curr += c;
                    } else {
                        curr += '\\' + c;
                    }
                } else if (c === '.') {
                    result.push(curr);
                    curr = '';
                } else {
                    curr += c;
                }
            }
            if (curr.length > 0) {
                result.push(curr);
            }
            return result;
        },
        // join a list of path segments into a path string
        _joinPath: function (pathSegments) {
            var escape = function (string) {
                return string.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
            };
            return pathSegments.map(escape).join('.');
        },
        encode: function(decodedLocator) {
            var entityHierarchy = decodedLocator[0];
            var component = decodedLocator[1];
            var propertyHierarchy = decodedLocator[2];
            return pc.string.format(
                '{0}/{1}/{2}',
                this._joinPath(entityHierarchy),
                component,
                this._joinPath(propertyHierarchy)
            );
        },
        decode: function(encodedLocator) {
            var locatorSections = encodedLocator.split('/');
            var entityHierarchy = this._splitPath(locatorSections[0]);
            for (var i = 0; i < entityHierarchy.length; i++) {
                entityHierarchy[i] = entityHierarchy[i].split('\\.').join('.');
            }
            var component = locatorSections[1];
            var propertyHierarchy = locatorSections[2].split('.');

            return [entityHierarchy, component, propertyHierarchy];
        }
    });
    return {
        AnimPropertyLocator: AnimPropertyLocator
    }
}());