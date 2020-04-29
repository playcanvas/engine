Object.assign(pc, function () {
    'use strict';

    var ResourceLoadHandle = function (url, xhr) {
        this._url = url;
        this.xhr = xhr;
        this.loaded = false;
        this.requestFinished = false;
        this.bytesLoaded = 0;
        this.bytesTotal = 0;

        var self = this;
        xhr.onprogress = function(progressEvent) {
            self.onProgressEvent(progressEvent);
        }
    };

    ResourceLoadHandle.prototype.onProgressEvent = function (progressEvent) {
        this.bytesLoaded = progressEvent.loaded;
        this.bytesTotal = progressEvent.total;
    };

    return {
        ResourceLoadHandle: ResourceLoadHandle
    };
}());