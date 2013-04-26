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
                reject(error);
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
    
    return {
        AudioResourceHandler: AudioResourceHandler,
        AudioRequest: AudioRequest
    };
}());
