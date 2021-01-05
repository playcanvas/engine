import { path } from '../core/path.js';

import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

import { http, Http } from '../net/http.js';

import { Animation, Key, Node } from '../animation/animation.js';

import { GlbParser } from '../resources/parser/glb-parser.js';

/**
 * @class
 * @name pc.AnimationHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.Animation} resources.
 */
class AnimationHandler {
    constructor() {
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // we need to specify JSON for blob URLs
        var options = {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };

        if (url.load.startsWith('blob:') || url.load.startsWith('data:')) {
            if (path.getExtension(url.original).toLowerCase() === '.glb') {
                options.responseType = Http.ResponseType.ARRAY_BUFFER;
            } else {
                options.responseType = Http.ResponseType.JSON;
            }
        }

        http.get(url.load, options, function (err, response) {
            if (err) {
                callback("Error loading animation resource: " + url.original + " [" + err + "]");
            } else {
                callback(null, response);
            }
        });
    }

    open(url, data) {
        if (path.getExtension(url).toLowerCase() === '.glb') {
            var glb = GlbParser.parse("filename.glb", data, null);
            if (!glb) {
                return null;
            }
            return glb.animations;
        }
        return this["_parseAnimationV" + data.animation.version](data);
    }

    _parseAnimationV3(data) {
        var animData = data.animation;

        var anim = new Animation();
        anim.setName(animData.name);
        anim.duration = animData.duration;

        for (var i = 0; i < animData.nodes.length; i++) {
            var node = new Node();

            var n = animData.nodes[i];
            node._name = n.name;

            for (var j = 0; j < n.keys.length; j++) {
                var k = n.keys[j];

                var t = k.time;
                var p = k.pos;
                var r = k.rot;
                var s = k.scale;
                var pos = new Vec3(p[0], p[1], p[2]);
                var rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
                var scl = new Vec3(s[0], s[1], s[2]);

                var key = new Key(t, pos, rot, scl);

                node._keys.push(key);
            }

            anim.addNode(node);
        }

        return anim;
    }

    _parseAnimationV4(data) {
        var animData = data.animation;

        var anim = new Animation();
        anim.setName(animData.name);
        anim.duration = animData.duration;

        for (var i = 0; i < animData.nodes.length; i++) {
            var node = new Node();

            var n = animData.nodes[i];
            node._name = n.name;

            var defPos = n.defaults.p;
            var defRot = n.defaults.r;
            var defScl = n.defaults.s;

            for (var j = 0; j < n.keys.length; j++) {
                var k = n.keys[j];

                var t = k.t;
                var p = defPos ? defPos : k.p;
                var r = defRot ? defRot : k.r;
                var s = defScl ? defScl : k.s;
                var pos = new Vec3(p[0], p[1], p[2]);
                var rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
                var scl = new Vec3(s[0], s[1], s[2]);

                var key = new Key(t, pos, rot, scl);

                node._keys.push(key);
            }

            anim.addNode(node);
        }

        return anim;
    }
}

export { AnimationHandler };
