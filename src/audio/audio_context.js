pc.extend(pc.audio, function () {
    function _webkitLoadAudio(url, context, success, error) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        
        // Decode asynchronously
        request.onload = function() {
          context.decodeAudioData(request.response, function(buffer) {
            var source = context.createBufferSource(); // creates a sound source
            source.buffer = buffer;                    // tell the source which sound to play
            source.connect(context.destination);       // connect the source to the context's destination (the speakers)
            success(source);
          });
        }
        request.send();
    }

    if (window.AudioContext) {
        return {
            loadAudio: _webkitLoadAudio,
            AudioContext: window.AudioContext
        };        
    }
    if(window.webkitAudioContext) {
        return {
            loadAudio: _webkitLoadAudio,
            AudioContext: window.webkitAudioContext
        };
    } else {
        
        var AudioContext = function () {
            this.destination= new AudioDestinationNode(this);            
        };
        
        AudioContext.prototype.createBufferSource = function () {
            return new AudioBufferSourceNode(this);
        };
        
        AudioContext.prototype.createGainNode = function () {
            return new AudioGainNode(this);
        };
        
        AudioContext.prototype.decodeAudioData = function (data, success, error) {
            
        };
        
        var AudioNode = function (context, audio) {
            if (audio) {
                this._audio = audio;
            } else {
                this._audio = new Audio();
            }
            
            this._audio.addEventListener('loadedmetadata', function () {
            }.bind(this), false);
            
            this._audio.addEventListener('MozAudioAvailable', function (event) {
                this.outputs.forEach(function (output) {
                    this._writeAudio(output._audio, event.frameBuffer);
                }, this);
            }.bind(this), false);
            
            this.context = context;
            this.inputs = [];
            this.outputs = [];
            this._buffers = [];
        };
        
        AudioNode.prototype._writeAudio = function (audio, data) {  
          this._buffers.push(data);  
          // If there's buffered data, write that  
          while(this._buffers.length > 0) {  
                var buffer = this._buffers.shift();  
                var written = audio.mozWriteAudio(buffer);  
                // If all data wasn't written, keep it in the buffers:  
                if(written < buffer.length) {  
                    this._buffers.unshift(buffer.slice(written));  
                    return;  
                }  
            }  
        };
        
        AudioNode.prototype.connect = function (node) {
            // setup output node to match input node
            // node._audio.mozSetup(this._audio.mozChannels, this._audio.mozSampleRate);  
            
            // Add to lists
            node.inputs.push(this);
            this.outputs.push(node);
        }
        
        var AudioBufferSourceNode = function (context) {
            //this.gain = null;
            //this.loop = false;
            //this.looping = false;
        };
        AudioBufferSourceNode = AudioBufferSourceNode.extendsFrom(AudioNode);

        AudioBufferSourceNode.prototype.noteOn = function (time) {
            setTimeout(this._play.bind(this), time);
        };

        AudioBufferSourceNode.prototype._play = function () {
            this._audio.volume = 0; // mute source
            this._audio.play()
        }
        
        var AudioDestinationNode = function (context) {
            this.context = context;
            //this.numberOfChannels = 2;
            //this.numberOfInputs = 0;
            //this.numberOfOutputs = 0;
        }
        AudioDestinationNode = AudioDestinationNode.extendsFrom(AudioNode);

    
        var AudioGainNode = function (context) {
        }
        AudioGainNode  = AudioGainNode.extendsFrom(AudioNode);
        
        function _mozLoadAudio(url, context, success, error) {
            var audio = new Audio(src=url);
            audio.addEventListener("loadeddata", function () {
                var source = new AudioBufferSourceNode(context, audio);
                source.connect(context.destination);
                success(source);
            });    
        };
        
        var AudioBuffer = function (data) {
        }
        
        return {
            loadAudio: _mozLoadAudio,
            AudioContext: AudioContext
        };
    }
    
}());
