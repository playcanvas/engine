(function () {
    // Input API enums
    var enums = {
        ACTION_MOUSE: 'mouse',
        ACTION_KEYBOARD: 'keyboard',
        ACTION_GAMEPAD: 'gamepad',

        AXIS_MOUSE_X: 'mousex',
        AXIS_MOUSE_Y: 'mousey',
        AXIS_PAD_L_X: 'padlx',
        AXIS_PAD_L_Y: 'padly',
        AXIS_PAD_R_X: 'padrx',
        AXIS_PAD_R_Y: 'padry',
        AXIS_KEY: 'key',

        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_KEYDOWN
         * @description Name of event fired when a key is pressed
         */
        EVENT_KEYDOWN: 'keydown',
        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_KEYUP
         * @description Name of event fired when a key is released
         */
        EVENT_KEYUP: 'keyup',

        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_MOUSEDOWN
         * @description Name of event fired when a mouse button is pressed
         */
        EVENT_MOUSEDOWN: "mousedown",
        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_MOUSEMOVE
         * @description Name of event fired when the mouse is moved
         */
        EVENT_MOUSEMOVE: "mousemove",
        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_MOUSEUP
         * @description Name of event fired when a mouse button is released
         */
        EVENT_MOUSEUP: "mouseup",
        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_MOUSEWHEEL
         * @description Name of event fired when the mouse wheel is rotated
         */
        EVENT_MOUSEWHEEL: "mousewheel",

        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_TOUCHSTART
         * @description Name of event fired when a new touch occurs. For example, a finger is placed on the device.
         */
        EVENT_TOUCHSTART: 'touchstart',
        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_TOUCHEND
         * @description Name of event fired when touch ends. For example, a finger is lifted off the device.
         */
        EVENT_TOUCHEND: 'touchend',
        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_TOUCHMOVE
         * @description Name of event fired when a touch moves.
         */
        EVENT_TOUCHMOVE: 'touchmove',
        /**
         * @constant
         * @type {String}
         * @name pc.EVENT_TOUCHCANCEL
         * @description Name of event fired when a touch point is interrupted in some way.
         * The exact reasons for cancelling a touch can vary from device to device.
         * For example, a modal alert pops up during the interaction; the touch point leaves the document area;
         * or there are more touch points than the device supports, in which case the earliest touch point is canceled.
         */
        EVENT_TOUCHCANCEL: 'touchcancel',

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_BACKSPACE
         */
        KEY_BACKSPACE: 8,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_TAB
         */
        KEY_TAB: 9,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_RETURN
         */
        KEY_RETURN: 13,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_ENTER
         */
        KEY_ENTER: 13,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_SHIFT
         */
        KEY_SHIFT: 16,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_CONTROL
         */
        KEY_CONTROL: 17,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_ALT
         */
        KEY_ALT: 18,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_PAUSE
         */
        KEY_PAUSE: 19,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_CAPS_LOCK
         */
        KEY_CAPS_LOCK: 20,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_ESCAPE
         */
        KEY_ESCAPE: 27,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_SPACE
         */
        KEY_SPACE: 32,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_PAGE_UP
         */
        KEY_PAGE_UP: 33,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_PAGE_DOWN
         */
        KEY_PAGE_DOWN: 34,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_END
         */
        KEY_END: 35,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_HOME
         */
        KEY_HOME: 36,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_LEFT
         */
        KEY_LEFT: 37,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_UP
         */
        KEY_UP: 38,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_RIGHT
         */
        KEY_RIGHT: 39,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_DOWN
         */
        KEY_DOWN: 40,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_PRINT_SCREEN
         */
        KEY_PRINT_SCREEN: 44,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_INSERT
         */
        KEY_INSERT: 45,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_DELETE
         */
        KEY_DELETE: 46,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_0
         */
        KEY_0: 48,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_1
         */
        KEY_1: 49,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_2
         */
        KEY_2: 50,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_3
         */
        KEY_3: 51,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_4
         */
        KEY_4: 52,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_5
         */
        KEY_5: 53,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_6
         */
        KEY_6: 54,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_7
         */
        KEY_7: 55,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_8
         */
        KEY_8: 56,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_9
         */
        KEY_9: 57,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_SEMICOLON
         */
        KEY_SEMICOLON: 59,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_EQUAL
         */
        KEY_EQUAL: 61,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_A
         */
        KEY_A: 65,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_B
         */
        KEY_B: 66,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_C
         */
        KEY_C: 67,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_D
         */
        KEY_D: 68,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_E
         */
        KEY_E: 69,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F
         */
        KEY_F: 70,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_G
         */
        KEY_G: 71,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_H
         */
        KEY_H: 72,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_I
         */
        KEY_I: 73,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_J
         */
        KEY_J: 74,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_K
         */
        KEY_K: 75,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_L
         */
        KEY_L: 76,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_M
         */
        KEY_M: 77,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_N
         */
        KEY_N: 78,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_O
         */
        KEY_O: 79,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_P
         */
        KEY_P: 80,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_Q
         */
        KEY_Q: 81,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_R
         */
        KEY_R: 82,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_S
         */
        KEY_S: 83,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_T
         */
        KEY_T: 84,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_U
         */
        KEY_U: 85,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_V
         */
        KEY_V: 86,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_W
         */
        KEY_W: 87,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_X
         */
        KEY_X: 88,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_Y
         */
        KEY_Y: 89,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_Z
         */
        KEY_Z: 90,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_WINDOWS
         */
        KEY_WINDOWS: 91,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_CONTEXT_MENU
         */
        KEY_CONTEXT_MENU: 93,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_0
         */
        KEY_NUMPAD_0: 96,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_1
         */
        KEY_NUMPAD_1: 97,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_2
         */
        KEY_NUMPAD_2: 98,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_3
         */
        KEY_NUMPAD_3: 99,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_4
         */
        KEY_NUMPAD_4: 100,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_5
         */
        KEY_NUMPAD_5: 101,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_6
         */
        KEY_NUMPAD_6: 102,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_7
         */
        KEY_NUMPAD_7: 103,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_8
         */
        KEY_NUMPAD_8: 104,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_NUMPAD_9
         */
        KEY_NUMPAD_9: 105,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_MULTIPLY
         */
        KEY_MULTIPLY: 106,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_ADD
         */
        KEY_ADD: 107,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_SEPARATOR
         */
        KEY_SEPARATOR: 108,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_SUBTRACT
         */
        KEY_SUBTRACT: 109,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_DECIMAL
         */
        KEY_DECIMAL: 110,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_DIVIDE
         */
        KEY_DIVIDE: 111,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F1
         */
        KEY_F1: 112,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F2
         */
        KEY_F2: 113,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F3
         */
        KEY_F3: 114,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F4
         */
        KEY_F4: 115,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F5
         */
        KEY_F5: 116,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F6
         */
        KEY_F6: 117,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F7
         */
        KEY_F7: 118,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F8
         */
        KEY_F8: 119,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F9
         */
        KEY_F9: 120,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F10
         */
        KEY_F10: 121,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F11
         */
        KEY_F11: 122,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_F12
         */
        KEY_F12: 123,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_COMMA
         */
        KEY_COMMA: 188,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_PERIOD
         */
        KEY_PERIOD: 190,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_SLASH
         */
        KEY_SLASH: 191,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_OPEN_BRACKET
         */
        KEY_OPEN_BRACKET: 219,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_BACK_SLASH
         */
        KEY_BACK_SLASH: 220,
        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_CLOSE_BRACKET
         */
        KEY_CLOSE_BRACKET: 221,

        /**
         * @constant
         * @type {Number}
         * @name pc.KEY_META
         */
        KEY_META: 224,

        /**
         * @constant
         * @type {Number}
         * @name pc.MOUSEBUTTON_NONE
         * @description No mouse buttons pressed
         */
        MOUSEBUTTON_NONE: -1,
        /**
         * @constant
         * @type {Number}
         * @name pc.MOUSEBUTTON_LEFT
         * @description The left mouse button
         */
        MOUSEBUTTON_LEFT: 0,
        /**
         * @constant
         * @type {Number}
         * @name pc.MOUSEBUTTON_MIDDLE
         * @description The middle mouse button
         */
        MOUSEBUTTON_MIDDLE: 1,
        /**
         * @constant
         * @type {Number}
         * @name pc.MOUSEBUTTON_RIGHT
         * @description The right mouse button
         */
        MOUSEBUTTON_RIGHT: 2,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_1
         * @description Index for pad 1
         */
        PAD_1: 0,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_2
         * @description Index for pad 2
         */
        PAD_2: 1,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_3
         * @description Index for pad 3
         */
        PAD_3: 2,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_4
         * @description Index for pad 4
         */
        PAD_4: 3,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_FACE_1
         * @description The first face button, from bottom going clockwise
         */
        PAD_FACE_1: 0,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_FACE_2
         * @description The second face button, from bottom going clockwise
         */
        PAD_FACE_2: 1,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_FACE_3
         * @description The third face button, from bottom going clockwise
         */
        PAD_FACE_3: 2,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_FACE_4
         * @description The fourth face button, from bottom going clockwise
         */
        PAD_FACE_4: 3,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_L_SHOULDER_1
         * @description The first shoulder button on the left
         */
        PAD_L_SHOULDER_1: 4,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_R_SHOULDER_1
         * @description The first shoulder button on the right
         */
        PAD_R_SHOULDER_1: 5,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_L_SHOULDER_2
         * @description The second shoulder button on the left
         */
        PAD_L_SHOULDER_2: 6,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_R_SHOULDER_2
         * @description The second shoulder button on the right
         */
        PAD_R_SHOULDER_2: 7,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_SELECT
         * @description The select button
         */
        PAD_SELECT: 8,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_START
         * @description The start button
         */
        PAD_START: 9,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_L_STICK_BUTTON
         * @description The button when depressing the left analogue stick
         */
        PAD_L_STICK_BUTTON: 10,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_R_STICK_BUTTON
         * @description The button when depressing the right analogue stick
         */
        PAD_R_STICK_BUTTON: 11,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_UP
         * @description Direction pad up
         */
        PAD_UP: 12,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_DOWN
         * @description Direction pad down
         */
        PAD_DOWN: 13,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_LEFT
         * @description Direction pad left
         */
        PAD_LEFT: 14,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_RIGHT
         * @description Direction pad right
         */
        PAD_RIGHT: 15,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_VENDOR
         * @description Vendor specific button
         */
        PAD_VENDOR: 16,

        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_L_STICK_X
         * @description Horizontal axis on the left analogue stick
         */
        PAD_L_STICK_X: 0,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_L_STICK_Y
         * @description Vertical axis on the left analogue stick
         */
        PAD_L_STICK_Y: 1,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_R_STICK_X
         * @description Horizontal axis on the right analogue stick
         */
        PAD_R_STICK_X: 2,
        /**
         * @constant
         * @type {Number}
         * @name pc.PAD_R_STICK_Y
         * @description Vertical axis on the right analogue stick
         */
        PAD_R_STICK_Y: 3
    };

    Object.assign(pc, enums);

    // For backwards compatibility
    pc.input = {};
    Object.assign(pc.input, enums);
}());
