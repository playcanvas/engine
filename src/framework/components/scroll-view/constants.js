/**
 * Content does not scroll any further than its bounds.
 *
 * @type {number}
 * @category User Interface
 */
export const SCROLL_MODE_CLAMP = 0;

/**
 * Content scrolls past its bounds and then gently bounces back.
 *
 * @type {number}
 * @category User Interface
 */
export const SCROLL_MODE_BOUNCE = 1;

/**
 * Content can scroll forever.
 *
 * @type {number}
 * @category User Interface
 */
export const SCROLL_MODE_INFINITE = 2;

/**
 * The scrollbar will be visible all the time.
 *
 * @type {number}
 * @category User Interface
 */
export const SCROLLBAR_VISIBILITY_SHOW_ALWAYS = 0;

/**
 * The scrollbar will be visible only when content exceeds the size of the viewport.
 *
 * @type {number}
 * @category User Interface
 */
export const SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED = 1;
