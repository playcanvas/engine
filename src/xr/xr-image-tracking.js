import { EventHandler } from '../core/event-handler.js';
import { XrTrackedImage } from './xr-tracked-image.js';

/**
 * @class
 * @name pc.XrImageTracking
 * @classdesc Image Tracking provides ability to track real world images by provided image samples and their estimate sizes.
 * @description Image Tracking provides ability to track real world images by provided image samples and their estimate sizes.
 * @param {pc.XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if Image Tracking is supported.
 * @property {boolean} available True if Image Tracking is available. This property will be false if no images were provided for AR session or there was an error processing provided images.
 * @property {pc.XrTrackedImage[]} images List of {@link pc.XrTrackedImage} that contain tracking information.
 */
function XrImageTracking(manager) {
    EventHandler.call(this);

    this._manager = manager;
    this._supported = !! window.XRImageTrackingResult;
    this._available = false;

    this._images = [];

    if (this._supported) {
        this._manager.on('start', this._onSessionStart, this);
        this._manager.on('end', this._onSessionEnd, this);
    }
}
XrImageTracking.prototype = Object.create(EventHandler.prototype);
XrImageTracking.prototype.constructor = XrImageTracking;

/**
 * @event
 * @name pc.XrImageTracking#error
 * @param {Error} error - Error object related to failure of image tracking.
 * @description Fired when XR session is started, but image tracking failed to process provided images.
 */

/**
 * @function
 * @name pc.XrImageTracking#add
 * @description Add image for image tracking, as well as width that helps underlying system to estimate proper transformation. Modifying tracked images list is only possible before AR session is started.
 * @param {object} image - Image that is matching real world image as close as possible. Resolution of images should be at least 300x300. High resolution does NOT improve tracking performance. Color of image is irelevant, so greyscale images can be used. Images with too many geometric features or repeating patterns will reduce tracking stability.
 * @param {number} width - Width (in meters) of image in real world. Providing this value as close to real value will improve tracking quality.
 * @returns {pc.XrTrackedImage} tracked image object that will contain tracking information.
 * @example
 * // image with width of 20cm (0.2m)
 * app.xr.imageTracking.add(bookCoverImg, 0.2);
 */
XrImageTracking.prototype.add = function (image, width) {
    if (! this._supported || this._manager.active) return null;

    var trackedImage = new XrTrackedImage(image, width);
    this._images.push(trackedImage);
    return trackedImage;
};

/**
 * @function
 * @name pc.XrImageTracking#remove
 * @description Add image for image tracking, as well as width that helps underlying system to estimate proper transformation.
 * @param {pc.XrTrackedImage} trackedImage - Tracked image to be removed. Modifying tracked images list is only possible before AR session is started.
 */
XrImageTracking.prototype.remove = function (trackedImage) {
    if (this._manager.active) return;

    var ind = this._images.indexOf(trackedImage);
    if (ind !== -1) {
        trackedImage.destroy();
        this._images.splice(ind, 1);
    }
};

XrImageTracking.prototype._onSessionStart = function () {
    var self = this;

    this._manager.session.getTrackedImageScores().then(function (images) {
        self._available = true;

        for (var i = 0; i < images.length; i++) {
            self._images[i]._trackable = images[i] === 'trackable';
        }
    }).catch(function (err) {
        self._available = false;
        self.fire('error', err);
    });
};

XrImageTracking.prototype._onSessionEnd = function () {
    this._available = false;

    for (var i = 0; i < this._images.length; i++) {
        this._images[i]._pose = null;
        this._images[i]._measuredWidth = 0;

        if (this._images[i]._tracking) {
            this._images[i]._tracking = false;
            this._images[i].fire('untracked');
        }
    }
};

XrImageTracking.prototype.prepareImages = function (callback) {
    if (this._images.length) {
        Promise.all(this._images.map(function (trackedImage) {
            return trackedImage.prepare();
        })).then(function (bitmaps) {
            callback(null, bitmaps);
        }).catch(function (err) {
            callback(err, null);
        });
    } else {
        callback(null, null);
    }
};

XrImageTracking.prototype.update = function (frame) {
    if (! this._available) return;

    var results = frame.getImageTrackingResults();
    var index = { };
    var i;

    for (i = 0; i < results.length; i++) {
        index[results[i].index] = results[i];

        var trackedImage = this._images[results[i].index];
        trackedImage._emulated = results[i].trackingState === 'emulated';
        trackedImage._measuredWidth = results[i].measuredWidthInMeters;
        trackedImage._dirtyTransform = true;
        trackedImage._pose = frame.getPose(results[i].imageSpace, this._manager._referenceSpace);
    }

    for (i = 0; i < this._images.length; i++) {
        if (this._images[i]._tracking && ! index[i]) {
            this._images[i]._tracking = false;
            this._images[i].fire('untracked');
        } else if (! this._images[i]._tracking && index[i]) {
            this._images[i]._tracking = true;
            this._images[i].fire('tracked');
        }
    }
};

Object.defineProperty(XrImageTracking.prototype, 'supported', {
    get: function () {
        return this._supported;
    }
});

Object.defineProperty(XrImageTracking.prototype, 'available', {
    get: function () {
        return this._available;
    }
});

Object.defineProperty(XrImageTracking.prototype, 'images', {
    get: function () {
        return this._images;
    }
});

export { XrImageTracking };
