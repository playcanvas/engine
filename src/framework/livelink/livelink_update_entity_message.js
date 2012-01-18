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

    var LiveLinkUpdateEntityTransformComponentMessage = function (id, name, value, undoable, previous) {
        this.type = pc.fw.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM_COMPONENT;
        undoable = pc.isDefined(undoable) ? undoable : false;
        previous = pc.isDefined(previous) ? previous : null;
        
        this.content = {
            id: id,
            name: name,
            value: value,
            previous: previous,
            undoable: undoable
        }
    };
    LiveLinkUpdateEntityTransformComponentMessage = LiveLinkUpdateEntityTransformComponentMessage.extendsFrom(pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("UPDATE_ENTITY_TRANSFORM_COMPONENT");

    var LiveLinkUpdateEntityAttributeMessage = function (id, accessor, value) {
        this.type = pc.fw.LiveLinkMessageType.UPDATE_ENTITY_ATTRIBUTE;
        this.content = {
            id: id,
            accessor: accessor,
            value: value
        };
    };
    LiveLinkUpdateEntityAttributeMessage = LiveLinkUpdateEntityAttributeMessage.extendsFrom(pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("UPDATE_ENTITY_ATTRIBUTE");
    
    return {
        LiveLinkUpdateEntityMessage: LiveLinkUpdateEntityMessage,
        LiveLinkUpdateEntityTransformMessage: LiveLinkUpdateEntityTransformMessage,
        LiveLinkUpdateEntityTransformComponentMessage: LiveLinkUpdateEntityTransformComponentMessage,
        LiveLinkUpdateEntityAttributeMessage: LiveLinkUpdateEntityAttributeMessage
    };
}());
