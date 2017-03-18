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

    if (/Android/.test(ua))
    {
        os.android = true;
        os.desktop = false;
    }
    else if (/iP[ao]d|iPhone/i.test(ua))
    {
        os.iOs = true;
        os.desktop = false;
    }

    if (navigator.isCocoonJS) {
        os.cocoonJs = true;
    }

    return {
        os: os
    };
}());
