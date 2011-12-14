pc.extend(pc.resources, function () {
    
    var AudioResourceHandler = function (audioContext) {
        this.audioContext = audioContext;
    };
    AudioResourceHandler = AudioResourceHandler.extendsFrom(pc.resources.ResourceHandler);
        
    AudioResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
        var url = identifier;
        if(window.AudioContext || window.webkitAudioContext) {
            if(window.AudioContext && window.AudioContext.__type) {
                // shim
                pc.audio.loadAudio(url, this.audioContext, function (buffer) {
                    setTimeout(function () {
                        success(buffer);
                    }, 500);
                }, function (msg) {
                    error(msg);
                });
            } else {
                pc.net.http.get(url, function (response) {
                    try {
                        this.audioContext.decodeAudioData(response, function(buffer) {
                            success(buffer);
                        }.bind(this), function (error) {
                            console.log(error)
                        }.bind(this));
                    } catch (e) {
                        error(pc.string.format("An error occured while loading audio file from: '{0}'", url));
                    }
                }.bind(this), {cache:false});
            }
        }
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
