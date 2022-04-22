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
 * Disable Aspect Ratio content resizing.
 *
 * @type {number}
 */
export const ELEMENT_IMAGE_ASPECT_NONE = 0;

/**
 * Resize the content to fit within the Element's bounding box.
 *
 * @type {number}
 */
export const ELEMENT_IMAGE_ASPECT_CONTAIN = 1;

/**
 * Resize the content to cover the entire Element's bounding box.
 *
 * @type {number}
 */
export const ELEMENT_IMAGE_ASPECT_COVER = 2;
