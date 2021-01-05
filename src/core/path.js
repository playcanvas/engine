import { isDefined } from './core.js';

/**
 * @namespace pc.path
 * @description File path API.
 */
var path = {
    /**
     * @constant
     * @type {string}
     * @name pc.path.delimiter
     * @description The character that separates path segments.
     */
    delimiter: "/",

    /**
     * @function
     * @name pc.path.join
     * @description Join two or more sections of file path together, inserting a
     * delimiter if needed.
     * @param {...string} section - Section of path to join. 2 or more can be
     * provided as parameters.
     * @returns {string} The joined file path.
     * @example
     * var path = pc.path.join('foo', 'bar');
     * console.log(path); // Prints 'foo/bar'
     * @example
     * var path = pc.path.join('alpha', 'beta', 'gamma');
     * console.log(path); // Prints 'alpha/beta/gamma'
     */
    join: function () {
        var index;
        var num = arguments.length;
        var result = arguments[0];

        for (index = 0; index < num - 1; ++index) {
            var one = arguments[index];
            var two = arguments[index + 1];
            if (!isDefined(one) || !isDefined(two)) {
                throw new Error("undefined argument to pc.path.join");
            }
            if (two[0] === path.delimiter) {
                result = two;
                continue;
            }

            if (one && two && one[one.length - 1] !== path.delimiter && two[0] !== path.delimiter) {
                result += (path.delimiter + two);
            } else {
                result += (two);
            }
        }

        return result;
    },

    /**
     * @function
     * @name pc.path.normalize
     * @description Normalize the path by removing '.' and '..' instances.
     * @param {string} pathname - The path to normalize.
     * @returns {string} The normalized path.
     */
    normalize: function (pathname) {
        var lead = pathname.startsWith(path.delimiter);
        var trail = pathname.endsWith(path.delimiter);

        var parts = pathname.split('/');

        var result = '';

        var cleaned = [];

        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === '') continue;
            if (parts[i] === '.') continue;
            if (parts[i] === '..' && cleaned.length > 0) {
                cleaned = cleaned.slice(0, cleaned.length - 2);
                continue;
            }

            if (i > 0) cleaned.push(path.delimiter);
            cleaned.push(parts[i]);
        }


        result = cleaned.join('');
        if (!lead && result[0] === path.delimiter) {
            result = result.slice(1);
        }

        if (trail && result[result.length - 1] !== path.delimiter) {
            result += path.delimiter;
        }

        return result;
    },

    /**
     * @function
     * @name pc.path.split
     * @description Split the pathname path into a pair [head, tail] where tail is the final part of the path
     * after the last delimiter and head is everything leading up to that. tail will never contain a slash.
     * @param {string} pathname - The path to split.
     * @returns {string[]} The split path which is an array of two strings, the path and the filename.
     */
    split: function (pathname) {
        var parts = pathname.split(path.delimiter);
        var tail = parts.slice(parts.length - 1)[0];
        var head = parts.slice(0, parts.length - 1).join(path.delimiter);
        return [head, tail];
    },

    /**
     * @function
     * @name pc.path.getBasename
     * @description Return the basename of the path. That is the second element of the pair returned by
     * passing path into {@link pc.path.split}.
     * @param {string} pathname - The path to process.
     * @returns {string} The basename.
     * @example
     * pc.path.getBasename("/path/to/file.txt"); // returns "path.txt"
     * pc.path.getBasename("/path/to/dir"); // returns "dir"
     */
    getBasename: function (pathname) {
        return path.split(pathname)[1];
    },

    /**
     * @function
     * @name pc.path.getDirectory
     * @description Get the directory name from the path. This is everything up to the final instance of pc.path.delimiter.
     * @param {string} pathname - The path to get the directory from.
     * @returns {string} The directory part of the path.
     */
    getDirectory: function (pathname) {
        var parts = pathname.split(path.delimiter);
        return parts.slice(0, parts.length - 1).join(path.delimiter);
    },
    /**
     * @function
     * @name pc.path.getExtension
     * @description Return the extension of the path. Pop the last value of a list after path is split by question mark and comma.
     * @param {string} pathname - The path to process.
     * @returns {string} The extension.
     * @example
     * pc.path.getExtension("/path/to/file.txt"); // returns ".txt"
     * pc.path.getExtension("/path/to/file.jpg"); // returns ".jpg"
     * pc.path.getExtension("/path/to/file.txt?function=getExtension"); // returns ".txt"
     */
    getExtension: function (pathname) {
        var ext = pathname.split('?')[0].split('.').pop();
        if (ext !== pathname) {
            return "." + ext;
        }
        return "";
    },

    /**
     * @function
     * @name pc.path.isRelativePath
     * @description Check if a string s is relative path.
     * @param {string} pathname - The path to process.
     * @returns {boolean} True if s doesn't start with slash and doesn't include colon and double slash.
     * @example
     * pc.path.isRelativePath("file.txt"); // returns true
     * pc.path.isRelativePath("path/to/file.txt"); // returns true
     * pc.path.isRelativePath("./path/to/file.txt"); // returns true
     * pc.path.isRelativePath("../path/to/file.jpg"); // returns true
     * pc.path.isRelativePath("/path/to/file.jpg"); // returns false
     * pc.path.isRelativePath("http://path/to/file.jpg"); // returns false
     */
    isRelativePath: function (pathname) {
        return pathname.charAt(0) !== "/" && pathname.match(/:\/\//) === null;
    },

    /**
     * @function
     * @name pc.path.extractPath
     * @description Return the path without file name. If path is relative path, start with period.
     * @param {string} pathname - The full path to process.
     * @returns {string} The path without a last element from list split by slash.
     * @example
     * pc.path.extractPath("path/to/file.txt");    // returns "./path/to"
     * pc.path.extractPath("./path/to/file.txt");  // returns "./path/to"
     * pc.path.extractPath("../path/to/file.txt"); // returns "../path/to"
     * pc.path.extractPath("/path/to/file.txt");   // returns "/path/to"
     */
    extractPath: function (pathname) {
        var result = "";
        var parts = pathname.split("/");
        var i = 0;

        if (parts.length > 1) {
            if (path.isRelativePath(pathname)) {
                if (parts[0] === ".") {
                    for (i = 0; i < parts.length - 1; ++i) {
                        result += (i === 0) ? parts[i] : "/" + parts[i];

                    }
                } else if (parts[0] === "..") {
                    for (i = 0; i < parts.length - 1; ++i) {
                        result += (i === 0) ? parts[i] : "/" + parts[i];
                    }
                } else {
                    result = ".";
                    for (i = 0; i < parts.length - 1; ++i) {
                        result += "/" + parts[i];
                    }
                }
            } else {
                for (i = 0; i < parts.length - 1; ++i) {
                    result += (i === 0) ? parts[i] : "/" + parts[i];
                }
            }
        }
        return result;
    }
};

export { path };
