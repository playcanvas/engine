pc.extend(pc, function () {
    var os = {
        desktop: false,
        iOs: false,
        android: false,
        cocoonJs: false
    };

    var ua = navigator.userAgent;

    if (/Windows/.test(ua) || /Mac OS/.test(ua) || /Linux/.test(ua) || /CrOS/.test(ua))
    {
        os.desktop = true;
    }
    else if (/Android/.test(ua))
    {
        os.android = true;
    }
    else if (/iP[ao]d|iPhone/i.test(ua))
    {
        os.iOs = true;
    }

    if (navigator.isCocoonJS) {
        os.cocoonJs = true;
    }

    return {
        os: os
    };
}());
