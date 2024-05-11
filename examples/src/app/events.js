/**
 * @typedef {object} LoadingEventDetail
 * @property {boolean} showDeviceSelector - Show device selector
 *
 * @typedef {CustomEvent<LoadingEventDetail>} LoadingEvent.
 */

/**
 * @typedef {object} StateEventDetail
 * @property {import('@playcanvas/observer').Observer} observer - The PCUI observer.
 * @property {Record<string, string>} files - The example files.
 * @property {string} description - The example description.
 *
 * @typedef {CustomEvent<StateEventDetail>} StateEvent
 */

/**
 * @typedef {object} DeviceEventDetail
 * @property {string} deviceType - The device type.
 *
 * @typedef {CustomEvent<DeviceEventDetail>} DeviceEvent
 */

/**
 * @typedef {object} ErrorEventDetail
 * @property {string} message - The error message.
 * @property {{ file: string, line: string, column: string }[]} locations - The error locations.
 *
 * @typedef {CustomEvent<ErrorEventDetail>} ErrorEvent
 */
