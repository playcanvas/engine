pc.extend(pc, function () {
    /**
     * @name pc.LiveLinkUpdateComponentMessage
     * @constructor Create a new LiveLinkUpdateComponentMessage from individual attributes
     * @class The update component message signals a change in an individual component value.
     * @param {Object} id
     * @param {Object} component
     * @param {Object} attribute
     * @param {Object} value
     * @private
     */
    var LiveLinkUpdateComponentMessage = function(id, component, attribute, value) {
        this.type = pc.LiveLinkMessageType.UPDATE_COMPONENT;
        this.content = {
            id: id,
            component: component,
            attribute: attribute,
            value: value
        };
    };
    LiveLinkUpdateComponentMessage = pc.inherits(LiveLinkUpdateComponentMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_COMPONENT");
        
    return {
        LiveLinkUpdateComponentMessage: LiveLinkUpdateComponentMessage
    };
}());
