/**
 * When resizing the window the size of the canvas will not change.
 */
export const FILLMODE_NONE = 'NONE';

/**
 * When resizing the window the size of the canvas will change to fill the window exactly.
 */
export const FILLMODE_FILL_WINDOW = 'FILL_WINDOW';

/**
 * When resizing the window the size of the canvas will change to fill the window as best it can,
 * while maintaining the same aspect ratio.
 */
export const FILLMODE_KEEP_ASPECT = 'KEEP_ASPECT';

/**
 * When the canvas is resized the resolution of the canvas will change to match the size of the
 * canvas.
 */
export const RESOLUTION_AUTO = 'AUTO';

/**
 * When the canvas is resized the resolution of the canvas will remain at the same value and the
 * output will just be scaled to fit the canvas.
 */
export const RESOLUTION_FIXED = 'FIXED';
