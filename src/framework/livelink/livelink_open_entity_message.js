pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.LiveLinkOpenEntityMessage
     * @constructor Create a new LiveLinkOpenEntityMessage from individual attributes
     * @class Signal that an Entity should be loaded and opened
     * @param {Object} id
     * @param {Object} models List of all models, first should be parent, followed by all descendants
     * @private
     */
    var LiveLinkOpenEntityMessage = function(entity) {
        this.type = pc.fw.LiveLinkMessageType.OPEN_ENTITY;
        this.content = {
            entity: entity
        };
    };
 
    LiveLinkOpenEntityMessage = pc.inherits(LiveLinkOpenEntityMessage, pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("OPEN_ENTITY");
       


    /**
     * @name pc.fw.LiveLinkOpenPackMessage
     * @constructor Create a new LiveLinkOpenEntityMessage from individual attributes
     * @class Signal that an Entity should be loaded and opened
     * @param {Object} id
     * @param {Object} hierarchy - Entity hierarchy
     * @param {Object} pack - Pack Data
     * @private
     */
    var LiveLinkOpenPackMessage = function(hierarchy, pack) {
        this.type = pc.fw.LiveLinkMessageType.OPEN_PACK;
        this.content = {
            pack: pc.extend({}, pack.getData())
        };
        this.content.pack.hierarchy = PCD.model.Entity.toData(hierarchy);
    };
 
    LiveLinkOpenPackMessage = pc.inherits(LiveLinkOpenPackMessage, pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("OPEN_PACK");

    return {
        LiveLinkOpenEntityMessage: LiveLinkOpenEntityMessage,
        LiveLinkOpenPackMessage: LiveLinkOpenPackMessage
    };
}());
