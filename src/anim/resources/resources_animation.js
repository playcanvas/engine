pc.extend(pc.resources, function () {
    var AnimationResourceHandler = function () {};

    AnimationResourceHandler = pc.inherits(AnimationResourceHandler, pc.resources.ResourceHandler);

    AnimationResourceHandler.prototype.load = function (request, options) {
        var promise = new RSVP.Promise(function (resolve, reject) {
            var url = request.canonical;
            var dir = pc.path.getDirectory(url);

            pc.net.http.get(url, function (response) {
                try {
                    resolve(response);
                } catch (e) {
                    reject(pc.string.format("An error occured while loading animation from: '{0}'", url));
                }
            }.bind(this), {
                cache: false,
                error: function (errors) {
                    reject(errors);
                }
            });
        });

        return promise;
    };

    AnimationResourceHandler.prototype.open = function (data, request, options) {
        return this._loadAnimation(data);
    };

    AnimationResourceHandler.prototype._loadAnimation = function (data) {
        var animData = data.animation;

        var anim = new pc.anim.Animation();
        anim.setName(animData.name);
        anim.setDuration(animData.duration);

        for (var i = 0; i < animData.nodes.length; i++) {
            var node = new pc.anim.Node();            

            var n = animData.nodes[i];
            node._name = n.name;

            for (var j = 0; j < n.keys.length; j++) {
                var key = new pc.anim.Key();

                var k = n.keys[j];
                var p = k.pos;
                var r = k.rot;
                var s = k.scale;
                var t = k.time;

                key._pos   = pc.math.vec3.create(p[0], p[1], p[2]);
                key._quat  = pc.math.quat.fromEulerXYZ(r[0], r[1], r[2]);
                key._scale = pc.math.vec3.create(s[0], s[1], s[2]);
                key._time  = t;

                node._keys.push(key);
            }

            anim.addNode(node);
        }

        return anim;
    };
	
    var AnimationRequest = function AnimationRequest(identifier) {};

    AnimationRequest = pc.inherits(AnimationRequest, pc.resources.ResourceRequest);
    AnimationRequest.prototype.type = "animation";
	
    return {
        AnimationResourceHandler: AnimationResourceHandler,
        AnimationRequest: AnimationRequest
    };
}());
