import { EventHandler } from '../core/event-handler.js';
import { Vec3 } from '../math/vec3.js';
import { Quat } from '../math/quat.js';

/**
 * @class
 * @name pc.XrTrackedImage
 * @classdesc Tracked image interface, that is created by Image Tracking system and is provided as list from {@link pc.XrImageTracking#images}. It contains information about tracking state as well as position and rotation of tracked image.
 * @description Tracked image interface, that is created by Image Tracking system and is provided as list from {@link pc.XrImageTracking#images}. It contains information about tracking state as well as position and rotation of tracked image.
 * @param {object} image - Image that is matching real world image as close as possible. Resolution of images should be at least 300x300. High resolution does NOT improve tracking performance. Color of image is irelevant, so greyscale images can be used. Images with too many geometric features or repeating patterns will reduce tracking stability.
 * @param {number} width - Width (in meters) of image in real world. Providing this value as close to real value will improve tracking quality.
 * @property {object} image Image that is used for tracking.
 * @property {number} width Width that is provided to assist tracking performance. This property can be updated only when AR session is not running.
 * @property {boolean} trackable True if image is trackable. Too small resolution or invalid images can be untrackable by underlying AR system.
 * @property {boolean} tracking True if image is in tracking state, and being tracked in real world by underlying AR system.
 * @property {boolean} emulated True if image was recently tracked but currently is not actively tracked due to inability of identifying image by underlying AR system. Position and rotation will be based on previously known transformation assuming tracked image has not moved.
 */
function XrTrackedImage(image, width) {
    EventHandler.call(this);

    this._image = image;
    this._bitmap = null;
    this._width = width;
    this._measuredWidth = 0;
    this._trackable = false;
    this._tracking = false;
    this._emulated = false;
    this._pose = null;

    this._position = new Vec3();
    this._rotation = new Quat();
}
XrTrackedImage.prototype = Object.create(EventHandler.prototype);
XrTrackedImage.prototype.constructor = XrTrackedImage;

/**
 * @event
 * @name pc.XrTrackedImage#tracked
 * @description Fired when image becomes actively tracked.
 */

/**
 * @event
 * @name pc.XrTrackedImage#untracked
 * @description Fired when image is no more actively tracked.
 */

XrTrackedImage.prototype.prepare = function () {
    var self = this;

    if (this._bitmap) {
        return {
            image: this._bitmap,
            widthInMeters: this._width
        };
    }

    return this._image.decode()
        .then(function () {
            return createImageBitmap(self._image);
        })
        .then(function (bitmap) {
            self._bitmap = bitmap;
            return {
                image: self._bitmap,
                widthInMeters: self._width
            };
        });
};

XrTrackedImage.prototype.destroy = function () {
    this._image = null;
    this._pose = null;

    if (this._bitmap) {
        this._bitmap.close();
        this._bitmap = null;
    }
};

/**
 * @function
 * @name pc.XrTrackedImage#getPosition
 * @description Get position of tracked image. The position is most recent based on tracked image state.
 * @returns {pc.Vec3} Position in world space.
 * @example
 * // update entity position to match tracked image position
 * entity.setPosition(trackedImage.getPosition());
 */
XrTrackedImage.prototype.getPosition = function () {
    if (this._pose) this._position.copy(this._pose.transform.position);
    return this._position;
};

/**
 * @function
 * @name pc.XrTrackedImage#getRotation
 * @description Get rotation of tracked image. The rotation is most recent based on tracked image state.
 * @returns {pc.Quat} Rotation in world space.
 * @example
 * // update entity rotation to match tracked image rotation
 * entity.setRotation(trackedImage.getRotation());
 */
XrTrackedImage.prototype.getRotation = function () {
    if (this._pose) this._rotation.copy(this._pose.transform.orientation);
    return this._rotation;
};

Object.defineProperty(XrTrackedImage.prototype, 'image', {
    get: function () {
        return this._image;
    }
});

Object.defineProperty(XrTrackedImage.prototype, 'width', {
    get: function () {
        return this._width;
    },
    set: function (value) {
        this._width = value;
    }
});

Object.defineProperty(XrTrackedImage.prototype, 'trackable', {
    get: function () {
        return this._trackable;
    }
});

Object.defineProperty(XrTrackedImage.prototype, 'tracking', {
    get: function () {
        return this._tracking;
    }
});

Object.defineProperty(XrTrackedImage.prototype, 'emulated', {
    get: function () {
        return this._emulated;
    }
});

export { XrTrackedImage };
