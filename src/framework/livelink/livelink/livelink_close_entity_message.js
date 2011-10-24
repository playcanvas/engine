pc.extend(pc.designer, function () {
    /**
     * @name pc.designer.LiveLinkCloseEntityMessage
     * @constructor Create a new LiveLinkCloseEntityMessage from individual attributes
     * @class Signal that an Entity should be closed
     * @param {Object} id
     * @private
     */
    var LiveLinkCloseEntityMessage = function(id) {
        this.type = pc.designer.LiveLinkMessageType.CLOSE_ENTITY
        this.content = {
            id: id
        };
    };
    LiveLinkCloseEntityMessage = LiveLinkCloseEntityMessage.extendsFrom(pc.designer.LiveLinkMessage);
    pc.designer.LiveLinkMessage.register("CLOSE_ENTITY");
        
    return {
        LiveLinkCloseEntityMessage: LiveLinkCloseEntityMessage
    };
}());
