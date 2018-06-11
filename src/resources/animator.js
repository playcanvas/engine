pc.extend(pc, function () {
    'use strict';

    var AnimatorHandler = function () {
    };

    AnimatorHandler.prototype = {
        load: function (url, callback) {
            pc.http.get(url, function (err, response) {
                if (err) {
                    callback(pc.string.format("Error loading ANIMATor resource: {0} [{1}]", url, err));
                } else {
                    callback(null, response);
                }
            }.bind(this));
        },

        open: function (url, data) {  

            var dPosDot = url.lastIndexOf('.');
            var ext = url.substring(dPosDot+1);
            var animation = null;
            if(ext === "gltf") {
                animation = this._parseGltf(data);
            }
            else if (ext === "glb") {
                animation = this._parseGlb(data);
            }
            else {//legacy animation
                animation = this["_parseNewAnimationV" + data.animation.version](data);
                var dPosSlash = url.lastIndexOf('/');
                animation.name = url.substring(dPosSlash+1);
            }
            return animation; 
        },

        //gltf/glb ============================================================================
        _parseGltf: function(dataGltf) {
            console.log("gltf:"+dataGltf);
            var buffer = JSON.parse(dataGltf);
            var o_animation = null;
            loadGltf(buffer, app.graphicsDevice, function (roots) {
                //this.initializeScene(roots); 
                if(roots[0].script.anim && roots[0].script.anim.animGroup.animations) {
                    o_animation = roots[0].script.anim.animGroup; 
                }
            }.bind(this));  
            return o_animation; 
        },
        _parseGlb: function(dataGlb) {
            console.log("glb:"+dataGlb); 
            var buffer = JSON.parse(dataGlb);
            var o_animation = null;
            oadGltf(buffer, app.graphicsDevice, function (roots) {
                //this.initializeScene(roots); 
                if(roots[0].script.anim && roots[0].script.anim.animGroup.animations) {
                    o_animation = roots[0].script.anim.animGroup; 
                }
            }.bind(this));  
            return o_animation;  
        },


        //legacy json animation =================================================================
        _parseNewAnimationV3: function(data) {//data contains legacy animation
            var data = data.animation; 
            var animation = new pc.Animation2(null); 
            animation.name = data.name;
            animation.duration = data.duration;

            for (var i = 0; i < data.nodes.length; i++) { 
                var n = data.nodes[i];

                var curvePos = new pc.AnimationCurve(null);
                curvePos.name = n.name + "_localPosition";
                curvePos.keyableType = pc.AnimationKeyableType.VEC;
                curvePos.setTarget(n, "localPosition");

                var curveRot = new pc.AnimationCurve(null);
                curveRot.name = n.name + "_localRotation";
                curveRot.keyableType = pc.AnimationKeyableType.QUAT;
                curveRot.setTarget(n, "localRotation");

                var curveScale = new pc.AnimationCurve(null);
                curveScale.name = n.name + "_localScale";
                curveScale.keyableType = pc.AnimationKeyableType.VEC;
                curveScale.setTarget(n, "localScale");

                //curve.type LINEAR 
                for (var j = 0; j < n.keys.length; j++) {
                    var k = n.keys[j]; 
                    var t = k.time;
                    var p = k.pos;
                    var r = k.rot;
                    var s = k.scale; 

                    var pos = new pc.Vec3(p[0], p[1], p[2]);
                    var rot = new pc.Quat().setFromEulerAngles(r[0], r[1], r[2]);
                    var scl = new pc.Vec3(s[0], s[1], s[2]); 

                    curvePos.insertKey(pc.AnimationKeyableType.VEC, t, pos); 
                    curveRot.insertKey(pc.AnimationKeyableType.QUAT, t, rot);
                    curveScale.insertKey(pc.AnimationKeyableType.VEC, t, scl); 
                }
                animation.addCurve(curvePos);
                animation.addCurve(curveRot);
                animation.addCurve(curveScale);
            }

            return animation;
        },

        _parseNewAnimationV4: function(data) {//data contains legacy format
            var data = data.animation; 
            var animation = new pc.Animation2(null);

            animation.name = data.name;
            animation.duration = data.duration;

            for (var i = 0; i < data.nodes.length; i++) {  
                var n = data.nodes[i];

                var curvePos = new pc.AnimationCurve(null);
                curvePos.name = n.name + "_localPosition";
                curvePos.keyableType = pc.AnimationKeyableType.VEC;
                curvePos.setTarget(n, "localPosition");

                var curveRot = new pc.AnimationCurve(null);
                curveRot.name = n.name + "_localRotation";
                curveRot.keyableType = pc.AnimationKeyableType.QUAT;
                curveRot.setTarget(n, "localRotation");
                
                var curveScale = new pc.AnimationCurve(null);
                curveScale.name = n.name + "_localScale"; 
                curveScale.keyableType = pc.AnimationKeyableType.VEC; 
                curveScale.setTarget(n, "localScale");

                var defPos = n.defaults.p;
                var defRot = n.defaults.r;
                var defScl = n.defaults.s;

                for (var j = 0; j < n.keys.length; j++) {
                    var k = n.keys[j];

                    var t = k.t;
                    var p = defPos ? defPos : k.p;
                    var r = defRot ? defRot : k.r;
                    var s = defScl ? defScl : k.s;
                    var pos = new pc.Vec3(p[0], p[1], p[2]);
                    var rot = new pc.Quat().setFromEulerAngles(r[0], r[1], r[2]);
                    var scl = new pc.Vec3(s[0], s[1], s[2]);
 
                    curvePos.insertKey(pc.AnimationKeyableType.VEC, t, pos);
                    curveRot.insertKey(pc.AnimationKeyableType.QUAT, t, rot);
                    curveScale.insertKey(pc.AnimationKeyableType.VEC, t, scl); 
                }
                animation.addCurve(curvePos);
                animation.addCurve(curveRot);
                animation.addCurve(curveScale);
            } 
            return animation; 
        },  
         
    };

    return {
        AnimatorHandler: AnimatorHandler
    };
}());
