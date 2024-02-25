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
 * Asset type name for animation.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_ANIMATION = 'animation';

/**
 * Asset type name for audio.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_AUDIO = 'audio';

/**
 * Asset type name for image.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_IMAGE = 'image';

/**
 * Asset type name for json.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_JSON = 'json';

/**
 * Asset type name for model.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_MODEL = 'model';

/**
 * Asset type name for material.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_MATERIAL = 'material';

/**
 * Asset type name for text.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_TEXT = 'text';

/**
 * Asset type name for texture.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_TEXTURE = 'texture';

/**
 * Asset type name for textureatlas.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_TEXTUREATLAS = 'textureatlas';

/**
 * Asset type name for cubemap.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_CUBEMAP = 'cubemap';

/**
 * Asset type name for shader.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_SHADER = 'shader';

/**
 * Asset type name for CSS.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_CSS = 'css';

/**
 * Asset type name for HTML.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_HTML = 'html';

/**
 * Asset type name for script.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_SCRIPT = 'script';

/**
 * Asset type name for a container.
 *
 * @type {string}
 * @category Asset
 */
export const ASSET_CONTAINER = 'container';
