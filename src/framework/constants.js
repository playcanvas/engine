/**
 * @constant
 * @type {string}
 * @name FILLMODE_NONE
 * @description When resizing the window the size of the canvas will not change.
 */
export const FILLMODE_NONE = 'NONE';
/**
 * @constant
 * @type {string}
 * @name FILLMODE_FILL_WINDOW
 * @description When resizing the window the size of the canvas will change to fill the window exactly.
 */
export const FILLMODE_FILL_WINDOW = 'FILL_WINDOW';
/**
 * @constant
 * @type {string}
 * @name FILLMODE_KEEP_ASPECT
 * @description When resizing the window the size of the canvas will change to fill the window as best it can, while maintaining the same aspect ratio.
 */
export const FILLMODE_KEEP_ASPECT = 'KEEP_ASPECT';
/**
 * @constant
 * @type {string}
 * @name RESOLUTION_AUTO
 * @description When the canvas is resized the resolution of the canvas will change to match the size of the canvas.
 */
export const RESOLUTION_AUTO = 'AUTO';
/**
 * @constant
 * @type {string}
 * @name RESOLUTION_FIXED
 * @description When the canvas is resized the resolution of the canvas will remain at the same value and the output will just be scaled to fit the canvas.
 */
export const RESOLUTION_FIXED = 'FIXED';
