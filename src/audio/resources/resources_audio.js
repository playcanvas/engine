pc.extend(pc.resources, function () {
    var AudioResourceHandler = function (manager) {
        this.manager = manager;
    };
    AudioResourceHandler = pc.inherits(AudioResourceHandler, pc.resources.ResourceHandler);
        
    AudioResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
        var sound = this.manager.createSound(identifier, function (sound) {
            success(sound);
        }, error, progress);
    };
    
    AudioResourceHandler.prototype.open = function (data, options) {
        return data;
    };

    var AudioRequest = function (identifier) {
        
    };
    AudioRequest = pc.inherits(AudioRequest, pc.resources.ResourceRequest);
    AudioRequest.prototype.type = "audio";
    
    return {
        AudioResourceHandler: AudioResourceHandler,
        AudioRequest: AudioRequest
    };
}());
