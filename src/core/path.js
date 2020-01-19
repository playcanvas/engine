/**
 * @namespace pc.path
 * @description File path API.
 */
pc.path = function () {
    return {
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
         * @description Join two sections of file path together, insert a delimiter if needed.
         * @param {string} one - First part of path to join.
         * @param {string} two - Second part of path to join.
         * @returns {string} The joined file path.
         */
        join: function () {
            var index;
            var num = arguments.length;
            var result = arguments[0];

            for (index = 0; index < num - 1; ++index) {
                var one = arguments[index];
                var two = arguments[index + 1];
                if (!pc.isDefined(one) || !pc.isDefined(two)) {
                    throw new Error("undefined argument to pc.path.join");
                }
                if (two[0] === pc.path.delimiter) {
                    result = two;
                    continue;
                }

                if (one && two && one[one.length - 1] !== pc.path.delimiter && two[0] !== pc.path.delimiter) {
                    result += (pc.path.delimiter + two);
                } else {
                    result += (two);
                }
            }

            return result;
        },

        /**
         * @function
         * @name  pc.path.normalize
         * @description  Normalize the path by removing '.' and '..' instances.
         * @param  {string} path - The path to normalize.
         * @returns {string} The normalized path.
         */
        normalize: function (path) {
            var lead = path.startsWith(pc.path.delimiter);
            var trail = path.endsWith(pc.path.delimiter);

            var parts = path.split('/');

            var result = '';

            var cleaned = [];

            for (var i = 0; i < parts.length; i++) {
                if (parts[i] === '') continue;
                if (parts[i] === '.') continue;
                if (parts[i] === '..' && cleaned.length > 0) {
                    cleaned = cleaned.slice(0, cleaned.length - 2);
                    continue;
                }

                if (i > 0) cleaned.push(pc.path.delimiter);
                cleaned.push(parts[i]);
            }


            result = cleaned.join('');
            if (!lead && result[0] === pc.path.delimiter) {
                result = result.slice(1);
            }

            if (trail && result[result.length - 1] !== pc.path.delimiter) {
                result += pc.path.delimiter;
            }

            return result;
        },

        /**
         * @function
         * @name pc.path.split
         * @description Split the pathname path into a pair [head, tail] where tail is the final part of the path
         * after the last delimiter and head is everything leading up to that. tail will never contain a slash.
         * @param {string} path - The path to split.
         * @returns {string[]} The split path which is an array of two strings, the path and the filename.
         */
        split: function (path) {
            var parts = path.split(pc.path.delimiter);
            var tail = parts.slice(parts.length - 1)[0];
            var head = parts.slice(0, parts.length - 1).join(pc.path.delimiter);
            return [head, tail];
        },

        /**
         * @function
         * @name pc.path.getBasename
         * @description Return the basename of the path. That is the second element of the pair returned by
         * passing path into {@link pc.path.split}.
         * @param {string} path - The path to process.
         * @returns {string} The basename.
         * @example
         * pc.path.getBasename("/path/to/file.txt"); // returns "path.txt"
         * pc.path.getBasename("/path/to/dir"); // returns "dir"
         */
        getBasename: function (path) {
            return pc.path.split(path)[1];
        },

        /**
         * @function
         * @name pc.path.getDirectory
         * @description Get the directory name from the path. This is everything up to the final instance of pc.path.delimiter.
         * @param {string} path - The path to get the directory from.
         * @returns {string} The directory part of the path.
         */
        getDirectory: function (path) {
            var parts = path.split(pc.path.delimiter);
            return parts.slice(0, parts.length - 1).join(pc.path.delimiter);
        },
        /**
         * @function
         * @name pc.path.getExtension
         * @description Return the extension of the path. Pop the last value of a list after path is split by question mark and comma.
         * @param {string} path - The path to process.
         * @returns {string} The extension.
         * @example
         * pc.path.getExtension("/path/to/file.txt"); // returns ".txt"
         * pc.path.getExtension("/path/to/file.jpg"); // returns ".jpg"
         * pc.path.getExtension("/path/to/file.txt?function=getExtension"); // returns ".txt"
         */
        getExtension: function (path) {
            var ext = path.split('?')[0].split('.').pop();
            if (ext !== path) {
                return "." + ext;
            }
            return "";
        },

        /**
         * @function
         * @name pc.path.isRelativePath
         * @description Check if a string s is relative path.
         * @param {string} s - The path to process.
         * @returns {boolean} True if s doesn't start with slash and doesn't include colon and double slash.
         * @example
         * pc.path.isRelativePath("file.txt"); // returns true
         * pc.path.isRelativePath("path/to/file.txt"); // returns true
         * pc.path.isRelativePath("./path/to/file.txt"); // returns true
         * pc.path.isRelativePath("../path/to/file.jpg"); // returns true
         * pc.path.isRelativePath("/path/to/file.jpg"); // returns false
         * pc.path.isRelativePath("http://path/to/file.jpg"); // returns false
         */
        isRelativePath: function (s) {
            return s.charAt(0) !== "/" && s.match(/:\/\//) === null;
        },

        /**
         * @function
         * @name pc.path.extractPath
         * @description Return the path without file name. If path is relative path, start with period.
         * @param {string} s - The full path to process.
         * @returns {string} The path without a last element from list split by slash.
         * @example
         * pc.path.extractPath("path/to/file.txt"); // returns "./path/to"
         */
        extractPath: function (s) {
            var path = "";
            var parts = s.split("/");
            var i = 0;

            if (parts.length > 1) {
                if (pc.path.isRelativePath(s) === true) {
                    if (parts[0] === ".") {
                        for (i = 0; i < parts.length - 1; ++i) {
                            path += (i === 0) ? parts[i] : "/" + parts[i];

                        }
                    } else if (parts[0] === "..") {
                        for (i = 0; i < parts.length - 1; ++i) {
                            path += (i === 0) ? parts[i] : "/" + parts[i];
                        }
                    } else {
                        path = ".";
                        for (i = 0; i < parts.length - 1; ++i) {
                            path += "/" + parts[i];
                        }
                    }
                } else{
                    for (i = 0; i < parts.length - 1; ++i) {
                        path += (i === 0) ? parts[i] : "/" + parts[i];
                    }
                }
            }
            return path;
        }
    };
}();
