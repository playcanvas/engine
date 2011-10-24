pc.extend(pc.designer, function () {
    // Private
    
    
    // Public Interface
    /**
     * @ignore
     * @name pc.designer.LiveLink
     * @class Create a link between the current window and a destination window which allows you to send messages between the two.
     * <p>Create a LiveLink object in the application you wish to send data from and a LiveLink object in the application you wish to receive data in. 
     * Then add the DOMWindow object of the receiving application to the LiveLink object of the sending application.</p>
     * @example
     * <code><pre>
     * // In application_a.js
     * var link;
     * function setup() {
     *   link = new pc.designer.LiveLink();
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
     * var link = new pc.designer.LiveLink();
     * link.listen(function (msg) {
     *   console.log(msg.content.value)
     * });
     * </pre></code>
     * @constructor Create a new LiveLink object
     */
    var LiveLink = function () {
        this._destinations = [];
        this._callbacks = {};
        this._linkid = pc.guid.create();
        this._listener = null;
        this._handler = pc.callback(this, this._handleMessage);
        window.addEventListener("message", this._handler, false);
    }
    
    /**
     * @ignore
     * @function
     * @name pc.designer.LiveLink#detach
     * @description removed event handler from main window
     */
    LiveLink.prototype.detach = function () {
        this._listener = null;
        window.removeEventListener("message", this._handler, false);
    }
    
    /**
     * @ignore
     * @function
     * @name pc.designer.LiveLink#addDesinationWindow
     * @description Add a new destination window. Messages will be sent to all destinations
     * @param {DOMWindow} window
     */
    LiveLink.prototype.addDestinationWindow = function (_window) {
        this._destinations.push(_window);
    }
    
    /**
     * @ignore
     * @function
     * @name pc.designer.LiveLink#removeDestinationWindow
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
    }
    
    /**
     * @ignore
     * @function
     * @name pc.designer.LiveLink#send
     * @description Send a message to all registered destinations
     * @param {pc.fw.LiveLinkMessage} msg The message to send
     */
    LiveLink.prototype.send = function (msg, success) {
        success = success || function () {};

        this._destinations.forEach( function (w, index, arr) {
            var origin = w.location.protocol + "//" + w.location.host;
            this._send(msg, success, w, origin);
        }, this);
    }
    
    LiveLink.prototype._send = function(msg, success, _window, origin) {
        //msg.id = pc.guid.create();
        logINFO("Send: " + msg.type);
        msg.senderid = this._linkid;
        if(this._callbacks[msg.id]) {
            this._callbacks[msg.id].count++;
        } else {
            this._callbacks[msg.id] = {
                count:1,
                callback:pc.callback(this, success)
            }            
        }
        var data = pc.designer.LiveLinkMessage.serialize(msg);
        _window.postMessage(data, origin);
    };
    /**
     * @ignore
     * @function
     * @name pc.designer.LiveLink#listen
     * @description Start listening for messages
     * @param {Function} callback Function to handle incoming messages, will be passed a LiveLinkMessage object 
     * @param {DOMWindow} [_window] Override which window to listen on, defaults to current window
     */
    LiveLink.prototype.listen = function (callback, _window) {
        if(this._listener) {
            throw new Error("LiveLink already listening");
        }
        this._listener = callback;
    }
    
    LiveLink.prototype._handleMessage = function (event) {
        var msg, newmsg;
        var data = pc.designer.LiveLinkMessage.deserialize(event.data);
        
        if(!data) {
            return;
        }
        msg = new pc.designer.LiveLinkMessage(data, event.source);
        
        if(msg.type == pc.designer.LiveLinkMessageType.RECEIVED) {
            // If this is a receipt of a message that this LiveLink has sent
            if(msg.content.received_from == this._linkid) {
                // Call the callback and delete it
                this._callbacks[msg.content.id].count--;
                if(this._callbacks[msg.content.id].count == 0) {
                    this._callbacks[msg.content.id].callback();
                    delete this._callbacks[msg.content.id];                    
                }
            }
        } else if(this._listener) {
            // Fire off the listener callback
            this._listener(msg);
            
            // send a receipt so the sender knows we received the message
            newmsg = new pc.designer.LiveLinkMessage();
            newmsg.type = pc.designer.LiveLinkMessageType.RECEIVED;
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
    }
}());

