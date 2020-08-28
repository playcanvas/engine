export var ACTION_MOUSE = 'mouse';
export var ACTION_KEYBOARD = 'keyboard';
export var ACTION_GAMEPAD = 'gamepad';

export var AXIS_MOUSE_X = 'mousex';
export var AXIS_MOUSE_Y = 'mousey';
export var AXIS_PAD_L_X = 'padlx';
export var AXIS_PAD_L_Y = 'padly';
export var AXIS_PAD_R_X = 'padrx';
export var AXIS_PAD_R_Y = 'padry';
export var AXIS_KEY = 'key';

/**
 * @constant
 * @type {string}
 * @name pc.EVENT_KEYDOWN
 * @description Name of event fired when a key is pressed.
 */
export var EVENT_KEYDOWN = 'keydown';
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_KEYUP
 * @description Name of event fired when a key is released.
 */
export var EVENT_KEYUP = 'keyup';

/**
 * @constant
 * @type {string}
 * @name pc.EVENT_MOUSEDOWN
 * @description Name of event fired when a mouse button is pressed.
 */
export var EVENT_MOUSEDOWN = "mousedown";
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_MOUSEMOVE
 * @description Name of event fired when the mouse is moved.
 */
export var EVENT_MOUSEMOVE = "mousemove";
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_MOUSEUP
 * @description Name of event fired when a mouse button is released.
 */
export var EVENT_MOUSEUP = "mouseup";
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_MOUSEWHEEL
 * @description Name of event fired when the mouse wheel is rotated.
 */
export var EVENT_MOUSEWHEEL = "mousewheel";

/**
 * @constant
 * @type {string}
 * @name pc.EVENT_TOUCHSTART
 * @description Name of event fired when a new touch occurs. For example, a finger is placed on the device.
 */
export var EVENT_TOUCHSTART = 'touchstart';
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_TOUCHEND
 * @description Name of event fired when touch ends. For example, a finger is lifted off the device.
 */
export var EVENT_TOUCHEND = 'touchend';
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_TOUCHMOVE
 * @description Name of event fired when a touch moves.
 */
export var EVENT_TOUCHMOVE = 'touchmove';
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_TOUCHCANCEL
 * @description Name of event fired when a touch point is interrupted in some way.
 * The exact reasons for canceling a touch can vary from device to device.
 * For example, a modal alert pops up during the interaction; the touch point leaves the document area,
 * or there are more touch points than the device supports, in which case the earliest touch point is canceled.
 */
export var EVENT_TOUCHCANCEL = 'touchcancel';

/**
 * @constant
 * @type {string}
 * @name pc.EVENT_SELECT
 * @description Name of event fired when a new xr select occurs. For example, primary trigger was pressed.
 */
export var EVENT_SELECT = 'select';
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_SELECTSTART
 * @description Name of event fired when a new xr select starts. For example, primary trigger is now pressed.
 */
export var EVENT_SELECTSTART = 'selectstart';
/**
 * @constant
 * @type {string}
 * @name pc.EVENT_SELECTEND
 * @description Name of event fired when xr select ends. For example, a primary trigger is now released.
 */
export var EVENT_SELECTEND = 'selectend';

/**
 * @constant
 * @type {number}
 * @name pc.KEY_BACKSPACE
 */
export var KEY_BACKSPACE = 8;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_TAB
 */
export var KEY_TAB = 9;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_RETURN
 */
export var KEY_RETURN = 13;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_ENTER
 */
export var KEY_ENTER = 13;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_SHIFT
 */
export var KEY_SHIFT = 16;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_CONTROL
 */
export var KEY_CONTROL = 17;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_ALT
 */
export var KEY_ALT = 18;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_PAUSE
 */
export var KEY_PAUSE = 19;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_CAPS_LOCK
 */
export var KEY_CAPS_LOCK = 20;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_ESCAPE
 */
export var KEY_ESCAPE = 27;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_SPACE
 */
export var KEY_SPACE = 32;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_PAGE_UP
 */
export var KEY_PAGE_UP = 33;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_PAGE_DOWN
 */
export var KEY_PAGE_DOWN = 34;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_END
 */
export var KEY_END = 35;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_HOME
 */
export var KEY_HOME = 36;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_LEFT
 */
export var KEY_LEFT = 37;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_UP
 */
export var KEY_UP = 38;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_RIGHT
 */
export var KEY_RIGHT = 39;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_DOWN
 */
export var KEY_DOWN = 40;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_PRINT_SCREEN
 */
export var KEY_PRINT_SCREEN = 44;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_INSERT
 */
export var KEY_INSERT = 45;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_DELETE
 */
export var KEY_DELETE = 46;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_0
 */
export var KEY_0 = 48;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_1
 */
export var KEY_1 = 49;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_2
 */
export var KEY_2 = 50;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_3
 */
export var KEY_3 = 51;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_4
 */
export var KEY_4 = 52;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_5
 */
export var KEY_5 = 53;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_6
 */
export var KEY_6 = 54;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_7
 */
export var KEY_7 = 55;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_8
 */
export var KEY_8 = 56;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_9
 */
export var KEY_9 = 57;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_SEMICOLON
 */
export var KEY_SEMICOLON = 59;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_EQUAL
 */
export var KEY_EQUAL = 61;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_A
 */
export var KEY_A = 65;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_B
 */
export var KEY_B = 66;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_C
 */
export var KEY_C = 67;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_D
 */
export var KEY_D = 68;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_E
 */
export var KEY_E = 69;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F
 */
export var KEY_F = 70;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_G
 */
export var KEY_G = 71;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_H
 */
export var KEY_H = 72;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_I
 */
export var KEY_I = 73;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_J
 */
export var KEY_J = 74;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_K
 */
export var KEY_K = 75;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_L
 */
export var KEY_L = 76;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_M
 */
export var KEY_M = 77;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_N
 */
export var KEY_N = 78;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_O
 */
export var KEY_O = 79;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_P
 */
export var KEY_P = 80;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_Q
 */
export var KEY_Q = 81;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_R
 */
export var KEY_R = 82;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_S
 */
export var KEY_S = 83;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_T
 */
export var KEY_T = 84;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_U
 */
export var KEY_U = 85;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_V
 */
export var KEY_V = 86;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_W
 */
export var KEY_W = 87;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_X
 */
export var KEY_X = 88;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_Y
 */
export var KEY_Y = 89;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_Z
 */
export var KEY_Z = 90;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_WINDOWS
 */
export var KEY_WINDOWS = 91;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_CONTEXT_MENU
 */
export var KEY_CONTEXT_MENU = 93;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_0
 */
export var KEY_NUMPAD_0 = 96;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_1
 */
export var KEY_NUMPAD_1 = 97;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_2
 */
export var KEY_NUMPAD_2 = 98;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_3
 */
export var KEY_NUMPAD_3 = 99;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_4
 */
export var KEY_NUMPAD_4 = 100;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_5
 */
export var KEY_NUMPAD_5 = 101;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_6
 */
export var KEY_NUMPAD_6 = 102;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_7
 */
export var KEY_NUMPAD_7 = 103;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_8
 */
export var KEY_NUMPAD_8 = 104;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_NUMPAD_9
 */
export var KEY_NUMPAD_9 = 105;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_MULTIPLY
 */
export var KEY_MULTIPLY = 106;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_ADD
 */
export var KEY_ADD = 107;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_SEPARATOR
 */
export var KEY_SEPARATOR = 108;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_SUBTRACT
 */
export var KEY_SUBTRACT = 109;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_DECIMAL
 */
export var KEY_DECIMAL = 110;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_DIVIDE
 */
export var KEY_DIVIDE = 111;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_F1
 */
export var KEY_F1 = 112;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F2
 */
export var KEY_F2 = 113;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F3
 */
export var KEY_F3 = 114;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F4
 */
export var KEY_F4 = 115;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F5
 */
export var KEY_F5 = 116;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F6
 */
export var KEY_F6 = 117;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F7
 */
export var KEY_F7 = 118;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F8
 */
export var KEY_F8 = 119;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F9
 */
export var KEY_F9 = 120;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F10
 */
export var KEY_F10 = 121;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F11
 */
export var KEY_F11 = 122;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_F12
 */
export var KEY_F12 = 123;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_COMMA
 */
export var KEY_COMMA = 188;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_PERIOD
 */
export var KEY_PERIOD = 190;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_SLASH
 */
export var KEY_SLASH = 191;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_OPEN_BRACKET
 */
export var KEY_OPEN_BRACKET = 219;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_BACK_SLASH
 */
export var KEY_BACK_SLASH = 220;
/**
 * @constant
 * @type {number}
 * @name pc.KEY_CLOSE_BRACKET
 */
export var KEY_CLOSE_BRACKET = 221;

/**
 * @constant
 * @type {number}
 * @name pc.KEY_META
 */
export var KEY_META = 224;

/**
 * @constant
 * @type {number}
 * @name pc.MOUSEBUTTON_NONE
 * @description No mouse buttons pressed.
 */
export var MOUSEBUTTON_NONE = -1;
/**
 * @constant
 * @type {number}
 * @name pc.MOUSEBUTTON_LEFT
 * @description The left mouse button.
 */
export var MOUSEBUTTON_LEFT = 0;
/**
 * @constant
 * @type {number}
 * @name pc.MOUSEBUTTON_MIDDLE
 * @description The middle mouse button.
 */
export var MOUSEBUTTON_MIDDLE = 1;
/**
 * @constant
 * @type {number}
 * @name pc.MOUSEBUTTON_RIGHT
 * @description The right mouse button.
 */
export var MOUSEBUTTON_RIGHT = 2;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_1
 * @description Index for pad 1.
 */
export var PAD_1 = 0;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_2
 * @description Index for pad 2.
 */
export var PAD_2 = 1;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_3
 * @description Index for pad 3.
 */
export var PAD_3 = 2;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_4
 * @description Index for pad 4.
 */
export var PAD_4 = 3;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_FACE_1
 * @description The first face button, from bottom going clockwise.
 */
export var PAD_FACE_1 = 0;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_FACE_2
 * @description The second face button, from bottom going clockwise.
 */
export var PAD_FACE_2 = 1;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_FACE_3
 * @description The third face button, from bottom going clockwise.
 */
export var PAD_FACE_3 = 2;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_FACE_4
 * @description The fourth face button, from bottom going clockwise.
 */
export var PAD_FACE_4 = 3;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_L_SHOULDER_1
 * @description The first shoulder button on the left.
 */
export var PAD_L_SHOULDER_1 = 4;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_R_SHOULDER_1
 * @description The first shoulder button on the right.
 */
export var PAD_R_SHOULDER_1 = 5;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_L_SHOULDER_2
 * @description The second shoulder button on the left.
 */
export var PAD_L_SHOULDER_2 = 6;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_R_SHOULDER_2
 * @description The second shoulder button on the right.
 */
export var PAD_R_SHOULDER_2 = 7;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_SELECT
 * @description The select button.
 */
export var PAD_SELECT = 8;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_START
 * @description The start button.
 */
export var PAD_START = 9;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_L_STICK_BUTTON
 * @description The button when depressing the left analogue stick.
 */
export var PAD_L_STICK_BUTTON = 10;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_R_STICK_BUTTON
 * @description The button when depressing the right analogue stick.
 */
export var PAD_R_STICK_BUTTON = 11;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_UP
 * @description Direction pad up.
 */
export var PAD_UP = 12;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_DOWN
 * @description Direction pad down.
 */
export var PAD_DOWN = 13;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_LEFT
 * @description Direction pad left.
 */
export var PAD_LEFT = 14;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_RIGHT
 * @description Direction pad right.
 */
export var PAD_RIGHT = 15;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_VENDOR
 * @description Vendor specific button.
 */
export var PAD_VENDOR = 16;

/**
 * @constant
 * @type {number}
 * @name pc.PAD_L_STICK_X
 * @description Horizontal axis on the left analogue stick.
 */
export var PAD_L_STICK_X = 0;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_L_STICK_Y
 * @description Vertical axis on the left analogue stick.
 */
export var PAD_L_STICK_Y = 1;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_R_STICK_X
 * @description Horizontal axis on the right analogue stick.
 */
export var PAD_R_STICK_X = 2;
/**
 * @constant
 * @type {number}
 * @name pc.PAD_R_STICK_Y
 * @description Vertical axis on the right analogue stick.
 */
export var PAD_R_STICK_Y = 3;
