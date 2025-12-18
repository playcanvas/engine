// How to use:
// - Add this script to an entity
// - Configure the scrubbing rules via attributes
// - Call scrubData() method to clean/sanitize data objects
// - Listen to 'dataScrubbed' event to get the result
//
// Example:
// var scrubber = entity.script.wbDataScrumb;
// var cleanData = scrubber.scrubData(dirtyData);
var WbDataScrumb = pc.createScript('wbDataScrumb');

WbDataScrumb.attributes.add('removeNullValues', {
    title: 'Remove Null Values',
    description: 'If enabled, null and undefined values will be removed from objects',
    type: 'boolean',
    default: true
});

WbDataScrumb.attributes.add('removeEmptyStrings', {
    title: 'Remove Empty Strings',
    description: 'If enabled, empty strings will be removed from objects',
    type: 'boolean',
    default: false
});

WbDataScrumb.attributes.add('trimStrings', {
    title: 'Trim Strings',
    description: 'If enabled, string values will be trimmed of whitespace',
    type: 'boolean',
    default: true
});

WbDataScrumb.attributes.add('removeEmptyArrays', {
    title: 'Remove Empty Arrays',
    description: 'If enabled, empty arrays will be removed from objects',
    type: 'boolean',
    default: false
});

WbDataScrumb.attributes.add('sanitizeHtml', {
    title: 'Sanitize HTML',
    description: 'If enabled, HTML tags will be stripped from strings',
    type: 'boolean',
    default: false
});

WbDataScrumb.attributes.add('maxDepth', {
    title: 'Max Depth',
    description: 'Maximum depth to traverse nested objects (prevents infinite recursion)',
    type: 'number',
    default: 10,
    min: 1,
    max: 100
});

// initialize code called once per entity
WbDataScrumb.prototype.initialize = function () {
    this._htmlTagRegex = /<[^>]*>/g;
};

/**
 * Scrubs/sanitizes a data object according to configured rules
 * @param {*} data - The data to scrub (can be object, array, or primitive)
 * @param {number} depth - Current recursion depth (internal use)
 * @returns {*} The scrubbed data
 */
WbDataScrumb.prototype.scrubData = function (data, depth) {
    depth = depth || 0;

    // Prevent infinite recursion
    if (depth > this.maxDepth) {
        console.warn('WbDataScrumb: Maximum depth reached, returning data as-is');
        return data;
    }

    // Handle null/undefined
    if (data === null || data === undefined) {
        return this.removeNullValues ? undefined : data;
    }

    // Handle strings
    if (typeof data === 'string') {
        var result = data;

        // Trim whitespace
        if (this.trimStrings) {
            result = result.trim();
        }

        // Sanitize HTML
        if (this.sanitizeHtml) {
            result = result.replace(this._htmlTagRegex, '');
        }

        // Remove empty strings
        if (this.removeEmptyStrings && result === '') {
            return undefined;
        }

        return result;
    }

    // Handle arrays
    if (Array.isArray(data)) {
        var scrubbedArray = [];

        for (var i = 0; i < data.length; i++) {
            var scrubbedItem = this.scrubData(data[i], depth + 1);
            if (scrubbedItem !== undefined) {
                scrubbedArray.push(scrubbedItem);
            }
        }

        // Remove empty arrays if configured
        if (this.removeEmptyArrays && scrubbedArray.length === 0) {
            return undefined;
        }

        return scrubbedArray;
    }

    // Handle objects
    if (typeof data === 'object') {
        var scrubbedObject = {};

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var scrubbedValue = this.scrubData(data[key], depth + 1);

                // Only add the property if the value is not undefined
                if (scrubbedValue !== undefined) {
                    scrubbedObject[key] = scrubbedValue;
                }
            }
        }

        return scrubbedObject;
    }

    // Return primitives as-is (numbers, booleans, etc.)
    return data;
};

/**
 * Scrubs data and fires an event with the result
 * @param {*} data - The data to scrub
 * @param {string} eventName - Optional event name (defaults to 'dataScrubbed')
 * @returns {*} The scrubbed data
 */
WbDataScrumb.prototype.scrubAndNotify = function (data, eventName) {
    var scrubbed = this.scrubData(data);
    this.entity.fire(eventName || 'dataScrubbed', scrubbed);
    return scrubbed;
};

/**
 * Deeply clones a value, preserving common JS types and handling circular references.
 * This avoids the limitations of JSON.parse(JSON.stringify()).
 * @param {*} value - The value to clone
 * @param {WeakMap<object, *>} [seen] - Internal map for circular reference tracking
 * @returns {*} A deep clone of the input value
 */
function deepClone(value, seen) {
    // Primitives and functions are returned as-is
    if (value === null || typeof value !== 'object') {
        return value;
    }

    // Initialize seen map for circular reference handling
    if (!seen) {
        seen = new WeakMap();
    } else if (seen.has(value)) {
        return seen.get(value);
    }

    var cloned;

    // Handle Date
    if (value instanceof Date) {
        cloned = new Date(value.getTime());
        return cloned;
    }

    // Handle RegExp
    if (value instanceof RegExp) {
        cloned = new RegExp(value.source, value.flags);
        return cloned;
    }

    // Handle Array
    if (Array.isArray(value)) {
        cloned = [];
        seen.set(value, cloned);
        for (var i = 0; i < value.length; i++) {
            cloned[i] = deepClone(value[i], seen);
        }
        return cloned;
    }

    // Handle Map
    if (typeof Map !== 'undefined' && value instanceof Map) {
        cloned = new Map();
        seen.set(value, cloned);
        value.forEach(function (v, k) {
            cloned.set(deepClone(k, seen), deepClone(v, seen));
        });
        return cloned;
    }

    // Handle Set
    if (typeof Set !== 'undefined' && value instanceof Set) {
        cloned = new Set();
        seen.set(value, cloned);
        value.forEach(function (v) {
            cloned.add(deepClone(v, seen));
        });
        return cloned;
    }

    // Fallback: plain object
    cloned = {};
    seen.set(value, cloned);
    Object.keys(value).forEach(function (key) {
        cloned[key] = deepClone(value[key], seen);
    });
    return cloned;
}

/**
 * Creates a copy of the data before scrubbing (non-destructive)
 * @param {*} data - The data to scrub
 * @returns {*} A scrubbed copy of the data
 */
WbDataScrumb.prototype.scrubCopy = function (data) {
    // Deep clone the data first using a robust cloning helper
    var copy = deepClone(data);
    return this.scrubData(copy);
};

/**
 * Validates that data meets basic cleanliness requirements
 * (recursively checks nested objects and arrays).
 * @param {*} data - The data to validate
 * @returns {boolean} True if data passes validation
 */
WbDataScrumb.prototype._validateValue = function (value) {
    // Check for null/undefined if they should be removed
    if (this.removeNullValues && (value === null || value === undefined)) {
        return false;
    }

    // Check for empty strings if they should be removed
    if (this.removeEmptyStrings && value === '') {
        return false;
    }

    // Check for empty arrays if they should be removed
    if (this.removeEmptyArrays && Array.isArray(value) && value.length === 0) {
        return false;
    }

    // Recursively validate contents of arrays
    if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
            if (!this._validateValue(value[i])) {
                return false;
            }
        }
    } else if (value && typeof value === 'object') {
        // Recursively validate own enumerable properties of objects
        for (var key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                if (!this._validateValue(value[key])) {
                    return false;
                }
            }
        }
    }

    return true;
};

WbDataScrumb.prototype.validate = function (data) {
    return this._validateValue(data);
};
