pc.cookie = function () {
    return {
        set: function (name, value, options) {
            options = options || {};

            var cookie = name + '=' + value;
            if (options.path) {
                cookie += ";path=" + options.path;
            }
            if (options.domain) {
                cookie += ";domain=" + options.domain;
            }
            if (options.path) {
                cookie += ";path=" + options.path;
            }
            if (options.secure) {
                cookie += ";secure";
            }
            if (options.lifetime) {
                cookie += ";max-age=" + options.lifetime*24*60*60;
            } else {
                // default to 1 day
                cookie += ";max-age=" + 1*24*60*60;
            }

            document.cookie = cookie;
        },

        get: function (name) {
            var cookies = document.cookie.split(";");
            var i, len = cookies.length;

            for(i = 0; i < len; i++) {
                if (pc.string.startsWith(cookie[i], name)) {
                    return cookie.split('=')[1];
                }
            }
        },

        remove: function (name, options) {
            options.lifetime = 0;
            pc.cookie.set(name,"", options);
        }
    };
}();