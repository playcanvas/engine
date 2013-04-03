pc.extend(pc.net, function () {
    var Socket = function (url) {
        this._ws = new WebSocket(url);

        this._ws.onopen = this._handleOpen.bind(this);
        this._ws.onerror = this._handleError.bind(this);
        this._ws.onmessage = this._handleMessage.bind(this);
        this._ws.onclose = this._handleClose.bind(this);
    };

    Socket.prototype = {
        onopen: null,
        onerror: null,
        onmessage: null,

        get binaryType () {
            return this._ws.binaryType;
        },

        set binaryType (type) {
            this._ws.binaryType = type;
        },

        get readyState () {
            return this._ws.readyState;
        },

        get bufferedAmount () {
            return this._ws.bufferedAmount;
        },

        get extensions () {
            return this._ws.extensions;
        },

        get protocol () {
            return this._ws.protocol;
        },

        _handleOpen: function () {
            if (this.onopen) {
                this.onopen();    
            }
        },

        _handleError: function (error) {
            if (this.onerror) {
                this.onerror(error);
            }
        },

        _handleMessage: function (msg) {
            if (this.onmessage) {
                this.onmessage(msg);
            }
        },

        _handleClose: function () {
            if (this.onclose) {
                this.onclose();
            }
        },

        send: function (msg) {
            this._ws.send(msg);
        }
    };

    return {
        Socket: Socket
    };
}());