pc.extend(pc.audio, function () {
    function _httpLoadAudio(url, context, success, error) {
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
    }

    function _mozLoadAudio2(url, context, success, error) {
        var audio = new Audio();
        var source = null;
        var buffer = null;
        audio.addEventListener("loadeddata", function () {
            source = new AudioElementSourceNode(context, audio);
    
            //var length = Math.ceil(audio.duration * audio.mozSampleRate * audio.mozChannels / audio.mozFrameBufferLength) * audio.mozFrameBufferLength;
            //buffer = new Float32Array(length);
            success(source);
        }, false);
        /*
        audio.addEventListener("MozAudioAvailable", function (event) {
            if (buffer) {
                // Create new buffer concatenating the new data on the end
                var len = this.buffer.__data.length;
                var buffer = new Float32Array(len + event.frameBuffer.length);
    
                buffer.set(this.buffer.__data);
                buffer.set(event.frameBuffer, len);
                //this.buffer = new window.AudioBuffer(buffer, 2, 44100);
            } else {
                buffer = new Float32Array(event.frameBuffer); //new window.AudioBuffer(, 2, 44100);    
            }
        }.bind(this), false);
        */
        audio.src = url;
    };

    function AudioElementSourceNode(context, audio) {
      AudioSourceNode.call(this, context, 1);

        this.audio = audio;
        var source = null;
        
        this.audio.addEventListener("error", function () {
            error("Error loading: " + url);
        }, false);
        this.audio.addEventListener("MozAudioAvailable", function (event) {
            if (this.buffer) {
                // Create new buffer concatenating the new data on the end
                var len = this.buffer.__data.length;
                var buffer = new Float32Array(len + event.frameBuffer.length);
            
                buffer.set(this.buffer.__data);
                buffer.set(event.frameBuffer, len);
                this.buffer = new window.AudioBuffer(buffer, 2, 44100);
            } else {
                this.buffer = new window.AudioBuffer(event.frameBuffer, 2, 44100);    
            }
        }.bind(this), false);
        this.audio.volume = 0;
        this.audio.play();
    
      this.gain = { value: 1.0 };  
      this.buffer = null;
      this.loop = false;
      this.playbackRate = { value: 1.0 };
      
      var isOn = false, currentOffset;
      var onWhen = null, offWhen = null;
    
      this.noteOn = function(when) { onWhen = when||0; };
      this.noteGrainOn = function(when, grainOffset, grainDuration) { throw "not implemented"; };
      this.noteOff = function(when) { offWhen = when||0; };
      
      var tail = 0;
      var self = this;
      function pullDataFromTheBuffer(data, time, via) {
        var wasOn = isOn;
        if(onWhen !== null) {
          if(onWhen <= time) { 
            if(!isOn) { 
              isOn = true;
              currentOffset = 0;
              wasOn = true;
            }
            onWhen = null; 
          }
        }
        if(offWhen !== null) {
          if(offWhen <= time) { 
            isOn = false; 
            offWhen = null; 
          }
        }
        var buffer = self.buffer;
        if(isOn && buffer) {
          var tail = buffer.__numberOfSamples - currentOffset;
          var offset = 0, count = data.length;
          while(tail < count) {
            buffer.__copyData(0, currentOffset, data, offset, tail);
            offset += tail; count -= tail;
            if(self.loop) {
              currentOffset = 0;
              tail = buffer.__numberOfSamples;
            } else {
              isOn = false; 
              break;
            }
          }
          if(isOn && count > 0) {
            buffer.__copyData(0, currentOffset, data, offset, count);
            currentOffset += count;
            
            if(currentOffset >= buffer.__numberOfSamples) {
              if(self.loop) {
                currentOffset = 0;
              } else {
                isOn = false;
              }
            }
          }
        }
        if(wasOn && !isOn) {
          self.__dispose();
        }
      }
    
      this.__routePull = function(soundData, time) {
        this.__update();
        
        var playbackRate = this.playbackRate.value;
        var samplesToPullEst = soundData.count * playbackRate + tail;
        var samplesToPull = Math.floor(samplesToPullEst);
        tail = samplesToPullEst - samplesToPull;
        
        var sourceData = new Float32Array(samplesToPull);
        pullDataFromTheBuffer(sourceData, time);
    
        // TODO map source channels to requested data
        var channels = soundData.channels, data = soundData.samples[0];
        for(var i=0,j=0,count=soundData.count;i<count;i++,j+=playbackRate) {
          data[i * channels] += sourceData[0|j];
        }
      };
      
      this.__update = function () {
          this.audio.loop = this.loop;              
      };
    }

    if (window.AudioContext) {
        return {
            loadAudio: _mozLoadAudio2,
            AudioContext: window.AudioContext
        };        
    }
    if(window.webkitAudioContext) {
        return {
            loadAudio: _httpLoadAudio,
            AudioContext: window.webkitAudioContext
        };
    } else {
        
        /**
         * @name pc.audio.AudioContext
         * @description Interface which contains audio signal graph representing connections between audio nodes
         */
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
        
        /**
         * @name pc.audio.AudioNode
         * @description AudioNode interface which represents audio sources, audio outputs and intermediate processing nodes.
         * Only exists for browsers that do not implement the W3 Web Audio API
         * 
         */
        var AudioNode = function (context, audio) {
            if (audio) {
                this._audio = audio;
            } else {
                this._audio = new Audio();
            }
            
            this._audio.volume = 0; // mute any node that isn't a destination
            
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
             node._audio.mozSetup(this._audio.mozChannels, this._audio.mozSampleRate);  
            
            // Add to lists
            node.inputs.push(this);
            this.outputs.push(node);
        }
        
        /**
         * @name pc.audio.AudioBufferSourceNode
         * @description An AudioNode which generates audio from a buffer
         * Only exists for browsers that do not implement the W3 Web Audio API
         */
        var AudioBufferSourceNode = function (context) {
            this.gain = new AudioParam(1,0,1);
            this.loop = false;
            this.looping = false;
        };
        AudioBufferSourceNode = AudioBufferSourceNode.extendsFrom(AudioNode);

        AudioBufferSourceNode.prototype.noteOn = function (time) {
            setTimeout(this._play.bind(this), time);
        };

        AudioBufferSourceNode.prototype._play = function () {
            this._audio.volume = 0; // mute source
            this._audio.play()
        }
        
        /**
         * @name pc.audio.AudioDestinationNode
         * @description AudioNode representing the final destination of an audio signal
         * Only exists for browsers that do not implement the W3 Web Audio API
         */
        var AudioDestinationNode = function (context) {
            this.context = context;
            
            this._audio.volume = 1; // destinations are not muted
            //this.numberOfChannels = 2;
            //this.numberOfInputs = 0;
            //this.numberOfOutputs = 0;
        }
        AudioDestinationNode = AudioDestinationNode.extendsFrom(AudioNode);

    
        /**
         * @name pc.audio.AudioGainNode
         * @description Explicit gain (volume) control. 
         */
        var AudioGainNode = function (context) {
        };
        AudioGainNode  = AudioGainNode.extendsFrom(AudioNode);
        
        
        var AudioParam = function (value, minValue, maxValue) {
            this.defaultValue = 1;
            this.value = value || this.defaultValue;
            this.minValue = minValue || 0;
            this.maxValue = maxValue || 1;
            this.name = "AudioParam";
        };
        
        AudioParam.prototype = {
            setValueAtTime: function (value, time) {},
            linearRampToValueAtTime: function (value, time) {},
            exponentialRampToValueAtTime: function (value, time) {},
    
            // Exponentially approach the target value with a rate having the given time constant. 
            setTargetValueAtTime: function (targetValue, time, timeConstant) {},
    
            // Sets an array of arbitrary parameter values starting at time for the given duration. 
            // The number of values will be scaled to fit into the desired duration. 
            setValueCurveAtTime: function (values, time, duration) {},
            
            // Cancels all scheduled parameter changes with times greater than or equal to startTime. 
            cancelScheduledValues: function (startTime) {}        
        };
        
        
        function _mozLoadAudio(url, context, success, error) {
            var audio = new Audio();
            audio.addEventListener("loadeddata", function () {
                var source = new AudioBufferSourceNode(context, audio);
                //source.connect(context.destination);
                success(source);
            }, false);
            audio.addEventListener("error", function () {
                error("Error loading: " + url);
            }, false);
            audio.src = url;
        };
        
        var AudioBuffer = function (data) {
        }
        
        return {
            loadAudio: _mozLoadAudio,
            AudioContext: AudioContext
        };
    }
    
}());
