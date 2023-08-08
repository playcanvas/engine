/**
 * Create a URI object from constituent parts.
 *
 * @param {object} options - Parts of the URI to build.
 * @param {string} [options.scheme] - The URI scheme (e.g. http).
 * @param {string} [options.authority] - The URI authority (e.g. `www.example.com`).
 * @param {string} [options.host] - Combination of scheme and authority (e.g. `http://www.example.com`).
 * @param {string} [options.path] - The URI path (e.g. /users/example).
 * @param {string} [options.hostpath] - Combination of scheme, authority and path (e.g. `http://www.example.com/users/example`).
 * @param {string} [options.query] - The query section, after the ?(e.g. `http://example.com?**key=value&another=123**`).
 * @param {string} [options.fragment] - The fragment section, after the # (e.g. `http://example.com#**fragment/data**`).
 * @returns {string} A URI string.
 * @ignore
 */
function createURI(options) {
    let s = '';
    if ((options.authority || options.scheme) && (options.host || options.hostpath)) {
        throw new Error('Can\'t have \'scheme\' or \'authority\' and \'host\' or \'hostpath\' option');
    }
    if (options.host && options.hostpath) {
        throw new Error('Can\'t have \'host\' and \'hostpath\' option');
    }
    if (options.path && options.hostpath) {
        throw new Error('Can\'t have \'path\' and \'hostpath\' option');
    }

    if (options.scheme) {
        s += options.scheme + ':';
    }

    if (options.authority) {
        s += '//' + options.authority;
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
        s += '?' + options.query;
    }

    if (options.fragment) {
        s += '#' + options.fragment;
    }

    return s;
}

// See http://tools.ietf.org/html/rfc2396#appendix-B for details of RegExp
const re = /^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

/**
 * A URI object.
 *
 * @ignore
 */
class URI {
    /**
     * The scheme. (e.g. http).
     *
     * @type {string}
     */
    scheme;

    /**
     * The authority. (e.g. `www.example.com`).
     *
     * @type {string}
     */
    authority;

    /**
     * The path. (e.g. /users/example).
     *
     * @type {string}
     */
    path;

    /**
     * The query, the section after a ?. (e.g. search=value).
     *
     * @type {string}
     */
    query;

    /**
     * The fragment, the section after a #.
     *
     * @type {string}
     */
    fragment;

    /**
     * Create a new URI instance.
     *
     * @param {string} uri - URI string.
     */
    constructor(uri) {
        const result = uri.match(re);
        this.scheme = result[2];
        this.authority = result[4];
        this.path = result[5];
        this.query = result[7];
        this.fragment = result[9];
    }

    /**
     * Convert URI back to string.
     *
     * @returns {string} The URI as a string.
     */
    toString() {
        let s = '';

        if (this.scheme) {
            s += this.scheme + ':';
        }

        if (this.authority) {
            s += '//' + this.authority;
        }

        s += this.path;

        if (this.query) {
            s += '?' + this.query;
        }

        if (this.fragment) {
            s += '#' + this.fragment;
        }

        return s;
    }

    /**
     * Returns the query parameters as an Object.
     *
     * @returns {object} The URI's query parameters converted to an Object.
     * @example
     * const s = "http://example.com?a=1&b=2&c=3";
     * const uri = new pc.URI(s);
     * const q = uri.getQuery();
     * console.log(q.a); // logs "1"
     * console.log(q.b); // logs "2"
     * console.log(q.c); // logs "3"
     */
    getQuery() {
        const result = {};

        if (this.query) {
            const queryParams = decodeURIComponent(this.query).split('&');
            for (const queryParam of queryParams) {
                const pair = queryParam.split('=');
                result[pair[0]] = pair[1];
            }
        }

        return result;
    }

    /**
     * Set the query section of the URI from a Object.
     *
     * @param {object} params - Key-Value pairs to encode into the query string.
     * @example
     * const s = "http://example.com";
     * const uri = new pc.URI(s);
     * uri.setQuery({
     *     "a": 1,
     *     "b": 2
     * });
     * console.log(uri.toString()); // logs "http://example.com?a=1&b=2
     */
    setQuery(params) {
        let q = '';
        for (const key in params) {
            if (params.hasOwnProperty(key)) {
                if (q !== '') {
                    q += '&';
                }
                q += encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            }
        }

        this.query = q;
    }
}

export { createURI, URI };
