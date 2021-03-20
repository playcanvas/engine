export const ABSOLUTE_URL = new RegExp(
    '^' + // beginning of the url
    '\\s*' +  // ignore leading spaces (some browsers trim the url automatically, but we can't assume that)
    '(?:' +  // beginning of a non-captured regex group
        // `{protocol}://`
        '(?:' +  // beginning of protocol scheme (non-captured regex group)
            '[a-z]+[a-z0-9\\-\\+\\.]*' + // protocol scheme must (RFC 3986) consist of "a letter and followed by any combination of letters, digits, plus ("+"), period ("."), or hyphen ("-")."
            ':' + // protocol scheme must end with colon character
        ')?' + // end of optional scheme group, the group is optional since the string may be a protocol-relative absolute URL
        '//' + // an absolute url must always begin with two forward slash characters (ignoring any leading spaces and protocol scheme)

        '|' + // or another option(s):

        // Data URL (RFC 2397), simplified
        'data:' +

        // Blob data
        '|blob:' +
    ')',
    'i' // non case-sensitive flag
);

/**
 * @constant
 * @type {string}
 * @name ASSET_ANIMATION
 * @description Asset type name for animation.
 */
export const ASSET_ANIMATION = 'animation';
/**
 * @constant
 * @type {string}
 * @name ASSET_AUDIO
 * @description Asset type name for audio.
 */
export const ASSET_AUDIO = 'audio';
/**
 * @constant
 * @type {string}
 * @name ASSET_IMAGE
 * @description Asset type name for image.
 */
export const ASSET_IMAGE = 'image';
/**
 * @constant
 * @type {string}
 * @name ASSET_JSON
 * @description Asset type name for json.
 */
export const ASSET_JSON = 'json';
/**
 * @constant
 * @type {string}
 * @name ASSET_MODEL
 * @description Asset type name for model.
 */
export const ASSET_MODEL = 'model';
/**
 * @constant
 * @type {string}
 * @name ASSET_MATERIAL
 * @description Asset type name for material.
 */
export const ASSET_MATERIAL = 'material';
/**
 * @constant
 * @type {string}
 * @name ASSET_TEXT
 * @description Asset type name for text.
 */
export const ASSET_TEXT = 'text';
/**
 * @constant
 * @type {string}
 * @name ASSET_TEXTURE
 * @description Asset type name for texture.
 */
export const ASSET_TEXTURE = 'texture';
/**
 * @constant
 * @type {string}
 * @name ASSET_CUBEMAP
 * @description Asset type name for cubemap.
 */
export const ASSET_CUBEMAP = 'cubemap';
/**
 * @constant
 * @type {string}
 * @name ASSET_SHADER
 * @description Asset type name for shader.
 */
export const ASSET_SHADER = 'shader';
/**
 * @constant
 * @type {string}
 * @name ASSET_CSS
 * @description Asset type name for CSS.
 */
export const ASSET_CSS = 'css';
/**
 * @constant
 * @type {string}
 * @name ASSET_HTML
 * @description Asset type name for HTML.
 */
export const ASSET_HTML = 'html';
/**
 * @constant
 * @type {string}
 * @name ASSET_SCRIPT
 * @description Asset type name for script.
 */
export const ASSET_SCRIPT = 'script';
/**
 * @constant
 * @type {string}
 * @name ASSET_CONTAINER
 * @description Asset type name for a container.
 */
export const ASSET_CONTAINER = 'container';
