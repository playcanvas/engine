Object.assign(pc, function () {
    /**
     * @namespace
     * @name pc.platform
     * @description Global namespace that stores flags regarding platform environment and features support
     * @example
     * if (pc.platform.touch) {
     *     // touch is supported
     * }
     */
    var platform = {
        /**
         * @name pc.platform.desktop
         * @description is it a desktop or laptop device
         * @type Boolean
         */
        desktop: false,

        /**
         * @name pc.platform.mobile
         * @description is it a mobile or tablet device
         * @type Boolean
         */
        mobile: false,

        /**
         * @name pc.platform.ios
         * @description if it is iOS
         * @type Boolean
         */
        ios: false,

        /**
         * @name pc.platform.android
         * @description if it is Android
         * @type Boolean
         */
        android: false,

        /**
         * @name pc.platform.windows
         * @description if it is Windows
         * @type Boolean
         */
        windows: false,

        /**
         * @name pc.platform.xbox
         * @description if it is Xbox
         * @type Boolean
         */
        xbox: false,

        /**
         * @name pc.platform.gamepads
         * @description if platform supports gamepads
         * @type Boolean
         */
        gamepads: false,

        /**
         * @name pc.platform.touch
         * @description if platform supports touch input
         * @type Boolean
         */
        touch: false,

        /**
         * @name pc.platform.workers
         * @description if the platform supports Web Workers
         * @type Boolean
         */
        workers: false
    };

    var ua = navigator.userAgent;

    if (/(windows|mac os|linux|cros)/i.test(ua))
        platform.desktop = true;

    if (/xbox/i.test(ua))
        platform.xbox = true;

    if (/(windows phone|iemobile|wpdesktop)/i.test(ua)) {
        platform.desktop = false;
        platform.mobile = true;
        platform.windows = true;
    } else if (/android/i.test(ua)) {
        platform.desktop = false;
        platform.mobile = true;
        platform.android = true;
    } else if (/ip([ao]d|hone)/i.test(ua)) {
        platform.desktop = false;
        platform.mobile = true;
        platform.ios = true;
    }

    platform.touch = 'ontouchstart' in window || ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);

    platform.gamepads = 'getGamepads' in navigator;

    platform.workers = (typeof(Worker) !== 'undefined');

    return {
        platform: platform
    };
}());
