pc.extend(pc, function () {
    /**
     * @private
     * @name pc.LiveLinkUpdateAssetCacheMessage
     * @constructor Create a new LiveLInkUpdateAssetCacheMessage
     * @class
     * @param {Array} assets Dictionary of assets to be sent
     * @param {Array} deletedAssets Dictionary of assets to delete
     */
    var LiveLinkUpdateAssetCacheMessage = function(assets, deletedAssets) {
        this.type = pc.LiveLinkMessageType.UPDATE_ASSETCACHE;
        this.content = {
            assets: assets,
            deleted: deletedAssets
        };
    };
    LiveLinkUpdateAssetCacheMessage = pc.inherits(LiveLinkUpdateAssetCacheMessage, pc.LiveLinkMessage);
    pc.LiveLinkMessage.register("UPDATE_ASSETCACHE");

    return {
        LiveLinkUpdateAssetCacheMessage: LiveLinkUpdateAssetCacheMessage
    };
}());
