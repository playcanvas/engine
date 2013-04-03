pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.LiveLinkCloseEntityMessage
     * @constructor Create a new LiveLinkCloseEntityMessage from individual attributes
     * @class Signal that an Entity should be closed
     * @param {Object} id
     * @private
     */
    var LiveLinkCloseEntityMessage = function(id) {
        this.type = pc.fw.LiveLinkMessageType.CLOSE_ENTITY;
        this.content = {
            id: id
        };
    };
    LiveLinkCloseEntityMessage = pc.inherits(LiveLinkCloseEntityMessage, pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("CLOSE_ENTITY");
        
    return {
        LiveLinkCloseEntityMessage: LiveLinkCloseEntityMessage
    };
}());
