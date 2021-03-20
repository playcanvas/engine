export const ACTION_MOUSE = 'mouse';
export const ACTION_KEYBOARD = 'keyboard';
export const ACTION_GAMEPAD = 'gamepad';

export const AXIS_MOUSE_X = 'mousex';
export const AXIS_MOUSE_Y = 'mousey';
export const AXIS_PAD_L_X = 'padlx';
export const AXIS_PAD_L_Y = 'padly';
export const AXIS_PAD_R_X = 'padrx';
export const AXIS_PAD_R_Y = 'padry';
export const AXIS_KEY = 'key';

/**
 * @constant
 * @type {string}
 * @name EVENT_KEYDOWN
 * @description Name of event fired when a key is pressed.
 */
export const EVENT_KEYDOWN = 'keydown';
/**
 * @constant
 * @type {string}
 * @name EVENT_KEYUP
 * @description Name of event fired when a key is released.
 */
export const EVENT_KEYUP = 'keyup';

/**
 * @constant
 * @type {string}
 * @name EVENT_MOUSEDOWN
 * @description Name of event fired when a mouse button is pressed.
 */
export const EVENT_MOUSEDOWN = "mousedown";
/**
 * @constant
 * @type {string}
 * @name EVENT_MOUSEMOVE
 * @description Name of event fired when the mouse is moved.
 */
export const EVENT_MOUSEMOVE = "mousemove";
/**
 * @constant
 * @type {string}
 * @name EVENT_MOUSEUP
 * @description Name of event fired when a mouse button is released.
 */
export const EVENT_MOUSEUP = "mouseup";
/**
 * @constant
 * @type {string}
 * @name EVENT_MOUSEWHEEL
 * @description Name of event fired when the mouse wheel is rotated.
 */
export const EVENT_MOUSEWHEEL = "mousewheel";

/**
 * @constant
 * @type {string}
 * @name EVENT_TOUCHSTART
 * @description Name of event fired when a new touch occurs. For example, a finger is placed on the device.
 */
export const EVENT_TOUCHSTART = 'touchstart';
/**
 * @constant
 * @type {string}
 * @name EVENT_TOUCHEND
 * @description Name of event fired when touch ends. For example, a finger is lifted off the device.
 */
export const EVENT_TOUCHEND = 'touchend';
/**
 * @constant
 * @type {string}
 * @name EVENT_TOUCHMOVE
 * @description Name of event fired when a touch moves.
 */
export const EVENT_TOUCHMOVE = 'touchmove';
/**
 * @constant
 * @type {string}
 * @name EVENT_TOUCHCANCEL
 * @description Name of event fired when a touch point is interrupted in some way.
 * The exact reasons for canceling a touch can vary from device to device.
 * For example, a modal alert pops up during the interaction; the touch point leaves the document area,
 * or there are more touch points than the device supports, in which case the earliest touch point is canceled.
 */
export const EVENT_TOUCHCANCEL = 'touchcancel';

/**
 * @constant
 * @type {string}
 * @name EVENT_SELECT
 * @description Name of event fired when a new xr select occurs. For example, primary trigger was pressed.
 */
export const EVENT_SELECT = 'select';
/**
 * @constant
 * @type {string}
 * @name EVENT_SELECTSTART
 * @description Name of event fired when a new xr select starts. For example, primary trigger is now pressed.
 */
export const EVENT_SELECTSTART = 'selectstart';
/**
 * @constant
 * @type {string}
 * @name EVENT_SELECTEND
 * @description Name of event fired when xr select ends. For example, a primary trigger is now released.
 */
export const EVENT_SELECTEND = 'selectend';

/**
 * @constant
 * @type {number}
 * @name KEY_BACKSPACE
 */
export const KEY_BACKSPACE = 8;
/**
 * @constant
 * @type {number}
 * @name KEY_TAB
 */
export const KEY_TAB = 9;
/**
 * @constant
 * @type {number}
 * @name KEY_RETURN
 */
export const KEY_RETURN = 13;
/**
 * @constant
 * @type {number}
 * @name KEY_ENTER
 */
export const KEY_ENTER = 13;
/**
 * @constant
 * @type {number}
 * @name KEY_SHIFT
 */
export const KEY_SHIFT = 16;
/**
 * @constant
 * @type {number}
 * @name KEY_CONTROL
 */
export const KEY_CONTROL = 17;
/**
 * @constant
 * @type {number}
 * @name KEY_ALT
 */
export const KEY_ALT = 18;
/**
 * @constant
 * @type {number}
 * @name KEY_PAUSE
 */
export const KEY_PAUSE = 19;
/**
 * @constant
 * @type {number}
 * @name KEY_CAPS_LOCK
 */
export const KEY_CAPS_LOCK = 20;
/**
 * @constant
 * @type {number}
 * @name KEY_ESCAPE
 */
export const KEY_ESCAPE = 27;
/**
 * @constant
 * @type {number}
 * @name KEY_SPACE
 */
export const KEY_SPACE = 32;
/**
 * @constant
 * @type {number}
 * @name KEY_PAGE_UP
 */
export const KEY_PAGE_UP = 33;
/**
 * @constant
 * @type {number}
 * @name KEY_PAGE_DOWN
 */
export const KEY_PAGE_DOWN = 34;
/**
 * @constant
 * @type {number}
 * @name KEY_END
 */
export const KEY_END = 35;
/**
 * @constant
 * @type {number}
 * @name KEY_HOME
 */
export const KEY_HOME = 36;
/**
 * @constant
 * @type {number}
 * @name KEY_LEFT
 */
export const KEY_LEFT = 37;
/**
 * @constant
 * @type {number}
 * @name KEY_UP
 */
export const KEY_UP = 38;
/**
 * @constant
 * @type {number}
 * @name KEY_RIGHT
 */
export const KEY_RIGHT = 39;
/**
 * @constant
 * @type {number}
 * @name KEY_DOWN
 */
export const KEY_DOWN = 40;
/**
 * @constant
 * @type {number}
 * @name KEY_PRINT_SCREEN
 */
export const KEY_PRINT_SCREEN = 44;
/**
 * @constant
 * @type {number}
 * @name KEY_INSERT
 */
export const KEY_INSERT = 45;
/**
 * @constant
 * @type {number}
 * @name KEY_DELETE
 */
export const KEY_DELETE = 46;
/**
 * @constant
 * @type {number}
 * @name KEY_0
 */
export const KEY_0 = 48;
/**
 * @constant
 * @type {number}
 * @name KEY_1
 */
export const KEY_1 = 49;
/**
 * @constant
 * @type {number}
 * @name KEY_2
 */
export const KEY_2 = 50;
/**
 * @constant
 * @type {number}
 * @name KEY_3
 */
export const KEY_3 = 51;
/**
 * @constant
 * @type {number}
 * @name KEY_4
 */
export const KEY_4 = 52;
/**
 * @constant
 * @type {number}
 * @name KEY_5
 */
export const KEY_5 = 53;
/**
 * @constant
 * @type {number}
 * @name KEY_6
 */
export const KEY_6 = 54;
/**
 * @constant
 * @type {number}
 * @name KEY_7
 */
export const KEY_7 = 55;
/**
 * @constant
 * @type {number}
 * @name KEY_8
 */
export const KEY_8 = 56;
/**
 * @constant
 * @type {number}
 * @name KEY_9
 */
export const KEY_9 = 57;

/**
 * @constant
 * @type {number}
 * @name KEY_SEMICOLON
 */
export const KEY_SEMICOLON = 59;
/**
 * @constant
 * @type {number}
 * @name KEY_EQUAL
 */
export const KEY_EQUAL = 61;

/**
 * @constant
 * @type {number}
 * @name KEY_A
 */
export const KEY_A = 65;
/**
 * @constant
 * @type {number}
 * @name KEY_B
 */
export const KEY_B = 66;
/**
 * @constant
 * @type {number}
 * @name KEY_C
 */
export const KEY_C = 67;
/**
 * @constant
 * @type {number}
 * @name KEY_D
 */
export const KEY_D = 68;
/**
 * @constant
 * @type {number}
 * @name KEY_E
 */
export const KEY_E = 69;
/**
 * @constant
 * @type {number}
 * @name KEY_F
 */
export const KEY_F = 70;
/**
 * @constant
 * @type {number}
 * @name KEY_G
 */
export const KEY_G = 71;
/**
 * @constant
 * @type {number}
 * @name KEY_H
 */
export const KEY_H = 72;
/**
 * @constant
 * @type {number}
 * @name KEY_I
 */
export const KEY_I = 73;
/**
 * @constant
 * @type {number}
 * @name KEY_J
 */
export const KEY_J = 74;
/**
 * @constant
 * @type {number}
 * @name KEY_K
 */
export const KEY_K = 75;
/**
 * @constant
 * @type {number}
 * @name KEY_L
 */
export const KEY_L = 76;
/**
 * @constant
 * @type {number}
 * @name KEY_M
 */
export const KEY_M = 77;
/**
 * @constant
 * @type {number}
 * @name KEY_N
 */
export const KEY_N = 78;
/**
 * @constant
 * @type {number}
 * @name KEY_O
 */
export const KEY_O = 79;
/**
 * @constant
 * @type {number}
 * @name KEY_P
 */
export const KEY_P = 80;
/**
 * @constant
 * @type {number}
 * @name KEY_Q
 */
export const KEY_Q = 81;
/**
 * @constant
 * @type {number}
 * @name KEY_R
 */
export const KEY_R = 82;
/**
 * @constant
 * @type {number}
 * @name KEY_S
 */
export const KEY_S = 83;
/**
 * @constant
 * @type {number}
 * @name KEY_T
 */
export const KEY_T = 84;
/**
 * @constant
 * @type {number}
 * @name KEY_U
 */
export const KEY_U = 85;
/**
 * @constant
 * @type {number}
 * @name KEY_V
 */
export const KEY_V = 86;
/**
 * @constant
 * @type {number}
 * @name KEY_W
 */
export const KEY_W = 87;
/**
 * @constant
 * @type {number}
 * @name KEY_X
 */
export const KEY_X = 88;
/**
 * @constant
 * @type {number}
 * @name KEY_Y
 */
export const KEY_Y = 89;
/**
 * @constant
 * @type {number}
 * @name KEY_Z
 */
export const KEY_Z = 90;

/**
 * @constant
 * @type {number}
 * @name KEY_WINDOWS
 */
export const KEY_WINDOWS = 91;

/**
 * @constant
 * @type {number}
 * @name KEY_CONTEXT_MENU
 */
export const KEY_CONTEXT_MENU = 93;

/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_0
 */
export const KEY_NUMPAD_0 = 96;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_1
 */
export const KEY_NUMPAD_1 = 97;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_2
 */
export const KEY_NUMPAD_2 = 98;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_3
 */
export const KEY_NUMPAD_3 = 99;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_4
 */
export const KEY_NUMPAD_4 = 100;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_5
 */
export const KEY_NUMPAD_5 = 101;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_6
 */
export const KEY_NUMPAD_6 = 102;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_7
 */
export const KEY_NUMPAD_7 = 103;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_8
 */
export const KEY_NUMPAD_8 = 104;
/**
 * @constant
 * @type {number}
 * @name KEY_NUMPAD_9
 */
export const KEY_NUMPAD_9 = 105;

/**
 * @constant
 * @type {number}
 * @name KEY_MULTIPLY
 */
export const KEY_MULTIPLY = 106;
/**
 * @constant
 * @type {number}
 * @name KEY_ADD
 */
export const KEY_ADD = 107;
/**
 * @constant
 * @type {number}
 * @name KEY_SEPARATOR
 */
export const KEY_SEPARATOR = 108;
/**
 * @constant
 * @type {number}
 * @name KEY_SUBTRACT
 */
export const KEY_SUBTRACT = 109;
/**
 * @constant
 * @type {number}
 * @name KEY_DECIMAL
 */
export const KEY_DECIMAL = 110;
/**
 * @constant
 * @type {number}
 * @name KEY_DIVIDE
 */
export const KEY_DIVIDE = 111;

/**
 * @constant
 * @type {number}
 * @name KEY_F1
 */
export const KEY_F1 = 112;
/**
 * @constant
 * @type {number}
 * @name KEY_F2
 */
export const KEY_F2 = 113;
/**
 * @constant
 * @type {number}
 * @name KEY_F3
 */
export const KEY_F3 = 114;
/**
 * @constant
 * @type {number}
 * @name KEY_F4
 */
export const KEY_F4 = 115;
/**
 * @constant
 * @type {number}
 * @name KEY_F5
 */
export const KEY_F5 = 116;
/**
 * @constant
 * @type {number}
 * @name KEY_F6
 */
export const KEY_F6 = 117;
/**
 * @constant
 * @type {number}
 * @name KEY_F7
 */
export const KEY_F7 = 118;
/**
 * @constant
 * @type {number}
 * @name KEY_F8
 */
export const KEY_F8 = 119;
/**
 * @constant
 * @type {number}
 * @name KEY_F9
 */
export const KEY_F9 = 120;
/**
 * @constant
 * @type {number}
 * @name KEY_F10
 */
export const KEY_F10 = 121;
/**
 * @constant
 * @type {number}
 * @name KEY_F11
 */
export const KEY_F11 = 122;
/**
 * @constant
 * @type {number}
 * @name KEY_F12
 */
export const KEY_F12 = 123;

/**
 * @constant
 * @type {number}
 * @name KEY_COMMA
 */
export const KEY_COMMA = 188;
/**
 * @constant
 * @type {number}
 * @name KEY_PERIOD
 */
export const KEY_PERIOD = 190;
/**
 * @constant
 * @type {number}
 * @name KEY_SLASH
 */
export const KEY_SLASH = 191;
/**
 * @constant
 * @type {number}
 * @name KEY_OPEN_BRACKET
 */
export const KEY_OPEN_BRACKET = 219;
/**
 * @constant
 * @type {number}
 * @name KEY_BACK_SLASH
 */
export const KEY_BACK_SLASH = 220;
/**
 * @constant
 * @type {number}
 * @name KEY_CLOSE_BRACKET
 */
export const KEY_CLOSE_BRACKET = 221;

/**
 * @constant
 * @type {number}
 * @name KEY_META
 */
export const KEY_META = 224;

/**
 * @constant
 * @type {number}
 * @name MOUSEBUTTON_NONE
 * @description No mouse buttons pressed.
 */
export const MOUSEBUTTON_NONE = -1;
/**
 * @constant
 * @type {number}
 * @name MOUSEBUTTON_LEFT
 * @description The left mouse button.
 */
export const MOUSEBUTTON_LEFT = 0;
/**
 * @constant
 * @type {number}
 * @name MOUSEBUTTON_MIDDLE
 * @description The middle mouse button.
 */
export const MOUSEBUTTON_MIDDLE = 1;
/**
 * @constant
 * @type {number}
 * @name MOUSEBUTTON_RIGHT
 * @description The right mouse button.
 */
export const MOUSEBUTTON_RIGHT = 2;

/**
 * @constant
 * @type {number}
 * @name PAD_1
 * @description Index for pad 1.
 */
export const PAD_1 = 0;
/**
 * @constant
 * @type {number}
 * @name PAD_2
 * @description Index for pad 2.
 */
export const PAD_2 = 1;
/**
 * @constant
 * @type {number}
 * @name PAD_3
 * @description Index for pad 3.
 */
export const PAD_3 = 2;
/**
 * @constant
 * @type {number}
 * @name PAD_4
 * @description Index for pad 4.
 */
export const PAD_4 = 3;

/**
 * @constant
 * @type {number}
 * @name PAD_FACE_1
 * @description The first face button, from bottom going clockwise.
 */
export const PAD_FACE_1 = 0;
/**
 * @constant
 * @type {number}
 * @name PAD_FACE_2
 * @description The second face button, from bottom going clockwise.
 */
export const PAD_FACE_2 = 1;
/**
 * @constant
 * @type {number}
 * @name PAD_FACE_3
 * @description The third face button, from bottom going clockwise.
 */
export const PAD_FACE_3 = 2;
/**
 * @constant
 * @type {number}
 * @name PAD_FACE_4
 * @description The fourth face button, from bottom going clockwise.
 */
export const PAD_FACE_4 = 3;

/**
 * @constant
 * @type {number}
 * @name PAD_L_SHOULDER_1
 * @description The first shoulder button on the left.
 */
export const PAD_L_SHOULDER_1 = 4;
/**
 * @constant
 * @type {number}
 * @name PAD_R_SHOULDER_1
 * @description The first shoulder button on the right.
 */
export const PAD_R_SHOULDER_1 = 5;
/**
 * @constant
 * @type {number}
 * @name PAD_L_SHOULDER_2
 * @description The second shoulder button on the left.
 */
export const PAD_L_SHOULDER_2 = 6;
/**
 * @constant
 * @type {number}
 * @name PAD_R_SHOULDER_2
 * @description The second shoulder button on the right.
 */
export const PAD_R_SHOULDER_2 = 7;

/**
 * @constant
 * @type {number}
 * @name PAD_SELECT
 * @description The select button.
 */
export const PAD_SELECT = 8;
/**
 * @constant
 * @type {number}
 * @name PAD_START
 * @description The start button.
 */
export const PAD_START = 9;

/**
 * @constant
 * @type {number}
 * @name PAD_L_STICK_BUTTON
 * @description The button when depressing the left analogue stick.
 */
export const PAD_L_STICK_BUTTON = 10;
/**
 * @constant
 * @type {number}
 * @name PAD_R_STICK_BUTTON
 * @description The button when depressing the right analogue stick.
 */
export const PAD_R_STICK_BUTTON = 11;

/**
 * @constant
 * @type {number}
 * @name PAD_UP
 * @description Direction pad up.
 */
export const PAD_UP = 12;
/**
 * @constant
 * @type {number}
 * @name PAD_DOWN
 * @description Direction pad down.
 */
export const PAD_DOWN = 13;
/**
 * @constant
 * @type {number}
 * @name PAD_LEFT
 * @description Direction pad left.
 */
export const PAD_LEFT = 14;
/**
 * @constant
 * @type {number}
 * @name PAD_RIGHT
 * @description Direction pad right.
 */
export const PAD_RIGHT = 15;

/**
 * @constant
 * @type {number}
 * @name PAD_VENDOR
 * @description Vendor specific button.
 */
export const PAD_VENDOR = 16;

/**
 * @constant
 * @type {number}
 * @name PAD_L_STICK_X
 * @description Horizontal axis on the left analogue stick.
 */
export const PAD_L_STICK_X = 0;
/**
 * @constant
 * @type {number}
 * @name PAD_L_STICK_Y
 * @description Vertical axis on the left analogue stick.
 */
export const PAD_L_STICK_Y = 1;
/**
 * @constant
 * @type {number}
 * @name PAD_R_STICK_X
 * @description Horizontal axis on the right analogue stick.
 */
export const PAD_R_STICK_X = 2;
/**
 * @constant
 * @type {number}
 * @name PAD_R_STICK_Y
 * @description Vertical axis on the right analogue stick.
 */
export const PAD_R_STICK_Y = 3;
