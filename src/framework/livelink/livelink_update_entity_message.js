pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.LiveLinkUpdateEntityMessage
     * @constructor Create a new LiveLinkUpdateEntityMessage
     * @class An Update Entity message signals a change in the number of components in an entity
     * @param {Object} id The id of the Entity that is changed
     * @param {Object} components The full components data structure
     * @private
     */
    var LiveLinkUpdateEntityMessage = function (id, components) {
        this.type = pc.fw.LiveLinkMessageType.UPDATE_ENTITY;
        this.content = {
            id: id,
            components: components
        };
    };
    LiveLinkUpdateEntityMessage = LiveLinkUpdateEntityMessage.extendsFrom(pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("UPDATE_ENTITY");


    var LiveLinkUpdateEntityTransformMessage = function (id, translate, rotate, scale) {
        this.type = pc.fw.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM;
        
        this.content = {
            id: id,
            translate: translate,
            rotate: rotate,
            scale: scale
        }
    };
    LiveLinkUpdateEntityTransformMessage = LiveLinkUpdateEntityTransformMessage.extendsFrom(pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("UPDATE_ENTITY_TRANSFORM");
    
    var LiveLinkUpdateEntityNameMessage = function (id, name) {
        this.type = pc.fw.LiveLinkMessageType.UPDATE_ENTITY_NAME;
        this.content = {
            id: id,
            name: name
        };
    };
    LiveLinkUpdateEntityNameMessage = LiveLinkUpdateEntityNameMessage.extendsFrom(pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("UPDATE_ENTITY_NAME");
    
    var LiveLinkReparentEntityMessage = function (id, oldParentId, newParentId, index) {
        this.type = pc.fw.LiveLinkMessageType.REPARENT_ENTITY;
        
        this.content = {
            id: id,
            oldParentId: oldParentId,
            newParentId: newParentId,
            index: index
        };
    };
    LiveLinkReparentEntityMessage = LiveLinkReparentEntityMessage.extendsFrom(pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("REPARENT_ENTITY");
    
    return {
        LiveLinkUpdateEntityMessage: LiveLinkUpdateEntityMessage,
        LiveLinkUpdateEntityNameMessage: LiveLinkUpdateEntityNameMessage,
        LiveLinkUpdateEntityTransformMessage: LiveLinkUpdateEntityTransformMessage,
        LiveLinkReparentEntityMessage: LiveLinkReparentEntityMessage
    };
}());
