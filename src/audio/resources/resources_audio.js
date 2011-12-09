pc.extend(pc.resources, function () {
    
    var AudioResourceHandler = function (audioContext) {
        this.audioContext = audioContext;
    };
    AudioResourceHandler = AudioResourceHandler.extendsFrom(pc.resources.ResourceHandler);
        
    AudioResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
        var url = identifier;
        
        pc.net.http.get(url, function (response) {
            try {
                this.audioContext.decodeAudioData(response, function(buffer) {
                    var source = this.audioContext.createBufferSource(); // creates a sound source
                    source.buffer = buffer;                              // set the source buffer 
                    success(source);
                }.bind(this), function (error) {
                    console.log(error)
                }.bind(this));
            } catch (e) {
                error(pc.string.format("An error occured while loading audio file from: '{0}'", url));
            }
        }.bind(this), {cache:false});
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
