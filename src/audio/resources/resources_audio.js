pc.extend(pc.resources, function () {
    var AudioResourceHandler = function (manager) {
        this.manager = manager;
    };
    AudioResourceHandler = AudioResourceHandler.extendsFrom(pc.resources.ResourceHandler);
        
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
    AudioRequest = AudioRequest.extendsFrom(pc.resources.ResourceRequest);
    AudioRequest.prototype.type = "audio";
    
    return {
        AudioResourceHandler: AudioResourceHandler,
        AudioRequest: AudioRequest
    };
}());
