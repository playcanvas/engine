pc.extend(pc.resources, function () {
	var AnimationResourceHandler = function () {
	};
	AnimationResourceHandler = AnimationResourceHandler.extendsFrom(pc.resources.ResourceHandler);
	
    AnimationResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
    	var url = identifier;
        var dir = pc.path.getDirectory(url);

        pc.net.http.get(url, function (response) {
	        try {
    	    	success(response);
	        } catch (e) {
	            error(pc.string.format("An error occured while loading animation from: '{0}'", url));
	        }
        }.bind(this), {cache:false});
    };

    AnimationResourceHandler.prototype.open = function (data, options) {
        animation = this._loadAnimation(data);
    	return animation;
    };
	
	AnimationResourceHandler.prototype._loadAnimation = function (animData) {
	    var nodes = [];
	    for (var i = 0; i < animData.nodes.length; i++) {
	        var keys = [];
	        for (var j = 0; j < animData.nodes[i].length; j++) {
	            key = new pc.anim.Key();
	            key._quat  = animData.nodes[i][j].quat;
	            key._pos   = animData.nodes[i][j].pos;
	            key._scale = animData.nodes[i][j].scale;
	            key._time  = animData.nodes[i][j].time;
	            keys.push(key);
	        }
	        nodes.push(keys);
	    }
	
	    var anim = new pc.anim.Animation();
	    
	    anim.setName(animData.name);
	    anim.setDuration(animData.duration);
	    anim.setNodes(nodes);
	    
	    return anim;
	};
	
	var AnimationRequest = function AnimationRequest(identifier) {
	};
	AnimationRequest = AnimationRequest.extendsFrom(pc.resources.ResourceRequest);
	
	return {
		AnimationResourceHandler: AnimationResourceHandler,
		AnimationRequest: AnimationRequest
	}	
}());
