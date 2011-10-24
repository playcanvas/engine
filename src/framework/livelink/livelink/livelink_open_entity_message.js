pc.extend(pc.designer, function () {
    /**
     * @name pc.designer.LiveLinkOpenEntityMessage
     * @constructor Create a new LiveLinkOpenEntityMessage from individual attributes
     * @class Signal that an Entity should be loaded and opened
     * @param {Object} id
     * @param {Object} models List of all models, first should be parent, followed by all descendants
     * @private
     */
    var LiveLinkOpenEntityMessage = function(models) {
        this.type = pc.designer.LiveLinkMessageType.OPEN_ENTITY
        this.content = {
            models: models
        };
    };
    LiveLinkOpenEntityMessage = LiveLinkOpenEntityMessage.extendsFrom(pc.designer.LiveLinkMessage);
    pc.designer.LiveLinkMessage.register("OPEN_ENTITY");
        
    return {
        LiveLinkOpenEntityMessage: LiveLinkOpenEntityMessage
    };
}());
