pc.extend(pc.resources, function () {
    var AudioResourceHandler = function (manager) {
        this.manager = manager;
    };
    AudioResourceHandler = pc.inherits(AudioResourceHandler, pc.resources.ResourceHandler);
        
    AudioResourceHandler.prototype.load = function (request, options) {
        var self = this;

        var promise = new RSVP.Promise(function (resolve, reject) {
            var sound = self.manager.createSound(request.canonical, function (sound) {
                resolve(sound);
            }, function (error) {
                logERROR(error);
                // Resolve a success even if there is an error loading.
                // Audio resources might fail if they are in an unsupported format.
                // However, we'd still want to the game to load, we handle Sounds that didn't load in the component
                resolve(sound);
            });
        });
        
        return promise;
    };
    
    AudioResourceHandler.prototype.open = function (data, request, options) {
        return data;
    };

    var AudioRequest = function (identifier) {
        
    };
    AudioRequest = pc.inherits(AudioRequest, pc.resources.ResourceRequest);
    AudioRequest.prototype.type = "audio";
    AudioRequest.prototype.Type = pc.audio.Sound;

    return {
        AudioResourceHandler: AudioResourceHandler,
        AudioRequest: AudioRequest
    };
}());
