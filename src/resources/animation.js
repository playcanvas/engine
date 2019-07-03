Object.assign(pc, function () {
    'use strict';

    var AnimationHandler = function () {
        this.retryRequests = false;
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

        _parseAnimationV3: function (data) {
            var animData = data.animation;

            var anim = new pc.Animation();
            anim.setName(animData.name);
            anim.duration = animData.duration;

            for (var i = 0; i < animData.nodes.length; i++) {
                var node = new pc.Node();

                var n = animData.nodes[i];
                node._name = n.name;

                var posKeys = node._keys[pc.CKey.POS];
                var rotKeys = node._keys[pc.CKey.ROT];
                var sclKeys = node._keys[pc.CKey.SCL];

                for (var j = 0; j < n.keys.length; j++) {
                    var k = n.keys[j];

                    var t = k.time;
                    var p = k.pos;
                    var r = k.rot;
                    var s = k.scale;
                    var pos = new pc.Vec3(p[0], p[1], p[2]);
                    var rot = new pc.Quat().setFromEulerAngles(r[0], r[1], r[2]);
                    var scl = new pc.Vec3(s[0], s[1], s[2]);

                    if (j === 0 || !posKeys[posKeys.length - 1].value.equals(pos))
                        posKeys.push(new pc.CKey(t, pos));
                    if (j === 0 || !rotKeys[rotKeys.length - 1].value.equals(rot))
                        rotKeys.push(new pc.CKey(t, rot));
                    if (j === 0 || !sclKeys[sclKeys.length - 1].value.equals(scl))
                        sclKeys.push(new pc.CKey(t, scl));
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

                var posKeys = node._keys[pc.CKey.POS];
                var rotKeys = node._keys[pc.CKey.ROT];
                var sclKeys = node._keys[pc.CKey.SCL];

                for (var j = 0; j < n.keys.length; j++) {
                    var k = n.keys[j];

                    var t = k.t;
                    var p = defPos ? defPos : k.p;
                    var r = defRot ? defRot : k.r;
                    var s = defScl ? defScl : k.s;
                    var pos = new pc.Vec3(p[0], p[1], p[2]);
                    var rot = new pc.Quat().setFromEulerAngles(r[0], r[1], r[2]);
                    var scl = new pc.Vec3(s[0], s[1], s[2]);

                    if (j === 0 || !posKeys[posKeys.length - 1].value.equals(pos))
                        posKeys.push(new pc.CKey(t, pos));
                    if (j === 0 || !rotKeys[rotKeys.length - 1].value.equals(rot))
                        rotKeys.push(new pc.CKey(t, rot));
                    if (j === 0 || !sclKeys[sclKeys.length - 1].value.equals(scl))
                        sclKeys.push(new pc.CKey(t, scl));
                }

                anim.addNode(node);
            }

            return anim;
        }
    });

    return {
        AnimationHandler: AnimationHandler
    };
}());
