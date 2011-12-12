(function () {
if(!window.AudioContext) {
    if(!window.webkitAudioContext) {
        function SoundData(channels, count) {
          this.channels = channels;
          this.count = count;
          this.samples = new Array(channels);
          for(var i=0;i<channels;++i) {
            this.samples[i] = new Float32Array(count);    
          }
        }
        SoundData.prototype.createNew = function() {
          return new SoundData(this.channels, this.count);
        };
        SoundData.prototype.interleave = function() {
          var channels = this.channels, count = this.count;
          var len = channels * count;
          var data = new Float32Array(len);
          for(var k=0; k<channels; ++k) {
            var samples = this.samples[k];
            for(var i=k,j=0; j < count; i+=channels, ++j) {
              data[i] = samples[j];
            }
          }
          return data;
        };
        SoundData.prototype.mix = function(other) {
          for(var i=0, channels=this.channels; i<channels; ++i) {
            var data = this.samples[i], otherData = other.samples[i];
            for(var j=0, count=this.count; j<count; ++j) {
              data[j] += otherData[j];
            }
          }
        };
        
        function AudioConnection(input, output) {
          if(!(input instanceof AudioInput)) throw "input is not AudioInput";
          if(!(output instanceof AudioOutput)) throw "output is not AudioOutput";
        
          this.input = input;
          this.output = output;
          input.connect(this);
          output.connect(this);
        }
        AudioConnection.prototype.disconnect = function() {
          this.input.disconnect(this);
          this.output.disconnect(this);
        };
        
        function AudioInput(node, index) {
          this.node = node;
          this.index = index;
          this.connections = [];
        }
        AudioInput.prototype.connect = function(connection) {
          this.connections.push(connection);
        }
        AudioInput.prototype.disconnect = function(connection) {
          var i=0;
          while(i < this.connections.length && this.connections[i] !== connection) {
            ++i;
          }
          this.connections.splice(i, 1);
        }
        AudioInput.prototype.__pullData = function(soundData, time) {
          var connectionsCount = this.connections.length;
          if(connectionsCount === 0) {
            return;
          } else if(connectionsCount === 1) {
            this.connections[0].output.node.__routePull(soundData, time, this);
          } else {
            // mixing
            for(var i=0;i<connectionsCount;++i) {
              var connectionSoundData = soundData.createNew();
              this.connections[i].output.node.__routePull(connectionSoundData, time, this);
        
              soundData.mix(connectionSoundData);
            }
          }
        }
        
        function AudioOutput(node, index) {
          this.node = node;
          this.index = index;
          this.connections = [];
        }
        AudioOutput.prototype.connect = function(connection) {
          this.connections.push(connection);
        }
        AudioOutput.prototype.disconnect = function(connection) {
          var i=0;
          while(i < this.connections.length && this.connections[i] !== connection) {
            ++i;
          }
          this.connections.splice(i, 1);
        }
        
        function AudioNode(context, numberOfOutputs, numberOfInputs) {
          this.numberOfInputs = numberOfInputs;
          this.numberOfOutputs = numberOfOutputs;
          // this.sampleRate = 0;
        
          var i;
          this.__context = context;
          this.__inputs = [];
          for(i=0;i<numberOfInputs;++i) {
            this.__inputs.push(new AudioInput(this, i));
          }
          this.__outputs = [];
          for(i=0;i<numberOfOutputs;++i) {
            this.__outputs.push(new AudioOutput(this, i));
          }
        
          this.connect = function(destination, output, input) {
            var outputPin = this.__outputs[output || 0];
            var inputPin = destination.__inputs[input || 0];
            
            return new AudioConnection(inputPin, outputPin);
          };
        
          this.disconnect = function(output) {
            var outputPin = this.__outputs[output || 0];
            var connections = outputPin.connections.slice(0, outputPin.connections.length);
            while(connections.length > 0) {
              connections.pop().disconnect();
            }
          };
        
          this.__routePull = function(data, time) {
          };
        
          this.__pullFromInput = function(input, data, time) {
            this.__inputs[input].__pullData(data, time);
          };
        
          var disposed = false;
          this.__dispose = function() {
            if(disposed) return;
        
            disposed = true;
            for(var j=0;j<this.__outputs.length;++j) {
              this.disconnect(j);
            }
            if(this.ondispose) this.ondispose(); 
          }
        
          this.ondispose = null;
        }
        
        function AudioBuffer(data, channels, sampleRate) {
          this.gain = { value: 1.0 };
          this.sampleRate = sampleRate;
          this.numberOfChannels = channels;
        
          this.__numberOfSamples = data.length /channels; 
          this.__length = data.length;
          this.__data = data;
        
          this.duration = data.length / channels / sampleRate;
        
          this.getChannelData = function(channel) {
            var samples = new Float32Array(data.length /channels);
        
            for(var i=channel,j=0;i<data.length;i+=channels,j++) {
              samples[j] = data[i];
            }
        
            return samples;
          };
          this.__copyData = function(channel, sourceOffset, target, offset, count) {
            var i = channel + sourceOffset * channels;
        
            for(var j=0;j<count;j++) {
              target[j + offset] = data[i];
              i+=channels;
            }
          };
        }
        
        function AudioRequest(url, async) {
          // TODO async
        
          function loadAif(callback) {
            var req = new XMLHttpRequest();   
            req.open('GET', url, true);
            req.overrideMimeType('text/plain; charset=x-user-defined');   
            req.onreadystatechange = function (e) {   
              if (req.readyState == 4) {   
                if(req.status == 200 || req.status == 0) {
                  var data = req.responseText;
                  var channelCount = data.charCodeAt(21);
                  var sampleCount = ((data.charCodeAt(22) & 0xFF) << 24) |
                  ((data.charCodeAt(23) & 0xFF) << 16) | ((data.charCodeAt(24) & 0xFF) << 8) | (data.charCodeAt(25) & 0xFF);
                  var offset = 54, len = sampleCount * channelCount;
                  var samples = new Float32Array(len);
                  for(var i=0; i < len; ++i) {
                    var value = ((data.charCodeAt(offset) & 0xFF) << 8) | (data.charCodeAt(offset + 1) & 0xFF);
                    if(value >= 0x8000) value |= ~0x7FFF;
                    samples[i] = value / 0x8000;
                    offset += 2;
                  }
                  callback(samples);
                } else  
                  callback(null);
              }   
            };
            req.send(null);
          } 
          
          this.onload = function() {};
          this.send = function() {
            var request = this;
            loadAif(function(data) {
              if (data) {
                request.buffer = new AudioBuffer(data, 2, 44100);
                request.onload();
              }
            });
          };
        }
        
        function AudioGainNode(context) {
          AudioNode.call(this, context, 1, 1);
        
          this.gain = { value: 1.0 };
          
          this.__routePull = function(data, time) {
            this.__pullFromInput(0, data, time);
            
            var gain = this.gain.value;
            for(var i=0;i<data.length;++i) data[i] *= gain;
          };
        }
        
        // undocumented
        function AudioSourceNode(context, numberOfOutputs) {
          AudioNode.call(this, context, numberOfOutputs, 0);
        }
        
        function AudioBufferSourceNode(context) {
          AudioSourceNode.call(this, context, 1);
        
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
                  correntOffset = 0;
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
        
        }
        
        function ConvolverNode(context) {
          AudioNode.call(this, context, 1, 1);
        
          this.buffer = null;
        
          this.__routePull = function(data, time) {
            this.__pullFromInput(0, data, time);
          };
        }
        
        function AudioLow2PassFilterNode(context) {
          AudioNode.call(this, context, 1, 1);
        
          this.cutoff = { value: 44100 };
          this.resonance = { value: 5.0 };
        
          this.__routePull = function(soundData, time) {
            this.__pullFromInput(0, soundData, time);
          };
        }
        
        // depricated
        function AudioMixerInputNode(context, mixer, index) {
          AudioNode.call(this, context, 1, 1);
        
          this.gain = { value: 1.0 };
        
          this.__index = index;
          this.__mixer = mixer;
        
          this.__routePull = function(data, time) {
            this.__pullFromInput(0, data, time);
          };
        }
        
        // depricated
        function AudioMixerNode(context) {
          AudioNode.call(this, context, 1, 1);
        
          this.createInput = function(owner) {
            var index = this.numberOfInputs++;
            var input = new AudioMixerInputNode(context, this, index);
            input.connect(this);
        
            if(owner) {
              var lastCallback = owner.ondispose;
              owner.ondispose = function() {
                input.__dispose(); if(lastCallback) { lastCallback(); }
              }
            }
            return input;
          };
          this.outputGain = { value: 1.0 };
        
          this.__routePull = function(data, time) {
            this.__pullFromInput(0, data, time);
          };
        }
        
        function AudioPannerNode(context) {
          AudioNode.call(this, context, 1, 1);
        
          this.panningModel = AudioPannerNode.HRTF;
          this.setPosition = function(x, y, z) {};
        
          this.__routePull = function(data, time) {
            this.__pullFromInput(0, data, time);
          };
        }
        AudioPannerNode.HRTF = 2;
        
        function RealtimeAnalyserNode(context) {
          AudioNode.call(this, context, 1, 1);
          
          this.getFloatFrequencyData = function(array) {};
          this.getByteFrequencyData = function(array) {};
        
          // Real-time waveform data         
          this.getByteTimeDomainData = function(array) {};
        
          this.fftSize = 1024;
          this.frequencyBinCount = 1024;
        
          this.minDecibels = -50;
          this.maxDecibels = -10;
        
          this.smoothingTimeConstant = 0.0; 
        
          this.__routePull = function(data, time) {
            this.__pullFromInput(0, data, time);
          };
        }
        
        function AudioDestinationNode(context, tickCallback) {
          var destination = this;
          
          var SAMPLE_RATE = 44100;
          var CHANNELS = 1;
          var PREBUFFER_SIZE = 20000;
          var PORTION_SIZE = 1024;
          AudioNode.call(this, context, 0, 1);
          
          var audio = new Audio();
          audio.mozSetup(CHANNELS, SAMPLE_RATE);
          var readOffset = 0;
          var writeOffset = 0;
          
          this.__audio = audio;
        
          function pullData(chunkSize, time) {
            var soundData = new SoundData(CHANNELS, chunkSize);
            destination.__pullFromInput(0, soundData, time);
            
            return soundData.interleave();
          }
          
          var buffer = null;
          function tick() {
            var written;
            if(buffer) {
              written = audio.mozWriteAudio(buffer);
              if(written < buffer.length) {
                buffer = buffer.slice(written, buffer.length - written);
                return;
              } else {
                buffer = null;
              }
            }
        
            var currentOffset = audio.mozCurrentSampleOffset();
            if(readOffset < currentOffset) {
              var time = currentOffset / SAMPLE_RATE / CHANNELS;
              tickCallback(time);
            }
            if(currentOffset + PREBUFFER_SIZE >= writeOffset) {
              var data = pullData(PORTION_SIZE, writeOffset / SAMPLE_RATE / CHANNELS);
              written = audio.mozWriteAudio(data);
              if(written < data.length) {
                buffer = data.slice(written, data.length - written);
              }
              writeOffset += PORTION_SIZE;
            }
            readOffset = currentOffset;
          }
          
          var interval = setInterval(tick, 10);
          
          tickCallback(0);
        }
        
        function AudioContext() {
          var context = this;
        
          function tick(currentTime) {
            context.currentTime = currentTime;
          }
        
          this.destination = new AudioDestinationNode(this, tick);
        
          function setOwner(obj, owner) {
            if(!owner) {
              return obj;
            }
            var lastCallback = owner.ondispose;
            owner.ondispose = function() {
              obj.__dispose(); if(lastCallback) { lastCallback(); }
            }
            return obj;
          }
          
          this.createConvolver = function(owner) {
            return setOwner(new ConvolverNode(this), owner);
          };
        
          // undocumented
          this.createAudioRequest = function(url, async) {
            return new AudioRequest(url, async);
          };
        
          this.createBufferSource = function(owner) {
            return setOwner(new AudioBufferSourceNode(this), owner);
          };
        
          this.createGainNode = function(owner) {
            return setOwner(new AudioGainNode(this), owner);
          };
        
          this.createLowPass2Filter = function(owner) {
            return setOwner(new AudioLow2PassFilterNode(this), owner);
          };
        
          // depricated
          this.createMixer = function(owner) {
            return setOwner(new AudioMixerNode(this), owner);
          };
        
          this.createPanner = function(owner) {
            return setOwner(new AudioPannerNode(this), owner);
          };
        
          this.createAnalyser = function() {
            return new RealtimeAnalyserNode(this);
          };
        }
        
        function MediaElementAudioSourceNode(audioElement) {
          AudioNode.call(this, null, 1, 0);
        
          var audioAvailable = function(event) {
            // dispatch audio down the chain
            var frameBuffer = event.frameBuffer;
            for (var i in outputs) {
              // this.outputs[i].send(frameBuffer);
            }
          };
        
          audioElement.addEventListener('mozaudiowritten', audioAvailable, false);
        }
        MediaElementAudioSourceNode.__getAudioSource = function() {
          if(!("__audioSource" in this)) {
            this.__audioSource = new MediaElementAudioSourceNode(this);
          }
          return this.__audioSource;
        };
        
        HTMLMediaElement.prototype.__defineGetter__("audioSource", MediaElementAudioSourceNode.__getAudioSource);
        
        window.AudioContext = AudioContext;
        window.AudioContext.__type = "audionode.js"; // So we can test that this isn't a proper AudioContext object
        window.AudioBuffer = AudioBuffer;
        window.AudioSourceNode = AudioSourceNode;
    }
}    
})();
