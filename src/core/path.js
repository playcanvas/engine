/**
 * @namespace pc.path
 * @description File path API
 */
pc.path = function () {
    return {
        /**
         * The character that separates path segments
         * @name pc.path.delimiter
         */
        delimiter: "/",
        /**
         * @function
         * @name pc.path.join
         * @description Join two sections of file path together, insert a delimiter if needed.
         * @param {String} one First part of path to join.
         * @param {String} two Second part of path to join.
         * @returns {String} The joined file path.
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
         * @name pc.path.split
         * @description Split the pathname path into a pair [head, tail] where tail is the final part of the path
         * after the last delimiter and head is everything leading up to that. tail will never contain a slash
         * @param {String} path The path to split.
         * @returns {Array} The split path which is an array of two strings, the path and the filename.
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
         * @param {String} path The path to process.
         * @returns {String} The basename.
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
         * @param {String} path The path to get the directory from
         * @returns {String} The directory part of the path.
         */
        getDirectory: function (path) {
            var parts = path.split(pc.path.delimiter);
            return parts.slice(0, parts.length - 1).join(pc.path.delimiter);
        },

        getExtension: function (path) {
            var ext = path.split('?')[0].split('.').pop();
            if (ext !== path) {
                return "." + ext;
            }
            return "";
        },

        isRelativePath: function (s) {
            return s.charAt(0) !== "/" && s.match(/:\/\//) === null;
        },

        extractPath: function (s) {
            var path = ".",
                parts = s.split("/"),
                i = 0;

            if (parts.length > 1) {
                if (pc.path.isRelativePath(s) === false) {
                    path = "";
                }
                for (i = 0; i < parts.length - 1; ++i) {
                    path += "/" + parts[i];
                }
            }
            return path;
        }
    };
}();
