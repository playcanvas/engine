pc.extend(pc.fw, function () {
    var InitFile = function (appProperties, toc) {
        this.appProperties = appProperties;
        this.toc = toc;
    };

    return {
        loadInitFile: function (url, success) {
            pc.net.http.get(url, function (response) {
                var initfile = pc.fw.parseInitFile(response);
                success(initfile);
            }.bind(this), {
                cache: false
            });            
        },

        parseInitFile: function (data) {
            var initfile = new pc.fw.InitFile(data.application_properties, data.toc);


            return initfile;
        },

        InitFile: InitFile,
    };
}());