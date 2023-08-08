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
 * Name of event fired when a key is pressed.
 *
 * @type {string}
 */
export const EVENT_KEYDOWN = 'keydown';

/**
 * Name of event fired when a key is released.
 *
 * @type {string}
 */
export const EVENT_KEYUP = 'keyup';

/**
 * Name of event fired when a mouse button is pressed.
 *
 * @type {string}
 */
export const EVENT_MOUSEDOWN = 'mousedown';

/**
 * Name of event fired when the mouse is moved.
 *
 * @type {string}
 */
export const EVENT_MOUSEMOVE = 'mousemove';

/**
 * Name of event fired when a mouse button is released.
 *
 * @type {string}
 */
export const EVENT_MOUSEUP = 'mouseup';

/**
 * Name of event fired when the mouse wheel is rotated.
 *
 * @type {string}
 */
export const EVENT_MOUSEWHEEL = 'mousewheel';

/**
 * Name of event fired when a new touch occurs. For example, a finger is placed on the device.
 *
 * @type {string}
 */
export const EVENT_TOUCHSTART = 'touchstart';

/**
 * Name of event fired when touch ends. For example, a finger is lifted off the device.
 *
 * @type {string}
 */
export const EVENT_TOUCHEND = 'touchend';

/**
 * Name of event fired when a touch moves.
 *
 * @type {string}
 */
export const EVENT_TOUCHMOVE = 'touchmove';

/**
 * Name of event fired when a touch point is interrupted in some way. The exact reasons for
 * canceling a touch can vary from device to device. For example, a modal alert pops up during the
 * interaction; the touch point leaves the document area, or there are more touch points than the
 * device supports, in which case the earliest touch point is canceled.
 *
 * @type {string}
 */
export const EVENT_TOUCHCANCEL = 'touchcancel';

/**
 * Name of event fired when a new xr select occurs. For example, primary trigger was pressed.
 *
 * @type {string}
 */
export const EVENT_SELECT = 'select';

/**
 * Name of event fired when a new xr select starts. For example, primary trigger is now pressed.
 *
 * @type {string}
 */
export const EVENT_SELECTSTART = 'selectstart';

/**
 * Name of event fired when xr select ends. For example, a primary trigger is now released.
 *
 * @type {string}
 */
export const EVENT_SELECTEND = 'selectend';

/**
 * @type {number}
 */
export const KEY_BACKSPACE = 8;

/**
 * @type {number}
 */
export const KEY_TAB = 9;

/**
 * @type {number}
 */
export const KEY_RETURN = 13;

/**
 * @type {number}
 */
export const KEY_ENTER = 13;

/**
 * @type {number}
 */
export const KEY_SHIFT = 16;

/**
 * @type {number}
 */
export const KEY_CONTROL = 17;

/**
 * @type {number}
 */
export const KEY_ALT = 18;

/**
 * @type {number}
 */
export const KEY_PAUSE = 19;

/**
 * @type {number}
 */
export const KEY_CAPS_LOCK = 20;

/**
 * @type {number}
 */
export const KEY_ESCAPE = 27;

/**
 * @type {number}
 */
export const KEY_SPACE = 32;

/**
 * @type {number}
 */
export const KEY_PAGE_UP = 33;

/**
 * @type {number}
 */
export const KEY_PAGE_DOWN = 34;

/**
 * @type {number}
 */
export const KEY_END = 35;

/**
 * @type {number}
 */
export const KEY_HOME = 36;

/**
 * @type {number}
 */
export const KEY_LEFT = 37;

/**
 * @type {number}
 */
export const KEY_UP = 38;

/**
 * @type {number}
 */
export const KEY_RIGHT = 39;

/**
 * @type {number}
 */
export const KEY_DOWN = 40;

/**
 * @type {number}
 */
export const KEY_PRINT_SCREEN = 44;

/**
 * @type {number}
 */
export const KEY_INSERT = 45;

/**
 * @type {number}
 */
export const KEY_DELETE = 46;

/**
 * @type {number}
 */
export const KEY_0 = 48;

/**
 * @type {number}
 */
export const KEY_1 = 49;

/**
 * @type {number}
 */
export const KEY_2 = 50;

/**
 * @type {number}
 */
export const KEY_3 = 51;

/**
 * @type {number}
 */
export const KEY_4 = 52;

/**
 * @type {number}
 */
export const KEY_5 = 53;

/**
 * @type {number}
 */
export const KEY_6 = 54;

/**
 * @type {number}
 */
export const KEY_7 = 55;

/**
 * @type {number}
 */
export const KEY_8 = 56;

/**
 * @type {number}
 */
export const KEY_9 = 57;

/**
 * @type {number}
 */
export const KEY_SEMICOLON = 59;

/**
 * @type {number}
 */
export const KEY_EQUAL = 61;

/**
 * @type {number}
 */
export const KEY_A = 65;

/**
 * @type {number}
 */
export const KEY_B = 66;

/**
 * @type {number}
 */
export const KEY_C = 67;

/**
 * @type {number}
 */
export const KEY_D = 68;

/**
 * @type {number}
 */
export const KEY_E = 69;

/**
 * @type {number}
 */
export const KEY_F = 70;

/**
 * @type {number}
 */
export const KEY_G = 71;

/**
 * @type {number}
 */
export const KEY_H = 72;

/**
 * @type {number}
 */
export const KEY_I = 73;

/**
 * @type {number}
 */
export const KEY_J = 74;

/**
 * @type {number}
 */
export const KEY_K = 75;

/**
 * @type {number}
 */
export const KEY_L = 76;

/**
 * @type {number}
 */
export const KEY_M = 77;

/**
 * @type {number}
 */
export const KEY_N = 78;

/**
 * @type {number}
 */
export const KEY_O = 79;

/**
 * @type {number}
 */
export const KEY_P = 80;

/**
 * @type {number}
 */
export const KEY_Q = 81;

/**
 * @type {number}
 */
export const KEY_R = 82;

/**
 * @type {number}
 */
export const KEY_S = 83;

/**
 * @type {number}
 */
export const KEY_T = 84;

/**
 * @type {number}
 */
export const KEY_U = 85;

/**
 * @type {number}
 */
export const KEY_V = 86;

/**
 * @type {number}
 */
export const KEY_W = 87;

/**
 * @type {number}
 */
export const KEY_X = 88;

/**
 * @type {number}
 */
export const KEY_Y = 89;

/**
 * @type {number}
 */
export const KEY_Z = 90;

/**
 * @type {number}
 */
export const KEY_WINDOWS = 91;

/**
 * @type {number}
 */
export const KEY_CONTEXT_MENU = 93;

/**
 * @type {number}
 */
export const KEY_NUMPAD_0 = 96;

/**
 * @type {number}
 */
export const KEY_NUMPAD_1 = 97;

/**
 * @type {number}
 */
export const KEY_NUMPAD_2 = 98;

/**
 * @type {number}
 */
export const KEY_NUMPAD_3 = 99;

/**
 * @type {number}
 */
export const KEY_NUMPAD_4 = 100;

/**
 * @type {number}
 */
export const KEY_NUMPAD_5 = 101;

/**
 * @type {number}
 */
export const KEY_NUMPAD_6 = 102;

/**
 * @type {number}
 */
export const KEY_NUMPAD_7 = 103;

/**
 * @type {number}
 */
export const KEY_NUMPAD_8 = 104;

/**
 * @type {number}
 */
export const KEY_NUMPAD_9 = 105;

/**
 * @type {number}
 */
export const KEY_MULTIPLY = 106;

/**
 * @type {number}
 */
export const KEY_ADD = 107;

/**
 * @type {number}
 */
export const KEY_SEPARATOR = 108;

/**
 * @type {number}
 */
export const KEY_SUBTRACT = 109;

/**
 * @type {number}
 */
export const KEY_DECIMAL = 110;

/**
 * @type {number}
 */
export const KEY_DIVIDE = 111;

/**
 * @type {number}
 */
export const KEY_F1 = 112;

/**
 * @type {number}
 */
export const KEY_F2 = 113;

/**
 * @type {number}
 */
export const KEY_F3 = 114;

/**
 * @type {number}
 */
export const KEY_F4 = 115;

/**
 * @type {number}
 */
export const KEY_F5 = 116;

/**
 * @type {number}
 */
export const KEY_F6 = 117;

/**
 * @type {number}
 */
export const KEY_F7 = 118;

/**
 * @type {number}
 */
export const KEY_F8 = 119;

/**
 * @type {number}
 */
export const KEY_F9 = 120;

/**
 * @type {number}
 */
export const KEY_F10 = 121;

/**
 * @type {number}
 */
export const KEY_F11 = 122;

/**
 * @type {number}
 */
export const KEY_F12 = 123;

/**
 * @type {number}
 */
export const KEY_COMMA = 188;

/**
 * @type {number}
 */
export const KEY_PERIOD = 190;

/**
 * @type {number}
 */
export const KEY_SLASH = 191;

/**
 * @type {number}
 */
export const KEY_OPEN_BRACKET = 219;

/**
 * @type {number}
 */
export const KEY_BACK_SLASH = 220;

/**
 * @type {number}
 */
export const KEY_CLOSE_BRACKET = 221;

/**
 * @type {number}
 */
export const KEY_META = 224;

/**
 * No mouse buttons pressed.
 *
 * @type {number}
 */
export const MOUSEBUTTON_NONE = -1;

/**
 * The left mouse button.
 *
 * @type {number}
 */
export const MOUSEBUTTON_LEFT = 0;

/**
 * The middle mouse button.
 *
 * @type {number}
 */
export const MOUSEBUTTON_MIDDLE = 1;

/**
 * The right mouse button.
 *
 * @type {number}
 */
export const MOUSEBUTTON_RIGHT = 2;

/**
 * Index for pad 1.
 *
 * @type {number}
 */
export const PAD_1 = 0;

/**
 * Index for pad 2.
 *
 * @type {number}
 */
export const PAD_2 = 1;

/**
 * Index for pad 3.
 *
 * @type {number}
 */
export const PAD_3 = 2;

/**
 * Index for pad 4.
 *
 * @type {number}
 */
export const PAD_4 = 3;

/**
 * The first face button, from bottom going clockwise.
 *
 * @type {number}
 */
export const PAD_FACE_1 = 0;

/**
 * The second face button, from bottom going clockwise.
 *
 * @type {number}
 */
export const PAD_FACE_2 = 1;

/**
 * The third face button, from bottom going clockwise.
 *
 * @type {number}
 */
export const PAD_FACE_3 = 2;

/**
 * The fourth face button, from bottom going clockwise.
 *
 * @type {number}
 */
export const PAD_FACE_4 = 3;

/**
 * The first shoulder button on the left.
 *
 * @type {number}
 */
export const PAD_L_SHOULDER_1 = 4;

/**
 * The first shoulder button on the right.
 *
 * @type {number}
 */
export const PAD_R_SHOULDER_1 = 5;

/**
 * The second shoulder button on the left.
 *
 * @type {number}
 */
export const PAD_L_SHOULDER_2 = 6;

/**
 * The second shoulder button on the right.
 *
 * @type {number}
 */
export const PAD_R_SHOULDER_2 = 7;

/**
 * The select button.
 *
 * @type {number}
 */
export const PAD_SELECT = 8;

/**
 * The start button.
 *
 * @type {number}
 */
export const PAD_START = 9;

/**
 * The button when depressing the left analogue stick.
 *
 * @type {number}
 */
export const PAD_L_STICK_BUTTON = 10;

/**
 * The button when depressing the right analogue stick.
 *
 * @type {number}
 */
export const PAD_R_STICK_BUTTON = 11;

/**
 * Direction pad up.
 *
 * @type {number}
 */
export const PAD_UP = 12;

/**
 * Direction pad down.
 *
 * @type {number}
 */
export const PAD_DOWN = 13;

/**
 * Direction pad left.
 *
 * @type {number}
 */
export const PAD_LEFT = 14;

/**
 * Direction pad right.
 *
 * @type {number}
 */
export const PAD_RIGHT = 15;

/**
 * Vendor specific button.
 *
 * @type {number}
 */
export const PAD_VENDOR = 16;

/**
 * Horizontal axis on the left analogue stick.
 *
 * @type {number}
 */
export const PAD_L_STICK_X = 0;

/**
 * Vertical axis on the left analogue stick.
 *
 * @type {number}
 */
export const PAD_L_STICK_Y = 1;

/**
 * Horizontal axis on the right analogue stick.
 *
 * @type {number}
 */
export const PAD_R_STICK_X = 2;

/**
 * Vertical axis on the right analogue stick.
 *
 * @type {number}
 */
export const PAD_R_STICK_Y = 3;

/**
 * Name of event fired when a gamepad connects.
 *
 * @type {string}
 */
export const EVENT_GAMEPADCONNECTED = 'gamepadconnected';

/**
 * Name of event fired when a gamepad disconnects.
 *
 * @type {string}
 */
export const EVENT_GAMEPADDISCONNECTED = 'gamepaddisconnected';

/**
 * Horizontal axis on the touchpad of a XR pad.
 *
 * @type {number}
 */
export const XRPAD_TOUCHPAD_X = 0;

/**
 * Vertical axis on the thouchpad of a XR pad.
 *
 * @type {number}
 */
export const XRPAD_TOUCHPAD_Y = 1;

/**
 * Horizontal axis on the stick of a XR pad.
 *
 * @type {number}
 */
export const XRPAD_STICK_X = 2;

/**
 * Vertical axis on the stick of a XR pad.
 *
 * @type {number}
 */
export const XRPAD_STICK_Y = 3;

/**
 * The button when pressing the XR pad's touchpad.
 *
 * @type {number}
 */
export const XRPAD_TOUCHPAD_BUTTON = 2;

/**
 * The trigger button from XR pad.
 *
 * @type {number}
 */
export const XRPAD_TRIGGER = 0;

/**
 * The squeeze button from XR pad.
 *
 * @type {number}
 */
export const XRPAD_SQUEEZE = 1;

/**
 * The button when pressing the XR pad's stick.
 *
 * @type {number}
 */
export const XRPAD_STICK_BUTTON = 3;

/**
 * The A button from XR pad.
 *
 * @type {number}
 */
export const XRPAD_A = 4;

/**
 * The B button from XR pad.
 *
 * @type {number}
 */
export const XRPAD_B = 5;
