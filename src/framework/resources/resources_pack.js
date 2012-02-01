pc.extend(pc.resources, function () {
    /**
     * @name pc.resources.PackResourceHandler
     * @class Handle requests for Pack resources
     */
    var PackResourceHandler = function (registry, depot, context) {
        this.context = context;
    };
    PackResourceHandler = PackResourceHandler.extendsFrom(pc.resources.EntityResourceHandler);
    
    PackResourceHandler.prototype.postOpen = function (pack, success, error, progress, options) { 
        PackResourceHandler._super.postOpen.call(this, pack, function () {
            this.context.systems.script.registerInstances(pack);
            success(pack);
        }.bind(this), error, progress, options);
    };
    
    var PackRequest = function PackRequest(identifier) {
    }
    PackRequest = PackRequest.extendsFrom(pc.resources.EntityRequest);
    PackRequest.prototype.type = "pack";

    return {
        PackResourceHandler: PackResourceHandler,
        PackRequest: PackRequest
    }
}());    
