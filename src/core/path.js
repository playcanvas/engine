import { Debug } from './debug.js';

/**
 * File path API.
 *
 * @namespace
 */
const path = {
    /**
     * The character that separates path segments.
     *
     * @type {string}
     */
    delimiter: '/',

    /**
     * Join two or more sections of file path together, inserting a delimiter if needed.
     *
     * @param {...string} section - Section of path to join. 2 or more can be provided as parameters.
     * @returns {string} The joined file path.
     * @example
     * const path = pc.path.join('foo', 'bar');
     * console.log(path); // Prints 'foo/bar'
     * @example
     * const path = pc.path.join('alpha', 'beta', 'gamma');
     * console.log(path); // Prints 'alpha/beta/gamma'
     */
    join: function () {
        const num = arguments.length;
        let result = arguments[0];

        for (let index = 0; index < num - 1; ++index) {
            const one = arguments[index];
            Debug.assert(one !== undefined);

            const two = arguments[index + 1];
            Debug.assert(two !== undefined);

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
     * Normalize the path by removing '.' and '..' instances.
     *
     * @param {string} pathname - The path to normalize.
     * @returns {string} The normalized path.
     */
    normalize: function (pathname) {
        const lead = pathname.startsWith(path.delimiter);
        const trail = pathname.endsWith(path.delimiter);

        const parts = pathname.split('/');

        let result = '';

        let cleaned = [];

        for (let i = 0; i < parts.length; i++) {
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
     * Split the pathname path into a pair [head, tail] where tail is the final part of the path
     * after the last delimiter and head is everything leading up to that. tail will never contain
     * a slash.
     *
     * @param {string} pathname - The path to split.
     * @returns {string[]} The split path which is an array of two strings, the path and the
     * filename.
     */
    split: function (pathname) {
        const lastDelimiterIndex = pathname.lastIndexOf(path.delimiter);
        if (lastDelimiterIndex !== -1) {
            return [pathname.substring(0, lastDelimiterIndex), pathname.substring(lastDelimiterIndex + 1)];
        }
        return ["", pathname];
    },

    /**
     * Return the basename of the path. That is the second element of the pair returned by passing
     * path into {@link path.split}.
     *
     * @param {string} pathname - The path to process.
     * @returns {string} The basename.
     * @example
     * pc.path.getBasename("/path/to/file.txt"); // returns "file.txt"
     * pc.path.getBasename("/path/to/dir"); // returns "dir"
     */
    getBasename: function (pathname) {
        return path.split(pathname)[1];
    },

    /**
     * Get the directory name from the path. This is everything up to the final instance of
     * {@link path.delimiter}.
     *
     * @param {string} pathname - The path to get the directory from.
     * @returns {string} The directory part of the path.
     */
    getDirectory: function (pathname) {
        return path.split(pathname)[0];
    },

    /**
     * Return the extension of the path. Pop the last value of a list after path is split by
     * question mark and comma.
     *
     * @param {string} pathname - The path to process.
     * @returns {string} The extension.
     * @example
     * pc.path.getExtension("/path/to/file.txt"); // returns ".txt"
     * pc.path.getExtension("/path/to/file.jpg"); // returns ".jpg"
     * pc.path.getExtension("/path/to/file.txt?function=getExtension"); // returns ".txt"
     */
    getExtension: function (pathname) {
        const ext = pathname.split('?')[0].split('.').pop();
        if (ext !== pathname) {
            return '.' + ext;
        }
        return '';
    },

    /**
     * Check if a string s is relative path.
     *
     * @param {string} pathname - The path to process.
     * @returns {boolean} True if s doesn't start with slash and doesn't include colon and double
     * slash.
     *
     * @example
     * pc.path.isRelativePath("file.txt"); // returns true
     * pc.path.isRelativePath("path/to/file.txt"); // returns true
     * pc.path.isRelativePath("./path/to/file.txt"); // returns true
     * pc.path.isRelativePath("../path/to/file.jpg"); // returns true
     * pc.path.isRelativePath("/path/to/file.jpg"); // returns false
     * pc.path.isRelativePath("http://path/to/file.jpg"); // returns false
     */
    isRelativePath: function (pathname) {
        return pathname.charAt(0) !== '/' && pathname.match(/:\/\//) === null;
    },

    /**
     * Return the path without file name. If path is relative path, start with period.
     *
     * @param {string} pathname - The full path to process.
     * @returns {string} The path without a last element from list split by slash.
     * @example
     * pc.path.extractPath("path/to/file.txt");    // returns "./path/to"
     * pc.path.extractPath("./path/to/file.txt");  // returns "./path/to"
     * pc.path.extractPath("../path/to/file.txt"); // returns "../path/to"
     * pc.path.extractPath("/path/to/file.txt");   // returns "/path/to"
     */
    extractPath: function (pathname) {
        let result = '';
        const parts = pathname.split('/');
        let i = 0;

        if (parts.length > 1) {
            if (path.isRelativePath(pathname)) {
                if (parts[0] === '.') {
                    for (i = 0; i < parts.length - 1; ++i) {
                        result += (i === 0) ? parts[i] : '/' + parts[i];

                    }
                } else if (parts[0] === '..') {
                    for (i = 0; i < parts.length - 1; ++i) {
                        result += (i === 0) ? parts[i] : '/' + parts[i];
                    }
                } else {
                    result = '.';
                    for (i = 0; i < parts.length - 1; ++i) {
                        result += '/' + parts[i];
                    }
                }
            } else {
                for (i = 0; i < parts.length - 1; ++i) {
                    result += (i === 0) ? parts[i] : '/' + parts[i];
                }
            }
        }
        return result;
    }
};

export { path };
