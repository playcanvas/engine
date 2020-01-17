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
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.desktop
         * @description is it a desktop or laptop device
         */
        desktop: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.mobile
         * @description is it a mobile or tablet device
         */
        mobile: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.ios
         * @description if it is iOS
         */
        ios: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.android
         * @description if it is Android
         */
        android: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.windows
         * @description if it is Windows
         */
        windows: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.xbox
         * @description if it is Xbox
         */
        xbox: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.gamepads
         * @description if platform supports gamepads
         */
        gamepads: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.touch
         * @description if platform supports touch input
         */
        touch: false,

        /**
         * @static
         * @readonly
         * @type {boolean}
         * @name pc.platform.workers
         * @description if the platform supports Web Workers
         */
        workers: false
    };

    if (typeof navigator !== 'undefined') {
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

        if (typeof window !== 'undefined') {
            platform.touch = 'ontouchstart' in window || ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
        }

        platform.gamepads = 'getGamepads' in navigator;

        platform.workers = (typeof(Worker) !== 'undefined');
    }

    return {
        platform: platform
    };
}());
