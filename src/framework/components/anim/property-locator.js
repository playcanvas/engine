Object.assign(pc, function () {
    var AnimPropertyLocator = function () {
    };
    Object.assign(AnimPropertyLocator.prototype, {
        encode: function(locator) {
            return pc.AnimBinder.joinPath([
                pc.AnimBinder.joinPath(locator[0]),
                locator[1],
                pc.AnimBinder.joinPath(locator[2])
            ], '/');
        },
        decode: function(locator) {
            var locatorSections = pc.AnimBinder.splitPath(locator, '/');
            return [
                pc.AnimBinder.splitPath(locatorSections[0]),
                locatorSections[1],
                pc.AnimBinder.splitPath(locatorSections[2])
            ];
        }
    });
    return {
        AnimPropertyLocator: AnimPropertyLocator
    }
}());