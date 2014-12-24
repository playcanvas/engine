pc.extend(pc, function () {
    var LiveLinkUpdateAssetMessage = function (id, attribute, value) {
        this.type = pc.LiveLinkMessageType.UPDATE_ASSET;
        
        this.content = {
            id: id,
            attribute: attribute,
            value: value
        };
    };
    LiveLinkUpdateAssetMessage = pc.inherits(LiveLinkUpdateAssetMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_ASSET");

    return {
        LiveLinkUpdateAssetMessage: LiveLinkUpdateAssetMessage
    };
}());