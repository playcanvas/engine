pc.extend(pc.fw, function () {
    var LiveLinkMessage = function (data, source) {
        data = data || {};
        this.type = data.type || pc.fw.LiveLinkMessageType.NO_TYPE;
        this.content = data.content || {};
        this.id = data.id || pc.guid.create();
        this.senderid = data.senderid || null;
        this.source = source || null;
    };
        
    LiveLinkMessage.register = function (type) {
        pc.fw.LiveLinkMessageType[type] = type;
    };
    
    LiveLinkMessage.serialize = function (msg) {
        var o = {
            type: msg.type,
            content: msg.content,
            id: msg.id,
            senderid: msg.senderid
        };
        
        return JSON.stringify(o, function (key,value) {
            if(this[key] instanceof Float32Array) {
                return pc.makeArray(this[key]);
            } else {
                return this[key];
            }
        });
    };
    
    LiveLinkMessage.deserialize = function (data) {
        try {
            var o = JSON.parse(data);
            return o;                    
        } catch (e) {
            return null;
        }
    };
    
    return {
        LiveLinkMessage: LiveLinkMessage,
        LiveLinkMessageRegister: {},
        LiveLinkMessageType: {
            NO_TYPE: "NO_TYPE",
            RECEIVED: "RECEIVED"
        }
    };
}());