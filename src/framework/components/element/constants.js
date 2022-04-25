/**
 * A {@link ElementComponent} that contains child {@link ElementComponent}s.
 *
 * @type {string}
 */
export const ELEMENTTYPE_GROUP = 'group';

/**
 * A {@link ElementComponent} that displays an image.
 *
 * @type {string}
 */
export const ELEMENTTYPE_IMAGE = 'image';

/**
 * A {@link ElementComponent} that displays text.
 *
 * @type {string}
 */
export const ELEMENTTYPE_TEXT = 'text';

/**
 * Fit the content to the exact Element's bounding box.
 *
 * @type {string}
 */
export const ELEMENT_IMAGE_FIT_STRETCH = 'stretch';

/**
 * Fit the content within the Element's bounding box while
 * preserving its Aspect Ratio.
 *
 * @type {string}
 */
export const ELEMENT_IMAGE_FIT_CONTAIN = 'contain';

/**
 * Fit the content to cover the entire Element's bounding box while
 * preserving its Aspect Ratio.
 *
 * @type {string}
 */
export const ELEMENT_IMAGE_FIT_COVER = 'cover';
