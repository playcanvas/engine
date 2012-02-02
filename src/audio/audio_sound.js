pc.extend(pc.audio, function () {
    var Sound;
    if (pc.audio.hasAudioContext()) {
        Sound = function (manager, url, success, error) {
            this.buffer = null;
            this.isLoaded = false;
            
            if (manager.context) {
                pc.net.http.get(url, function (response) {
                    manager.context.decodeAudioData(response, function(buffer) {
                        this.buffer = buffer;
                        this.isLoaded = true;
                        success(this);
                    }.bind(this), error);
                }.bind(this), {
                    error: error
                });
            } 
        };        
    } else if (pc.audio.hasAudio()){
        Sound = function (manager, url, success, error) {
            this.isLoaded = false;
            this.audio = new Audio();
            this.audio.addEventListener('loadeddata', function () {
                this.isLoaded = true;
                success(this);
            }.bind(this), false);
            this.audio.src = url;
        };
    }
    
    
    return {
        Sound: Sound
    };
    
}());
