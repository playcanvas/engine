pc.extend(pc.designer, function () {
    /**
     * @name pc.designer.LiveLinkUpdateEntityMessage
     * @constructor Create a new LiveLinkUpdateEntityMessage
     * @class An Update Entity message signals a change in the number of components in an entity
     * @param {Object} id The id of the Entity that is changed
     * @param {Object} components The full components data structure
     * @private
     */
    var LiveLinkUpdateEntityMessage = function (id, components) {
        this.type = pc.designer.LiveLinkMessageType.UPDATE_ENTITY;
        this.content = {
            id: id,
            components: components
        };
    };
    LiveLinkUpdateEntityMessage = LiveLinkUpdateEntityMessage.extendsFrom(pc.designer.LiveLinkMessage);
    pc.designer.LiveLinkMessage.register("UPDATE_ENTITY");


    var LiveLinkUpdateEntityAttributeMessage = function (id, accessor, value) {
        this.type = pc.designer.LiveLinkMessageType.UPDATE_ENTITY_ATTRIBUTE;
        this.content = {
            id: id,
            accessor: accessor,
            value: value
        };
    };
    LiveLinkUpdateEntityAttributeMessage = LiveLinkUpdateEntityAttributeMessage.extendsFrom(pc.designer.LiveLinkMessage);
    pc.designer.LiveLinkMessage.register("UPDATE_ENTITY_ATTRIBUTE");
    
    return {
        LiveLinkUpdateEntityMessage: LiveLinkUpdateEntityMessage,
        LiveLinkUpdateEntityAttributeMessage: LiveLinkUpdateEntityAttributeMessage
    };
}());
