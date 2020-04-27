Object.assign(pc, function () {
    'use strict';

    var ResourceLoadHandle = function (url, xhr) {
        this._url = url;
        this.xhr = xhr;
        this.requestFinished = false;
    };

    Object.assign(ResourceLoadHandle.prototype, {

    });

    return {
        ResourceLoadHandle: ResourceLoadHandle
    };
}());