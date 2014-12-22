pc.extend(pc, function () {
    /**
     * @name pc.LiveLinkUpdatePackSettings
     * @constructor Create a new LiveLinkUpdatePackSettings from individual attributes
     * @class Signal that an Entity should be loaded and opened
     * @param {Object} id
     * @param {Object} models List of all models, first should be parent, followed by all descendants
     * @private
     */
    var LiveLinkUpdatePackSettings = function(settings) {
        this.type = pc.LiveLinkMessageType.UPDATE_PACK_SETTINGS;
        this.content = {
            settings: settings
        };
    };

    LiveLinkUpdatePackSettings = pc.inherits(LiveLinkUpdatePackSettings, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_PACK_SETTINGS");
        
    return {
        LiveLinkUpdatePackSettings: LiveLinkUpdatePackSettings
    };
}());
