pc.extend(pc.resources, function () {
    /**
     * @name pc.resources.ScriptResourceHandler
     * @class ResourceHandler for loading javascript files dynamically
     * Two types of javascript file can be loaded, PlayCanvas ScriptType files which must contain a call to pc.script.create() to be called when the script executes,
     * or regular javascript files, such as third-party libraries.
     * @param {pc.fw.ApplicationContext} context The context is passed into the ScriptType callbacks for use in user-scripts
     * @param {String} prefix Prefix for script urls, so that script resources can be located in a variety of places including localhost
     */
    var ScriptResourceHandler = function (context, prefix) {
        this._context = context;

        this._prefix = prefix || ""; // prefix for script urls, allows running from script resources on localhost
        this._queue = []; // queue of urls waiting to load
        this._pending = []; // queue of scripts which have been executed but are waiting to be instanciated
        this._loaded = {}; // Script objects that have loaded
        this._loading = null; // script element that has been created but is waiting for script to load

        pc.script.on("created", this._onScriptCreated, this);
    };
    ScriptResourceHandler = pc.inherits(ScriptResourceHandler, pc.resources.ResourceHandler);

    /**
     * @name pc.resources.ScriptResourceHandler#load
     * @description Load a new javascript resource
     * @param {ScriptResourceRequest} request The request for the script
     * @param {Object} [options] Optional parameters
     * @param {Number} [options.timeout] A timeout value in milliseconds before the error callback is fired if the script loading has failed, defaults to 10000
     */
    ScriptResourceHandler.prototype.load = function (request, options) {
        options = options || {};
        options.timeout = options.timeout || 60000; // default 10 second timeout
        options.cache = true; // For cache-busting off, so that script debugging works

        var promise = new pc.promise.Promise(function (resolve, reject) {
            var url = request.canonical;

            var processedUrl = url;
            if( !options.cache ) {
                processedUrl = this._appendTimestampToUrl(processedUrl);
            }

            var processedUrl = new pc.URI(processedUrl);
            processedUrl.path = pc.path.join(this._prefix, processedUrl.path);
            processedUrl = processedUrl.toString();

            if(this._loaded[url]) {
                if (this._loaded[url] !== true) {
                    resolve(this._loaded[url]);
                } else {
                    // regular js script
                    resolve(null);
                }
            } else {
                if (this._loading) {
                    this._queue.push({
                        url: processedUrl,
                        canonicalUrl: url,
                        success: resolve,
                        error: reject
                    });
                } else {
                    this._addScriptTag(processedUrl, url, resolve, reject);
                }
            }

            if(options.timeout) {
                (function () {
                    setTimeout(function () {
                        if (!this._loaded[url]) {
                            reject(pc.string.format("Loading script {0} timed out after {1}s", url, options.timeout / 1000));
                        }
                    }.bind(this), options.timeout);
                }).call(this);
            }
        }.bind(this));

        return promise;
    };

    ScriptResourceHandler.prototype.open = function (data, request, options) {
        return data;
    };

    /**
    * @private
    * Adds a timestamp to the specified URL to prevent it from being cached.
    * @url The url to append the timestamp to
    * @returns The new url
    */
    ScriptResourceHandler.prototype._appendTimestampToUrl = function( url ) {
        timestamp = Date.now();

        uri = new pc.URI(url);
        if (!uri.query) {
            uri.query = "ts=" + timestamp;
        }
        else {
            uri.query = uri.query + "&ts=" + timestamp;
        }
        url = uri.toString();
        return url;
    }

    /**
     * @private
     * @name pc.resources.ScriptResourceHandler#_onScriptCreated
     * @description Event handler received when the pc.script.create() function is called when a ScriptType is downloaded.
     * @param {String} name The name of the script created
     * @param {Function} callback The callback that will return the ScriptType
     */
    ScriptResourceHandler.prototype._onScriptCreated = function (name, callback) {
        this._pending.push({
            name: name,
            callback: callback
        });
    };

    /**
     * @private
     * @name pc.resources.ScriptResourceHandler#_addScriptTag
     * @description Add a new script tag to the document.head and set it's src to load a new script.
     * Handle success and errors and load the next in the queue
     */
    ScriptResourceHandler.prototype._addScriptTag = function (url, canonicalUrl, success, error) {
        var self = this;
        var head = document.getElementsByTagName("head")[0];
        var element = document.createElement("script");
        this._loading = element;

        element.addEventListener("error", function (e) {
            error(pc.string.format("Error loading script from '{0}'", e.target.src));
        });

        var done = false;
        element.onload = element.onreadystatechange = function () {
            if(!done && (!this.readyState || (this.readyState == "loaded" || this.readyState == "complete"))) {
                done = true; // prevent double event firing

                var pendingScripts = [];
                while(self._pending.length) {
                    pendingScripts.push(self._pending.pop());
                }

                if (pendingScripts.length) {
                    var scriptTypes = [];

                    for(var i = 0; i < pendingScripts.length; ++i) {
                        var script = pendingScripts[i];
                        var ScriptType = script.callback(self._context);
                        if (ScriptType._pcScriptName) {
                            throw Error("Attribute _pcScriptName is reserved on ScriptTypes for ResourceLoader use");
                        }
                        ScriptType._pcScriptName = script.name; // sotre name in script object
                        scriptTypes.push(ScriptType);
                    }

                    self._loaded[canonicalUrl] = scriptTypes;
                    // add the script to the resource loader's cache
                    self._loader.registerHash(canonicalUrl, canonicalUrl);
                    var resource = {url: url, scripts: scriptTypes};
                    self._loader.addToCache(canonicalUrl, resource);
                    success(resource);
                } else {
                    // loaded a regular javascript script, so no ScriptType to instantiate.
                    // However, we still need to register that we've loaded it in case there is a timeout
                    self._loaded[canonicalUrl] = true;
                    // add 'true' to the resource loader's cache
                    self._loader.registerHash(canonicalUrl, canonicalUrl);
                    self._loader.addToCache(canonicalUrl, true);
                    success(null);
                }
                self._loading = null;
                // Load next one in the queue
                if (self._queue.length) {
                   var loadable = self._queue.shift();
                   self._addScriptTag(loadable.url, loadable.canonicalUrl, loadable.success, loadable.error);
                }
            }
        };
        // set the src attribute after the onload callback is set, to avoid an instant loading failing to fire the callback
        element.src = url;

        head.appendChild(element);
    };

    var ScriptRequest = function ScriptRequest() {
    };
    ScriptRequest = pc.inherits(ScriptRequest, pc.resources.ResourceRequest);
    ScriptRequest.prototype.type = "script";

    return {
        ScriptResourceHandler: ScriptResourceHandler,
        ScriptRequest: ScriptRequest
    };
}());
