pc.gfx.post = {};

pc.gfx.post.initialize = function (device) {
    for (var effect in pc.gfx.post) {
        if (typeof pc.gfx.post[effect] === 'object') {
            pc.gfx.post[effect].initialize(device);
        }
    }
}