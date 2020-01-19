Object.assign(pc, function () {
    return {
        /**
         * @private
         * @function
         * @name pc.createURI
         * @description Create a URI object from constituent parts.
         * @param {object} options - Parts of the URI to build.
         * @param {string} [options.scheme] - The URI scheme (e.g. http).
         * @param {string} [options.authority] - The URI authority (e.g. `www.example.com`).
         * @param {string} [options.host] - Combination of scheme and authority (e.g. `http://www.example.com`).
         * @param {string} [options.path] - The URI path (e.g. /users/example).
         * @param {string} [options.hostpath] - Combination of scheme, authority and path (e.g. `http://www.example.com/users/example`).
         * @param {string} [options.query] - The query section, after the ?(e.g. `http://example.com?**key=value&another=123**`).
         * @param {string} [options.fragment] - The fragment section, after the # (e.g. `http://example.com#**fragment/data**`).
         * @returns {string} A URI string.
         */
        createURI: function (options) {
            var s = "";
            if ((options.authority || options.scheme) && (options.host || options.hostpath)) {
                throw new Error("Can't have 'scheme' or 'authority' and 'host' or 'hostpath' option");
            }
            if (options.host && options.hostpath) {
                throw new Error("Can't have 'host' and 'hostpath' option");
            }
            if (options.path && options.hostpath) {
                throw new Error("Can't have 'path' and 'hostpath' option");
            }

            if (options.scheme) {
                s += options.scheme + ":";
            }

            if (options.authority) {
                s += "//" + options.authority;
            }

            if (options.host) {
                s += options.host;
            }

            if (options.path) {
                s += options.path;
            }

            if (options.hostpath) {
                s += options.hostpath;
            }

            if (options.query) {
                s += "?" + options.query;
            }

            if (options.fragment) {
                s += "#" + options.fragment;
            }

            return s;
        },

        /**
         * @private
         * @class
         * @name pc.URI
         * @description Create a new URI object.
         * @classdesc A URI object.
         * @param {string} uri - URI string.
         */
        URI: function (uri) {
            // See http://tools.ietf.org/html/rfc2396#appendix-B for details of RegExp
            var re = /^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/,
                result = uri.match(re);

            /**
             * @private
             * @name pc.URI#scheme
             * @type {string}
             * @description The scheme. (e.g. Http).
             */
            this.scheme = result[2];

            /**
             * @private
             * @name pc.URI#authority
             * @type {string}
             * @description The authority. (e.g. Www.example.com).
             */
            this.authority = result[4];

            /**
             * @private
             * @name pc.URI#path
             * @type {string}
             * @description The path. (e.g. /users/example).
             */
            this.path = result[5];

            /**
             * @private
             * @name pc.URI#query
             * @type {string}
             * @description The query, the section after a ?. (e.g. Search=value).
             */
            this.query = result[7];

            /**
             * @private
             * @name pc.URI#fragment
             * @type {string}
             * @description The fragment, the section after a #.
             */
            this.fragment = result[9];

            /**
             * @private
             * @function
             * @name pc.URI#toString
             * @description Convert URI back to string.
             * @returns {string} The URI as a string.
             */
            this.toString = function () {
                var s = "";

                if (this.scheme) {
                    s += this.scheme + ":";
                }

                if (this.authority) {
                    s += "//" + this.authority;
                }

                s += this.path;

                if (this.query) {
                    s += "?" + this.query;
                }

                if (this.fragment) {
                    s += "#" + this.fragment;
                }

                return s;
            };

            /**
             * @private
             * @function
             * @name pc.URI#getQuery
             * @description Returns the query parameters as an Object.
             * @returns {object} The URI's query parameters converted to an Object.
             * @example
             * var s = "http://example.com?a=1&b=2&c=3";
             * var uri = new pc.URI(s);
             * var q = uri.getQuery();
             * console.log(q.a); // logs "1"
             * console.log(q.b); // logs "2"
             * console.log(q.c); // logs "3"
             */
            this.getQuery = function () {
                var vars;
                var pair;
                var result = {};

                if (this.query) {
                    vars = decodeURIComponent(this.query).split("&");
                    vars.forEach(function (item, index, arr) {
                        pair = item.split("=");
                        result[pair[0]] = pair[1];
                    }, this);
                }

                return result;
            };

            /**
             * @private
             * @function
             * @name pc.URI#setQuery
             * @description Set the query section of the URI from a Object.
             * @param {object} params - Key-Value pairs to encode into the query string.
             * @example
             * var s = "http://example.com";
             * var uri = new pc.URI(s);
             * uri.setQuery({
             *     "a": 1,
             *     "b": 2
             * });
             * console.log(uri.toString()); // logs "http://example.com?a=1&b=2
             */
            this.setQuery = function (params) {
                var q = "";
                for (var key in params) {
                    if (params.hasOwnProperty(key)) {
                        if (q !== "") {
                            q += "&";
                        }
                        q += encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
                    }
                }

                this.query = q;
            };
        }
    };
}());
