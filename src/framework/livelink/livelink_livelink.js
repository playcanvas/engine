pc.extend(pc.fw, function () {
    // Private

    // Public Interface
    /**
     * @ignore
     * @name pc.fw.LiveLink
     * @class Create a link between the current window and a destination window which allows you to send messages between the two.
     * <p>Create a LiveLink object in the application you wish to send data from and a LiveLink object in the application you wish to receive data in. 
     * Then add the DOMWindow object of the receiving application to the LiveLink object of the sending application.</p>
     * @example
     * <code><pre>
     * // In application_a.js
     * var link;
     * function setup() {
     *   link = new pc.fw.LiveLink();
     * 
     *   // Create Application B in new window and add it as a destination
     *   var w = window.open("http://myapp.com");
     *   link.addDestinationWindow(w);
     * }
     * 
     * function send() {
     *   link.send(new MyMessage("some data"));
     * }
     * 
     * // In application_b.js (running on myapp.com)
     * var link = new pc.fw.LiveLink();
     * link.listen(function (msg) {
     *   console.log(msg.content.value)
     * });
     * </pre></code>
     * @constructor Create a new LiveLink object
     * @param {String} [senderIdPrefix] This string is used as a prefix to the unique senderId, to assist in debugging where messages came from
     */
    var LiveLink = function (senderIdPrefix) {
        senderIdPrefix = senderIdPrefix || '';
         
        this._destinations = [];
        this._callbacks = {};
        this._linkid = senderIdPrefix + '-' + pc.guid.create();
        this._listener = null;
        this._handler = this._handleMessage.bind(this);
        
        // Register message event handler
        window.addEventListener("message", this._handler, false);
        
        if (!pc.livelinks) {
            pc.livelinks = [];
        }
        
        pc.livelinks.push(this);
    };
    
    /**
     * @ignore
     * @function
     * @name pc.fw.LiveLink#detach
     * @description removed event handler from main window
     */
    LiveLink.prototype.detach = function () {
        this._listener = null;
        window.removeEventListener("message", this._handler, false);
    };
    
    /**
     * @ignore
     * @function
     * @name pc.fw.LiveLink#addDesinationWindow
     * @description Add a new destination window. Messages will be sent to all destinations
     * @param {DOMWindow} window
     */
    LiveLink.prototype.addDestinationWindow = function (_window) {
        this._destinations.push(_window);
    };
    
    /**
     * @ignore
     * @function
     * @name pc.fw.LiveLink#removeDestinationWindow
     * @description Remove an existing destination window.
     * @param {DOMWindow} window
     */
    LiveLink.prototype.removeDestinationWindow = function (window) {
        var i;
        for (i = 0; i < this._destinations.length; ++i) {
            if(this._destinations[i] == window) {
                this._destinations.splice(i, 1);
                break;
            }
        }
    };
    
    /**
     * @ignore
     * @function
     * @name pc.fw.LiveLink#send
     * @description Send a message to all registered destinations
     * Note, if the destination window is the same as the current window, the call will be synchronous (success() will be called before the function returns), otherwise it will be asynchronous
     * @param {pc.fw.LiveLinkMessage} msg The message to send
     */
    LiveLink.prototype.send = function (msg, success) {
        success = success || function () {};
        
        var i, length = this._destinations.length;
        var closed = []; // 
        for(i = 0; i < length; i++) {
            var w = this._destinations[i];
            if (!w.closed) {
                // TODO: We currently get one call back per window
                // rather than one per send() because calls to the current window are synchronouse and the send completes
                // before the next window send has started.
                var origin = w.location.protocol + "//" + w.location.host;
                this._send(msg, success, w, origin);                
            } else {
                closed.push(w);
            }        
        }

        length = closed.length;
        for(i = 0; i < length; i++) {
            this.removeDestinationWindow(closed[i]);
        }
    };
    
    LiveLink.prototype._send = function(msg, success, _window, origin) {
        msg.senderid = this._linkid;
        if(this._callbacks[msg.id]) {
            this._callbacks[msg.id].count++;
        } else {
            this._callbacks[msg.id] = {
                count: 1,
                callback: success ? success.bind(this) : function () {}
            };
        }
        var data = pc.fw.LiveLinkMessage.serialize(msg);
        
        // If we're sending a message to the current window, then just call the _handleMessage function directly to prevent the overhead
        // of postMessage() which can take several hundred ms in some cases. 
        // NOTE: This is not asynchronous like a call to postMessage()
        if (_window === window) {
            pc.livelinks.forEach(function (link) {
                link._handleMessage({
                    source: window,
                    data: data             
                });
            });
        } else {
            _window.postMessage(data, origin);    
        }
    };
    
    /**
     * @ignore
     * @function
     * @name pc.fw.LiveLink#listen
     * @description Start listening for messages
     * @param {Function} callback Function to handle incoming messages, will be passed a LiveLinkMessage object 
     * @param {DOMWindow} [_window] Override which window to listen on, defaults to current window
     */
    LiveLink.prototype.listen = function (callback, _window) {
        if(this._listener) {
            throw new Error("LiveLink already listening");
        }
        this._listener = callback;
    };
    
    LiveLink.prototype._handleMessage = function (event) {
        var msg, newmsg;
        var data = pc.fw.LiveLinkMessage.deserialize(event.data);
        
        if(!data) {
            return;
        }
        msg = new pc.fw.LiveLinkMessage(data, event.source);
        
        if(this._linkid === msg.senderid) {
            return; // Don't send messages to ourself
        }
        
        if(msg.type == pc.fw.LiveLinkMessageType.RECEIVED) {
            // If this is a receipt of a message that this LiveLink has sent
            if(msg.content.received_from == this._linkid) {
                // Call the callback and delete it
                this._callbacks[msg.content.id].count--;
                if (this._callbacks[msg.content.id].count === 0) {
                    this._callbacks[msg.content.id].callback();
                    delete this._callbacks[msg.content.id];                    
                }
            }
        } else if(this._listener) {
            // Fire off the listener callback
            this._listener(msg);
            
            // send a receipt so the sender knows we received the message
            newmsg = new pc.fw.LiveLinkMessage();
            newmsg.type = pc.fw.LiveLinkMessageType.RECEIVED;
            newmsg.content = {
                id: msg.id,
                received_from: msg.senderid
            };
            this._send(newmsg, null, event.source, event.origin);
        } else {
            // do nothing
        } 
    };
    
    return {
        LiveLink: LiveLink
    };
}());

