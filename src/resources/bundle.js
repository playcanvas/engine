Object.assign(pc, function () {
    var Bundle = function (name, url, fileUrls, preload) {
        this.name = name;
        this.url = url;
        this.files = {};
        for (var i = 0, len = fileUrls.length; i < len; i++) {
            this.files[fileUrls[i]] = null;
        }
        this.loaded = false;
        this.loading = false;
        this.preload = !!preload;

        // this is an event emitter
        Object.assign(this, pc.events);
    };

    Bundle.prototype.hasFile = function (url) {
        return this.files.hasOwnProperty(url);
    };

    return {
        Bundle: Bundle
    };
}());
