pc.extend(pc.audio, function () {
    var Sound;
    if (pc.audio.hasAudioContext()) {
        Sound = function (manager, url, success, error) {
            this.buffer = null;
            this.isLoaded = false;
            
            if (!pc.audio.isSupported(url, this.audio)) {
                setTimeout(function () {
                    error(pc.string.format('Audio format for {0} not supported', url));
                }, 0);
            } else {
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
            }

        };        
    } else if (pc.audio.hasAudio()){
        Sound = function (manager, url, success, error) {
            this.isLoaded = false;
            this.audio = new Audio();
            if (!pc.audio.isSupported(url, this.audio)) {
                setTimeout(function () {
                    error(pc.string.format('Audio format for {0} not supported', url));    
                }, 0);
                this.audio = null;
                return;
            }
            // Debug info about which events have fired
            this.audio.addEventListener('stalled', function () {
                logDEBUG('stalled: ' + this.audio.src);
            }.bind(this), false);
            this.audio.addEventListener('suspend', function () {
                logDEBUG('suspend: ' + this.audio.src);
            }.bind(this), false);
            this.audio.addEventListener('abort', function () {
                logDEBUG('abort: ' + this.audio.src);
            }.bind(this), false);
            this.audio.addEventListener('pause', function () {
                logDEBUG('pause: ' + this.audio.src);
            }.bind(this), false);
            this.audio.addEventListener('canplay', function () {
                logDEBUG('canplay: ' + this.audio.src);
            }.bind(this), false);
            this.audio.addEventListener('progress', function () {
                 logDEBUG('progress ' + url);
             }.bind(this));

            // In Webkit and Opera, sometimes not all loading events fire, it is unclear whether this is a bug in PlayCanvas or the browsers. 
            // Ideally we would only check for 'loadeddata' or 'canplaythrough', but sometimes this fails.
            // Adding 'loadstart' seems to fix this on Webkit and Safari, but obviously means we are saying the audio file has loaded before it has loaded enough to play
            // Let's hope this isn't a problem...
            this.audio.addEventListener('loadstart', function () {
                logDEBUG('loadstart: ' + this.audio.src);
                if (!this.isLoaded) {
                    this.isLoaded = true;
                    success(this);                    
                }
            }.bind(this), false);
            this.audio.addEventListener('canplaythrough', function () {
                logDEBUG('canplaythrough: ' + this.audio.src);
                if (!this.isLoaded) {
                    this.isLoaded = true;
                    success(this);                    
                }
            }.bind(this), false);
            this.audio.addEventListener('loadeddata', function () {
                logDEBUG('loadeddata: ' + url);
                if (!this.isLoaded) {
                    this.isLoaded = true;
                    success(this);
                }
            }.bind(this), false);
            this.audio.addEventListener('error', function (e) {
                logERROR('error loading: ' + url);
                error(pc.string.format("Error loading Sound from: '{0}'", url));
            }.bind(this), false);
            this.audio.src = url;
            logDEBUG('loading: ' + url);
        };
    }
    
    
    return {
        Sound: Sound
    };
    
}());
