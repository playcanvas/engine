pc.extend(pc.script, function () {
    /**
     * @name pc.fw.ScriptLoader
     */
    var ScriptLoader = function (prefix) {
        this._prefix = prefix;
        this._queue = [];
        this._isLoading = false;
        this._loadedQueue = [];
        this._registered = {};
    };

        
    /**
     * @private
     * Create a &lt;script&gt; tag for the url and add it to the page, call the success callback if it loads, and attach the next script in the queue.
     * @param {Object} url The url of the javascript file to load
     * @param {Object} success Called if the script is loaded successfully, 
     */
    ScriptLoader.prototype._attach = function (url, context, success) {
        var self = this;
        var head = document.getElementsByTagName("head")[0];
        var element = document.createElement("script");
        
        var done = false;
        var fail = false;
        element.onload = element.onreadystatechange = function () {
            if(!done && (!this.readyState || (this.readyState == "loaded" || this.readyState == "complete"))) {
                var script = self._loadedQueue.shift();
                if (script) {
                    var ScriptType = script.callback(context);
                    self._registered[url] = {name: script.name, ScriptType: ScriptType};
                    success(script.name, ScriptType);
                }
                self._isLoading = false;
                // Load next one in the queue
                if (self._queue.length) {
                   var loadable = self._queue.shift();
                   self._attach(loadable.url, loadable.context, loadable.success);
                }                    
            }
        };
        // Moved to after the onload event is set as it is theoretically possible for the
        // browser to load the script instantly meaning the onload event could be lost.
        element.src = url;

        head.appendChild(element);
    };
        
    ScriptLoader.prototype.load = function (url, context, success, options) {
        options = options || {};
        
        var uri = new pc.URI(url);
        uri.path = pc.path.join(this._prefix, uri.path);
        url = uri.toString();
        
        if(this._registered[url]) {
            success(this._registered[url].name, this._registered[url].ScriptType);    
        } else {
            if (this._isLoading) {
                this._queue.push({
                    url: uri.toString(),
                    context: context,
                    success: success
                });
            } else {
                this._isLoading = true;
                this._attach(uri.toString(), context, success);
            }
        }
        
        if(options.timeout) {
            setTimeout(pc.callback(this, function () {
                if(this._isLoading) {
                    options.error();
                }
            }), options.timeout);
        }
    };
    
    ScriptLoader.prototype.add = function (name, callback) {
        this._loadedQueue.push({
                name: name,
                callback: callback
            });        
    }
        
    return {
        ScriptLoader: ScriptLoader
    };
}());    