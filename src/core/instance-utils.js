const regex = new RegExp(/^\s*function\s*(\S*)\s*\(/);

const instance = {

    // helper function to get a class name of the object
    name: function (object) {

        // modern browsers have name property
        if (object.constructor.name) {
            return object.constructor.name;
        }

        // IE11 fallback
        return object.constructor.toString().match(regex)[1];
    },

    // helper function to find out if the specified object is an instance of the specified class name
    // example use: const isInstance = instance.of(app, "Application");
    of: function (object, className) {

        // make sure object is an object and not null of a number of similar
        if (typeof object === 'object' && object !== null) {

            let proto = Object.getPrototypeOf(object);
            for (;;) {
                if (proto === null) {
                    return false;
                }

                if (this.name(proto) === className) {
                    return true;
                }

                // trace up the chain
                proto = Object.getPrototypeOf(proto);
            }
        }

        return false;
    }
};

export { instance };
