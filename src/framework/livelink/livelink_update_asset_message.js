pc.extend(pc.fw, function () {
    var LiveLinkUpdateAssetMessage = function (id, attribute, value) {
        this.type = pc.fw.LiveLinkMessageType.UPDATE_ASSET;
        
        this.content = {
            id: id,
            attribute: attribute,
            value: value
        };
    };
    LiveLinkUpdateAssetMessage = pc.inherits(LiveLinkUpdateAssetMessage, pc.fw.LiveLinkMessage);
    pc.fw.LiveLinkMessage.register("UPDATE_ASSET");

    return {
        LiveLinkUpdateAssetMessage: LiveLinkUpdateAssetMessage
    };
}());