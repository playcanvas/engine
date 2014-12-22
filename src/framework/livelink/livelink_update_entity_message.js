pc.extend(pc, function () {
    /**
     * @name pc.LiveLinkUpdateEntityMessage
     * @constructor Create a new LiveLinkUpdateEntityMessage
     * @class An Update Entity message signals a change in the number of components in an entity
     * @param {Object} id The id of the Entity that is changed
     * @param {Object} components The full components data structure
     * @private
     */
    var LiveLinkUpdateEntityMessage = function (id, components) {
        this.type = pc.LiveLinkMessageType.UPDATE_ENTITY;
        this.content = {
            id: id,
            components: components
        };
    };
    LiveLinkUpdateEntityMessage = pc.inherits(LiveLinkUpdateEntityMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_ENTITY");


    var LiveLinkUpdateEntityTransformMessage = function (id, position, rotation, scale) {
        this.type = pc.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM;
        
        this.content = {
            id: id,
            position: position,
            rotation: rotation,
            scale: scale
        };
    };
    LiveLinkUpdateEntityTransformMessage = pc.inherits(LiveLinkUpdateEntityTransformMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_ENTITY_TRANSFORM");
    
    var LiveLinkUpdateEntityNameMessage = function (id, name) {
        this.type = pc.LiveLinkMessageType.UPDATE_ENTITY_NAME;
        this.content = {
            id: id,
            name: name
        };
    };
    LiveLinkUpdateEntityNameMessage = pc.inherits(LiveLinkUpdateEntityNameMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_ENTITY_NAME");

    var LiveLinkUpdateEntityEnabledMessage = function (id, enabled) {
        this.type = pc.LiveLinkMessageType.UPDATE_ENTITY_ENABLED;
        this.content = {
            id: id,
            enabled: enabled
        };
    };
    LiveLinkUpdateEntityEnabledMessage = pc.inherits(LiveLinkUpdateEntityEnabledMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_ENTITY_ENABLED");
    
    var LiveLinkReparentEntityMessage = function (id, oldParentId, newParentId, index) {
        this.type = pc.LiveLinkMessageType.REPARENT_ENTITY;
        
        this.content = {
            id: id,
            oldParentId: oldParentId,
            newParentId: newParentId,
            index: index
        };
    };
    LiveLinkReparentEntityMessage = pc.inherits(LiveLinkReparentEntityMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("REPARENT_ENTITY");
    
    return {
        LiveLinkUpdateEntityMessage: LiveLinkUpdateEntityMessage,
        LiveLinkUpdateEntityNameMessage: LiveLinkUpdateEntityNameMessage,
        LiveLinkUpdateEntityEnabledMessage: LiveLinkUpdateEntityEnabledMessage,
        LiveLinkUpdateEntityTransformMessage: LiveLinkUpdateEntityTransformMessage,
        LiveLinkReparentEntityMessage: LiveLinkReparentEntityMessage
    };
}());
