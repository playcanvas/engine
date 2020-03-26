Object.assign(pc, function () {
    var PropertyLocator = function () {
    };
    Object.assign(PropertyLocator.prototype, {
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
        encode: function(decodedLocator) {
            var entityHeirarchy = decodedLocator[0];
            for (var i = 0; i < entityHeirarchy.length; i++) {
                entityHeirarchy[i] = entityHeirarchy[i].split('.').join('\\.');
            }
            var component = decodedLocator[1];
            var propertyHeirarchy = decodedLocator[2];
            return pc.string.format(
                '{0}/{1}/{2}',
                entityHeirarchy.join('.'),
                component,
                propertyHeirarchy.join('.')
            );
        },
        decode: function(encodedLocator) {
            var locatorSections = encodedLocator.split('/');
            var entityHeirarchy = this._splitPath(locatorSections[0]);
            for (var i = 0; i < entityHeirarchy.length; i++) {
                entityHeirarchy[i] = entityHeirarchy[i].split('\\.').join('.');
            }
            var component = locatorSections[1];
            var propertyHeirarchy = locatorSections[2].split('.');

            return [entityHeirarchy, component, propertyHeirarchy];
        }
    });
    return {
        PropertyLocator: PropertyLocator
    }
}());