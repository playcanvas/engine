/**
 * @typedef {CustomEvent} LoadingEvent
 * @property {object} detail - The detail object.
 * @property {boolean} detail.showDeviceSelector - Show device selector.
 */

/**
 * @typedef {CustomEvent} StateEvent
 * @property {object} detail - The detail object.
 * @property {Record<string, string>} detail.observer - The PCUI observer.
 * @property {Record<string, string>} detail.files - The example files.
 * @property {string} detail.description - The example description.
 */

/**
 * @typedef {CustomEvent} DeviceEvent
 * @property {object} detail - The detail object.
 * @property {string} detail.deviceType - The device type.
 */
