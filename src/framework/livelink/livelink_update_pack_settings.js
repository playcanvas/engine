pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.LiveLinkUpdatePackSettings
     * @constructor Create a new LiveLinkUpdatePackSettings from individual attributes
     * @class Signal that an Entity should be loaded and opened
     * @param {Object} id
     * @param {Object} models List of all models, first should be parent, followed by all descendants
     * @private
     */
    var LiveLinkUpdatePackSettings = function(settings) {
        this.type = pc.fw.LiveLinkMessageType.UPDATE_PACK_SETTINGS;
        this.content = {
            settings: settings
        };
    };

    LiveLinkUpdatePackSettings = pc.inherits(LiveLinkUpdatePackSettings, pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("UPDATE_PACK_SETTINGS");
        
    return {
        LiveLinkUpdatePackSettings: LiveLinkUpdatePackSettings
    };
}());
