pc.extend(pc, function () {
    /**
     * @name pc.LiveLinkCloseEntityMessage
     * @constructor Create a new LiveLinkCloseEntityMessage from individual attributes
     * @class Signal that an Entity should be closed
     * @param {Object} id
     * @private
     */
    var LiveLinkCloseEntityMessage = function(id) {
        this.type = pc.LiveLinkMessageType.CLOSE_ENTITY;
        this.content = {
            id: id
        };
    };
    LiveLinkCloseEntityMessage = pc.inherits(LiveLinkCloseEntityMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("CLOSE_ENTITY");
        
    return {
        LiveLinkCloseEntityMessage: LiveLinkCloseEntityMessage
    };
}());
