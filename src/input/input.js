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
         * @enum pc.EVENT
         * @name pc.EVENT_KEYDOWN
         * @description Name of event fired when a key is pressed
         */
        EVENT_KEYDOWN: 'keydown',
        /**
         * @enum pc.EVENT
         * @name pc.EVENT_KEYUP
         * @description Name of event fired when a key is released
         */
        EVENT_KEYUP: 'keyup',

        /**
         * @enum pc.EVENT
         * @name pc.EVENT_MOUSEDOWN
         * @description Name of event fired when a mouse button is pressed
         */
        EVENT_MOUSEDOWN: "mousedown",
        /**
         * @enum pc.EVENT
         * @name pc.EVENT_MOUSEMOVE
         * @description Name of event fired when the mouse is moved
         */
        EVENT_MOUSEMOVE: "mousemove",
        /**
         * @enum pc.EVENT
         * @name pc.EVENT_MOUSEUP
         * @description Name of event fired when a mouse button is released
         */
        EVENT_MOUSEUP: "mouseup",
        /**
         * @enum pc.EVENT
         * @name pc.EVENT_MOUSEWHEEL
         * @description Name of event fired when the mouse wheel is rotated
         */
        EVENT_MOUSEWHEEL: "mousewheel",

        /**
         * @enum pc.EVENT
         * @name pc.EVENT_TOUCHSTART
         * @description Name of event fired when a new touch occurs. For example, a finger is placed on the device.
         */
        EVENT_TOUCHSTART: 'touchstart',
        /**
         * @enum pc.EVENT
         * @name pc.EVENT_TOUCHEND
         * @description Name of event fired when touch ends. For example, a finger is lifted off the device.
         */
        EVENT_TOUCHEND: 'touchend',
        /**
         * @enum pc.EVENT
         * @name pc.EVENT_TOUCHMOVE
         * @description Name of event fired when a touch moves.
         */
        EVENT_TOUCHMOVE: 'touchmove',
        /**
         * @enum pc.EVENT
         * @name pc.EVENT_TOUCHCANCEL
         * @description Name of event fired when a touch point is interrupted in some way.
         * The exact reasons for cancelling a touch can vary from device to device.
         * For example, a modal alert pops up during the interaction; the touch point leaves the document area;
         * or there are more touch points than the device supports, in which case the earliest touch point is canceled.
         */
        EVENT_TOUCHCANCEL: 'touchcancel',

        /**
         * @enum pc.KEY
         * @name pc.KEY_BACKSPACE
         */
        KEY_BACKSPACE: 8,
        /**
         * @enum pc.KEY
         * @name pc.KEY_TAB
         */
        KEY_TAB: 9,
        /**
         * @enum pc.KEY
         * @name pc.KEY_RETURN
         */
        KEY_RETURN: 13,
        /**
         * @enum pc.KEY
         * @name pc.KEY_ENTER
         */
        KEY_ENTER: 13,
        /**
         * @enum pc.KEY
         * @name pc.KEY_SHIFT
         */
        KEY_SHIFT: 16,
        /**
         * @enum pc.KEY
         * @name pc.KEY_CONTROL
         */
        KEY_CONTROL: 17,
        /**
         * @enum pc.KEY
         * @name pc.KEY_ALT
         */
        KEY_ALT: 18,
        /**
         * @enum pc.KEY
         * @name pc.KEY_PAUSE
         */
        KEY_PAUSE: 19,
        /**
         * @enum pc.KEY
         * @name pc.KEY_CAPS_LOCK
         */
        KEY_CAPS_LOCK: 20,
        /**
         * @enum pc.KEY
         * @name pc.KEY_ESCAPE
         */
        KEY_ESCAPE: 27,
        /**
         * @enum pc.KEY
         * @name pc.KEY_SPACE
         */
        KEY_SPACE: 32,
        /**
         * @enum pc.KEY
         * @name pc.KEY_PAGE_UP
         */
        KEY_PAGE_UP: 33,
        /**
         * @enum pc.KEY
         * @name pc.KEY_PAGE_DOWN
         */
        KEY_PAGE_DOWN: 34,
        /**
         * @enum pc.KEY
         * @name pc.KEY_END
         */
        KEY_END: 35,
        /**
         * @enum pc.KEY
         * @name pc.KEY_HOME
         */
        KEY_HOME: 36,
        /**
         * @enum pc.KEY
         * @name pc.KEY_LEFT
         */
        KEY_LEFT: 37,
        /**
         * @enum pc.KEY
         * @name pc.KEY_UP
         */
        KEY_UP: 38,
        /**
         * @enum pc.KEY
         * @name pc.KEY_RIGHT
         */
        KEY_RIGHT: 39,
        /**
         * @enum pc.KEY
         * @name pc.KEY_DOWN
         */
        KEY_DOWN: 40,
        /**
         * @enum pc.KEY
         * @name pc.KEY_PRINT_SCREEN
         */
        KEY_PRINT_SCREEN: 44,
        /**
         * @enum pc.KEY
         * @name pc.KEY_INSERT
         */
        KEY_INSERT: 45,
        /**
         * @enum pc.KEY
         * @name pc.KEY_DELETE
         */
        KEY_DELETE: 46,
        /**
         * @enum pc.KEY
         * @name pc.KEY_0
         */
        KEY_0: 48,
        /**
         * @enum pc.KEY
         * @name pc.KEY_1
         */
        KEY_1: 49,
        /**
         * @enum pc.KEY
         * @name pc.KEY_2
         */
        KEY_2: 50,
        /**
         * @enum pc.KEY
         * @name pc.KEY_3
         */
        KEY_3: 51,
        /**
         * @enum pc.KEY
         * @name pc.KEY_4
         */
        KEY_4: 52,
        /**
         * @enum pc.KEY
         * @name pc.KEY_5
         */
        KEY_5: 53,
        /**
         * @enum pc.KEY
         * @name pc.KEY_6
         */
        KEY_6: 54,
        /**
         * @enum pc.KEY
         * @name pc.KEY_7
         */
        KEY_7: 55,
        /**
         * @enum pc.KEY
         * @name pc.KEY_8
         */
        KEY_8: 56,
        /**
         * @enum pc.KEY
         * @name pc.KEY_9
         */
        KEY_9: 57,

        /**
         * @enum pc.KEY
         * @name pc.KEY_SEMICOLON
         */
        KEY_SEMICOLON: 59,
        /**
         * @enum pc.KEY
         * @name pc.KEY_EQUAL
         */
        KEY_EQUAL: 61,

        /**
         * @enum pc.KEY
         * @name pc.KEY_A
         */
        KEY_A: 65,
        /**
         * @enum pc.KEY
         * @name pc.KEY_B
         */
        KEY_B: 66,
        /**
         * @enum pc.KEY
         * @name pc.KEY_C
         */
        KEY_C: 67,
        /**
         * @enum pc.KEY
         * @name pc.KEY_D
         */
        KEY_D: 68,
        /**
         * @enum pc.KEY
         * @name pc.KEY_E
         */
        KEY_E: 69,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F
         */
        KEY_F: 70,
        /**
         * @enum pc.KEY
         * @name pc.KEY_G
         */
        KEY_G: 71,
        /**
         * @enum pc.KEY
         * @name pc.KEY_H
         */
        KEY_H: 72,
        /**
         * @enum pc.KEY
         * @name pc.KEY_I
         */
        KEY_I: 73,
        /**
         * @enum pc.KEY
         * @name pc.KEY_J
         */
        KEY_J: 74,
        /**
         * @enum pc.KEY
         * @name pc.KEY_K
         */
        KEY_K: 75,
        /**
         * @enum pc.KEY
         * @name pc.KEY_L
         */
        KEY_L: 76,
        /**
         * @enum pc.KEY
         * @name pc.KEY_M
         */
        KEY_M: 77,
        /**
         * @enum pc.KEY
         * @name pc.KEY_N
         */
        KEY_N: 78,
        /**
         * @enum pc.KEY
         * @name pc.KEY_O
         */
        KEY_O: 79,
        /**
         * @enum pc.KEY
         * @name pc.KEY_P
         */
        KEY_P: 80,
        /**
         * @enum pc.KEY
         * @name pc.KEY_Q
         */
        KEY_Q: 81,
        /**
         * @enum pc.KEY
         * @name pc.KEY_R
         */
        KEY_R: 82,
        /**
         * @enum pc.KEY
         * @name pc.KEY_S
         */
        KEY_S: 83,
        /**
         * @enum pc.KEY
         * @name pc.KEY_T
         */
        KEY_T: 84,
        /**
         * @enum pc.KEY
         * @name pc.KEY_U
         */
        KEY_U: 85,
        /**
         * @enum pc.KEY
         * @name pc.KEY_V
         */
        KEY_V: 86,
        /**
         * @enum pc.KEY
         * @name pc.KEY_W
         */
        KEY_W: 87,
        /**
         * @enum pc.KEY
         * @name pc.KEY_X
         */
        KEY_X: 88,
        /**
         * @enum pc.KEY
         * @name pc.KEY_Y
         */
        KEY_Y: 89,
        /**
         * @enum pc.KEY
         * @name pc.KEY_Z
         */
        KEY_Z: 90,

        /**
         * @enum pc.KEY
         * @name pc.KEY_WINDOWS
         */
        KEY_WINDOWS: 91,

        /**
         * @enum pc.KEY
         * @name pc.KEY_CONTEXT_MENU
         */
        KEY_CONTEXT_MENU: 93,

        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_0
         */
        KEY_NUMPAD_0: 96,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_1
         */
        KEY_NUMPAD_1: 97,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_2
         */
        KEY_NUMPAD_2: 98,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_3
         */
        KEY_NUMPAD_3: 99,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_4
         */
        KEY_NUMPAD_4: 100,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_5
         */
        KEY_NUMPAD_5: 101,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_6
         */
        KEY_NUMPAD_6: 102,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_7
         */
        KEY_NUMPAD_7: 103,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_8
         */
        KEY_NUMPAD_8: 104,
        /**
         * @enum pc.KEY
         * @name pc.KEY_NUMPAD_9
         */
        KEY_NUMPAD_9: 105,

        /**
         * @enum pc.KEY
         * @name pc.KEY_MULTIPLY
         */
        KEY_MULTIPLY: 106,
        /**
         * @enum pc.KEY
         * @name pc.KEY_ADD
         */
        KEY_ADD: 107,
        /**
         * @enum pc.KEY
         * @name pc.KEY_SEPARATOR
         */
        KEY_SEPARATOR: 108,
        /**
         * @enum pc.KEY
         * @name pc.KEY_SUBTRACT
         */
        KEY_SUBTRACT: 109,
        /**
         * @enum pc.KEY
         * @name pc.KEY_DECIMAL
         */
        KEY_DECIMAL: 110,
        /**
         * @enum pc.KEY
         * @name pc.KEY_DIVIDE
         */
        KEY_DIVIDE: 111,

        /**
         * @enum pc.KEY
         * @name pc.KEY_F1
         */
        KEY_F1: 112,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F2
         */
        KEY_F2: 113,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F3
         */
        KEY_F3: 114,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F4
         */
        KEY_F4: 115,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F5
         */
        KEY_F5: 116,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F6
         */
        KEY_F6: 117,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F7
         */
        KEY_F7: 118,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F8
         */
        KEY_F8: 119,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F9
         */
        KEY_F9: 120,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F10
         */
        KEY_F10: 121,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F11
         */
        KEY_F11: 122,
        /**
         * @enum pc.KEY
         * @name pc.KEY_F12
         */
        KEY_F12: 123,

        /**
         * @enum pc.KEY
         * @name pc.KEY_COMMA
         */
        KEY_COMMA: 188,
        /**
         * @enum pc.KEY
         * @name pc.KEY_PERIOD
         */
        KEY_PERIOD: 190,
        /**
         * @enum pc.KEY
         * @name pc.KEY_SLASH
         */
        KEY_SLASH: 191,
        /**
         * @enum pc.KEY
         * @name pc.KEY_OPEN_BRACKET
         */
        KEY_OPEN_BRACKET: 219,
        /**
         * @enum pc.KEY
         * @name pc.KEY_BACK_SLASH
         */
        KEY_BACK_SLASH: 220,
        /**
         * @enum pc.KEY
         * @name pc.KEY_CLOSE_BRACKET
         */
        KEY_CLOSE_BRACKET: 221,

        /**
         * @enum pc.KEY
         * @name pc.KEY_META
         */
        KEY_META: 224,

        /**
         * @enum pc.MOUSEBUTTON
         * @name pc.MOUSEBUTTON_NONE
         * @description No mouse buttons pressed
         */
        MOUSEBUTTON_NONE: -1,
        /**
         * @enum pc.MOUSEBUTTON
         * @name pc.MOUSEBUTTON_LEFT
         * @description The left mouse button
         */
        MOUSEBUTTON_LEFT: 0,
        /**
         * @enum pc.MOUSEBUTTON
         * @name pc.MOUSEBUTTON_MIDDLE
         * @description The middle mouse button
         */
        MOUSEBUTTON_MIDDLE: 1,
        /**
         * @enum pc.MOUSEBUTTON
         * @name pc.MOUSEBUTTON_RIGHT
         * @description The right mouse button
         */
        MOUSEBUTTON_RIGHT: 2,

        /**
         * @description Index for pad 1
         */
        PAD_1: 0,
        /**
         * @description Index for pad 2
         */
        PAD_2: 1,
        /**
         * @description Index for pad 3
         */
        PAD_3: 2,
        /**
         * @description Index for pad 4
         */
        PAD_4: 3,

        /**
         * @description The first face button, from bottom going clockwise
         */
        PAD_FACE_1: 0,
        /**
         * @description The second face button, from bottom going clockwise
         */
        PAD_FACE_2: 1,
        /**
         * @description The third face button, from bottom going clockwise
         */
        PAD_FACE_3: 2,
        /**
         * @description The fourth face button, from bottom going clockwise
         */
        PAD_FACE_4: 3,


        /**
         * @description The first shoulder button on the left
         */
        PAD_L_SHOULDER_1: 4,
        /**
         * @description The first shoulder button on the right
         */
        PAD_R_SHOULDER_1: 5,
        /**
         * @description The second shoulder button on the left
         */
        PAD_L_SHOULDER_2: 6,
        /**
         * @description The second shoulder button on the right
         */
        PAD_R_SHOULDER_2: 7,

        /**
         * @description The select button
         */
        PAD_SELECT: 8,
        /**
         * @description The start button
         */
        PAD_START: 9,

        /**
         * @description The button when depressing the left analogue stick
         */
        PAD_L_STICK_BUTTON: 10,
        /**
         * @description The button when depressing the right analogue stick
         */
        PAD_R_STICK_BUTTON: 11,

        /**
         * @description Direction pad up
         */
        PAD_UP: 12,
        /**
         * @description Direction pad down
         */
        PAD_DOWN: 13,
        /**
         * @description Direction pad left
         */
        PAD_LEFT: 14,
        /**
         * @description Direction pad right
         */
        PAD_RIGHT: 15,

        /**
         * @description Vendor specific button
         */
        PAD_VENDOR: 16,

        /**
         * @description Horizontal axis on the left analogue stick
         */
        PAD_L_STICK_X: 0,
        /**
         * @description Vertical axis on the left analogue stick
         */
        PAD_L_STICK_Y: 1,
        /**
         * @description Horizontal axis on the right analogue stick
         */
        PAD_R_STICK_X: 2,
        /**
         * @description Vertical axis on the right analogue stick
         */
        PAD_R_STICK_Y: 3
    };

    Object.assign(pc, enums);

    // For backwards compatibility
    pc.input = {};
    Object.assign(pc.input, enums);
}());
