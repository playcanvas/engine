pc.extend(pc, function () { 

    var AnimatorComponent = function (system, entity) {    
        this._model = null;//target 
        this._clips = {}; //retrieve clip by [clip.name], assigned by user
        this._curClip = null;   
    };
    AnimatorComponent = pc.inherits(AnimatorComponent, pc.Component);


    pc.extend(AnimatorComponent.prototype, {  
        _getCurve: function(clipName, curveName) {
            if(!clipName) {
                if(this._curClip && this._curClip._playable && this._curClip._playable.animCurves)
                    return this._curClip._playable.animCurves[curveName];
                return null;
            }

            var anim = this.animation(clipName);
            if(anim && anim.animCurves) 
                return anim.animCurves[curveName];
            return null;
        },  
        _getCurCurve: function(curveName) {
            if(this._curClip && this._curClip._playable && this._curClip._playable.animCurves)
                return this._curClip._playable.animCurves[cName];
            return null;
        },  
 
        onUpdate: function(dt) {
            for (var key in this._clips) { 
                if (!this._clips.hasOwnProperty(key)) 
                    continue; 
                var clip = this._clips[key];
                if(clip && clip._isPlaying) 
                    clip.onUpdate(dt);
            }
        },

        onEnable: function() {
            AnimatorComponent._super.onEnable.call(this);  

            var registry = this.system.app.assets;  
            for (var key in this._clips) { 
                if (!this._clips.hasOwnProperty(key)) 
                    continue; 

                var clip = this._clips[key];
                if(!clip) continue;

                if (! (clip._asset instanceof pc.Asset))
                    clip._asset = registry.get(clip._asset);

                if (clip._asset && !clip._asset.resource)
                    registry.load(clip._asset);
            } 

            if(this._curClip)
                this._curClip.play();
        },  
        onDisable: function () {
            AnimatorComponent._super.onDisable.call(this); 
            this.enabled = false;

            if(this._curClip)
                this._curClip.stop(); 
        }, 
        onBeforeRemove: function() { 
            for (var key in this._clips) { 
                if (!this._clips.hasOwnProperty(key)) 
                    continue; 

                var clip = this._clips[key]; 
                if(clip)
                    clip.onBeforeRemove();
                delete this._clips[key];
            } 
        },  

        //=========================================================== 
        // APIs  
        clip: function(clipName) {
            if(!clipName || !this._clips)
                return null;

            return this._clips[clipName];
        }, 
        addClip: function(clipName, asset, idx, speed, loop) {
            if(!clipName || !asset)
                return;

            var clip = new pc.AnimationClip(this);//no animation yet
            clip._onAddAsset(asset, idx);//will set clip target here once animation loaded

            if(!(typeof speed === "undefined"))
                clip._speed = speed;
            if(!(typeof loop === "undefined"))
                clip._loop = loop; 

            clip._name = clipName;
            this._clips[clip._name] = clip;
        },
        removeClip: function(clipName) {  
            if(this._clips[clipName])
                delete this._clips[clipName]; 
        },  
        animation: function(clipName) {
            if(!clipName || !this._clips || !this._clips[clipName])
                return null;

            return this._clips[clipName]._playable; 
        }, 
        addAnimation: function(animation) {
            if(animation && (animation instanceof pc.Animation)) {
                var clip = new pc.AnimationClip(this, animation); 
                clip._name = animation.name;
                this._clips[clip._name] = clip;
                if(this._model)
                    this.setClipTarget(clip, this._model.getGraph());  
            } 
        }, 
        setTarget: function(target) { 
            if(target === this._model || !target)
                return;

            if(target instanceof pc.Model){
                this._model = target;  
                
                for (var key in this._clips) { 
                    if (!this._clips.hasOwnProperty(key)) 
                        continue; 
                    this.setClipTarget(this._clips[key], this._model.getGraph()); 
                } 
                return; 
            } 
        }, 
        setClipTarget: function(clip, root) {
            if(!root && this._model)
                root = this._model.getGraph();

            if(!clip || !root || !clip._playable)
                return;  

            var clipTargets = {}; 
            //playable maybe a curve
            if(clip._playable instanceof pc.AnimationCurve) {
                var curve = clip._playable;
                var target = null;
                if(curve.animTargets && curve.animTargets.length > 0)
                    target = curve.animTargets[0].clone();
                if(target) {
                    var nodeName = null;
                    if (typeof target.targetNode === 'string' || target.targetNode instanceof String)
                        nodeName = target.targetNode;
                    else
                        nodeName = target.targetNode.name;  
                    target.targetNode = root.findByName(nodeName);
                    clipTargets[curve.name] = [target]; 
                } 
            } 
            //playable maybe a animation
            if(clip._playable instanceof pc.Animation) {
                var animation = clip._playable;  
                for (var key in animation.animCurves) { 
                    if (!animation.animCurves.hasOwnProperty(key)) 
                        continue;  
                    
                    var curve = animation.animCurves[key];
                    if(!curve.animTargets || curve.animTargets.length < 1)
                        continue;

                    var target = curve.animTargets[0].clone();  
                    var nodeName = null;
                    if (typeof target.targetNode === 'string' || target.targetNode instanceof String)
                        nodeName = target.targetNode;
                    else
                        nodeName = target.targetNode.name;  
                    target.targetNode = root.findByName(nodeName);
                    clipTargets[key] = [target]; 
                }  
            } 
            clip._animTargets = clipTargets; 
        }, 

        // ========================================
        // runtime APIs
        play: function(clipName) { 
            if(!clipName) { //null for playing the current clip
                if(this._curClip) this._curClip.play();
                return;
            }

            var clip = this.clip(clipName);
            if(clip) {
                if(this._curClip) this._curClip.stop(); 
                clip.play();
                this._curClip = clip;
            } 
        },
        stop: function(clipName){
            if(!clipName) { //null for stopping the current clip
                if(this._curClip) this._curClip.stop();
                return;
            }

            var clip = this.clip(clipName);
            if(clip)
                clip.stop(); 
        },
        resume: function(clipName){
            if(!clipName) {
                if(this._curClip) this._curClip.resume();
                return; 
            }

            var clip = this.clip(clipName);
            if(clip) {
                clip.resume();
                this._curClip = clip;
            } 
        },
        pause: function(clipName){
            if(!clipName) {
                if(this._curClip) this._curClip.pause();
                return;
            }

            var clip = this.clip(clipName);
            if(clip)
                clip.pause();
        },
        fadeIn: function(clipName, duration){
            if(!clipName) {
                if(this._curClip) this._curClip.fadeIn();
                return;
            }

            var clip = this.clip(clipName);
            if(clip) {
                clip.fadeIn(duration);
                this._curClip = clip;
            }
        },
        fadeOut: function(clipName, duration){
            if(!clipName) {
                if(this._curClip) this._curClip.fadeOut(duration);
                return;
            }

            var clip = this.clip(clipName);
            if(clip)
                clip.fadeOut(duration);  
        },
        fadeTo: function(clipName, duration){ 
            //fade out current
            if(this._curClip)
                this._curClip.fadeOut(duration);

            //fade in clipName
            var clip = this.clip(clipName);
            if(clip) {
                clip.fadeIn(duration);
                this._curClip = clip;
            }  
        },
        getClipsPlaying: function() {//clips currently playing
            var playing = []; 
            for (var key in this._clips) { 
                if (!this._clips.hasOwnProperty(key)) 
                    continue; 

                if(this._clips[key] && this._clips[key]._isPlaying)
                    playing.push(this._clips[key]._playable);
            }
            return playing;
        },
        getClipsFading: function() {//clips currently fading
            var fading = []; 
            for (var key in this._clips) { 
                if (!this._clips.hasOwnProperty(key)) 
                    continue; 

                if(this._clips[key] && this._clips[key]._fadeDir !== 0)
                    fading.push(this._clips[key]._playable);
            }
            return fading; 
        },
        getClipsFadingIn: function() {
            var fadingIn = []; 
            for (var key in this._clips) { 
                if (!this._clips.hasOwnProperty(key)) 
                    continue; 

                if(this._clips[key] && this._clips[key]._fadeDir === 1)
                    fadingIn.push(this._clips[key]._playable);
            }
            return fadingIn; 
        },
        getClipsFadingOut: function() {
            var fadingOut = [];
            for (var key in this._clips) { 
                if (!this._clips.hasOwnProperty(key)) 
                    continue; 

                if(this._clips[key] && this._clips[key]._fadeDir === -1)
                    fadingOut.push(this._clips[key]._playable);
            }
            return fadingOut; 
        }, 
        isClipPlaying: function(clipName) {
            if(!clipName) {
                if(this._curClip) return this._curClip._isPlaying;
            } 
            var clip = this.clip(clipName);
            if(clip)
                return clip._isPlaying; 
            return false;
        },
        isClipFading: function(clipName) {
            if(!clipName) {
                if(this._curClip) return this._curClip._fadeDir !== 0;
            } 
            var clip = this.clip(clipName);
            if(clip)
                return clip._fadeDir!==0;
            return false; 
        }
         
    });

    Object.defineProperty(AnimatorComponent.prototype, "model", {
        get: function () {
            return this._model;
        },
        set: function (value) {
            this._model = value;
        }
    });

    Object.defineProperty(AnimatorComponent.prototype, "clips", {
        get: function () {
            return this._clips;
        },
        set: function (value) {
            this._clips = value;
        }
    });

    Object.defineProperty(AnimatorComponent.prototype, "currentClip", {
        get: function () {
            return this._curClip;
        },
        set: function (value) {
            this._curClip = value;
        }
    });

    // Events Documentation

    /**
    * @event
    * @name pc.AnimatorComponent#eventname
    * @description Events can be fired and are documented like this
    * @param {String} value Value passed to event
    */

    return {
        AnimatorComponent: AnimatorComponent
    };

}());


// Events Documentation

/**
 * @private
 * @event
 * @name pc.AnimatorComponent#play
 * @description Fired when an animation clip starts playing
 * @param {pc.AnimationClip} clip The clip that started playing
 */

/**
 * @private
 * @event
 * @name pc.AnimatorComponent#pause
 * @description Fired when an animation clip is paused.
 * @param {pc.AnimationClip} clip The clip that was paused
 */

/**
 * @private
 * @event
 * @name pc.AnimatorComponent#resume
 * @description Fired when an animation clip is resumed.
 * @param {pc.AnimationClip} clip The clip that was resumed
 */

/**
 * @private
 * @event
 * @name pc.AnimatorComponent#stop
 * @description Fired when an animation clip is stopped.
 * @param {pc.AnimationClip} clip The clip that was stopped
 */

/**
 * @private
 * @event
 * @name pc.AnimatorComponent#end
 * @description Fired when an animation clip stops playing because it reached its ending.
 * @param {pc.AnimationClip} clip The clip that ended
 */

/**
 * @private
 * @event
 * @name pc.AnimatorComponent#loop
 * @description Fired when an animation clip reached the end of its current loop.
 * @param {pc.AnimationClip} clip The clip
 */
