pc.extend(pc.fw, function () {
    var ContentFile = function (data) {
        this.packs = data.packs || {};
        this.appProperties = data.application_properties || {};
        this.toc = data.toc || {};
    };

    return {
        ContentFile: ContentFile
    };
}());