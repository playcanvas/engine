Object.assign(pc, function () {
    'use strict';

    var AnimationHandler = function () {
        this.retryRequests = false;
        this._glbParser = new pc.GlbAnimationsParser();
    };

    Object.assign(AnimationHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            // we need to specify JSON for blob URLs
            var options = {
                retry: this.retryRequests
            };

            if (url.load.startsWith('blob:')) {
                options.responseType = pc.Http.ResponseType.JSON;
            }

            pc.http.get(url.load, options, function (err, response) {
                if (err) {
                    callback(pc.string.format("Error loading animation resource: {0} [{1}]", url.original, err));
                } else {
                    callback(null, response);
                }
            });
        },

        open: function (url, data) {
            return this["_parseAnimationV" + data.animation.version](data);
        },

        openAsync: function (url, data, asset, onLoaded, onFailed) {
            if (pc.path.getExtension(url) === '.glb') {
                this._glbParser.parse(data, onLoaded, onFailed);
            } else {
                onLoaded(this["_parseAnimationV" + data.animation.version](data));
            }
            return true;
        },

        _parseAnimationV3: function (data) {
            var animData = data.animation;

            var anim = new pc.Animation();
            anim.setName(animData.name);
            anim.duration = animData.duration;

            for (var i = 0; i < animData.nodes.length; i++) {
                var node = new pc.Node();

                var n = animData.nodes[i];
                node._name = n.name;

                var posKeys = node._keys[pc.KEYTYPE_POS];
                var rotKeys = node._keys[pc.KEYTYPE_ROT];
                var sclKeys = node._keys[pc.KEYTYPE_SCL];

                var posSkip = null, rotSkip = null, sclSkip = null;

                for (var j = 0; j < n.keys.length; j++) {
                    var k = n.keys[j];

                    var t = k.time;
                    var p = k.pos;
                    var r = k.rot;
                    var s = k.scale;
                    var pos = new pc.Vec3(p[0], p[1], p[2]);
                    var rot = new pc.Quat().setFromEulerAngles(r[0], r[1], r[2]);
                    var scl = new pc.Vec3(s[0], s[1], s[2]);

                    posSkip = this._insert(new pc.Keyframe(t, pos), j, posKeys, posSkip);
                    rotSkip = this._insert(new pc.Keyframe(t, rot), j, rotKeys, rotSkip);
                    sclSkip = this._insert(new pc.Keyframe(t, scl), j, sclKeys, sclSkip);
                }

                anim.addNode(node);
            }

            return anim;
        },

        _parseAnimationV4: function (data) {
            var animData = data.animation;

            var anim = new pc.Animation();
            anim.setName(animData.name);
            anim.duration = animData.duration;

            for (var i = 0; i < animData.nodes.length; i++) {
                var node = new pc.Node();

                var n = animData.nodes[i];
                node._name = n.name;

                var defPos = n.defaults.p;
                var defRot = n.defaults.r;
                var defScl = n.defaults.s;

                var posKeys = node._keys[pc.KEYTYPE_POS];
                var rotKeys = node._keys[pc.KEYTYPE_ROT];
                var sclKeys = node._keys[pc.KEYTYPE_SCL];

                var posSkip = null, rotSkip = null, sclSkip = null;

                for (var j = 0; j < n.keys.length; j++) {
                    var k = n.keys[j];

                    var t = k.t;
                    var p = defPos ? defPos : k.p;
                    var r = defRot ? defRot : k.r;
                    var s = defScl ? defScl : k.s;
                    var pos = new pc.Vec3(p[0], p[1], p[2]);
                    var rot = new pc.Quat().setFromEulerAngles(r[0], r[1], r[2]);
                    var scl = new pc.Vec3(s[0], s[1], s[2]);

                    posSkip = this._insert(new pc.Keyframe(t, pos), j, posKeys, posSkip);
                    rotSkip = this._insert(new pc.Keyframe(t, rot), j, rotKeys, rotSkip);
                    sclSkip = this._insert(new pc.Keyframe(t, scl), j, sclKeys, sclSkip);
                }

                anim.addNode(node);
            }

            return anim;
        },

        _insert: function (newKey, idx, keys, skip) {
            if (idx === 0) {
                keys.push(newKey);
            } else if (keys[keys.length - 1].value.equals(newKey.value)) {
                skip = newKey;
            } else {
                if (skip) {
                    keys.push(skip);
                }
                skip = null;
                keys.push(newKey);
            }
            return skip;
        }
    });

    return {
        AnimationHandler: AnimationHandler
    };
}());
