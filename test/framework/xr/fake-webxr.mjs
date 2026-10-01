/**
 * Stand-ins for the parts of the WebXR API that the engine uses, for driving XR sessions in unit
 * tests.
 */

import { Mat4 } from '../../../src/core/math/mat4.js';

/**
 * Creates a stand-in for the XRInputSource of a tracked controller.
 *
 * @returns {object} The input source.
 */
const createController = () => ({
    handedness: 'right',
    targetRayMode: 'tracked-pointer',
    targetRaySpace: {},
    gripSpace: {},
    profiles: [],
    gamepad: null,
    hand: null
});

/**
 * Creates a stand-in for an XRFrame, in which every space has the same pose.
 *
 * @param {{ x: number, y: number, z: number }} position - The position of every space.
 * @param {object} [options] - The rest of the pose.
 * @param {{ x: number, y: number, z: number, w: number }} [options.orientation] - The orientation
 * of every space. Defaults to the identity.
 * @param {{ x: number, y: number, z: number }} [options.linearVelocity] - The linear velocity of
 * every space, which only some browsers report.
 * @returns {object} The frame.
 */
const createFrame = (position, { orientation = { x: 0, y: 0, z: 0, w: 1 }, linearVelocity } = {}) => ({
    getPose: () => ({
        transform: {
            position,
            orientation
        },
        linearVelocity
    })
});

/**
 * Creates a stand-in for an XRFrame of a session, in which the viewer is at the origin looking
 * down -z, through one view with a 90 degree field of view. Like the browser, the frame projects
 * with the depth range of the render state of the session.
 *
 * @param {FakeXRSession} session - The session.
 * @returns {object} The frame.
 */
const createViewerFrame = (session) => {
    const { depthNear, depthFar } = session.renderState;
    const identity = new Mat4().data;

    return {
        session,
        getViewerPose: () => ({
            transform: {
                position: { x: 0, y: 0, z: 0 },
                orientation: { x: 0, y: 0, z: 0, w: 1 }
            },
            views: [{
                eye: 'none',
                projectionMatrix: new Mat4().setPerspective(90, 1, depthNear, depthFar).data,
                transform: {
                    matrix: identity,
                    inverse: { matrix: identity }
                }
            }]
        })
    };
};

/**
 * Stand-in for an XRSession, implementing what XrManager uses to start and end a session.
 */
class FakeXRSession {
    enabledFeatures = [];

    inputSources = [];

    renderState = {};

    visibilityState = 'visible';

    ended = false;

    /**
     * Resolves once the end event has been fired.
     *
     * @type {Promise<void>|null}
     */
    endEventFired = null;

    /**
     * Errors thrown by event listeners. Like the browser, the session reports these instead of
     * passing them to the code that fired the event, and carries on.
     *
     * @type {Error[]}
     */
    listenerErrors = [];

    _listeners = new Map();

    /**
     * @param {object[]} inputSources - The input sources of the session.
     * @param {Function} onShutdown - Called when the session shuts down.
     */
    constructor(inputSources, onShutdown) {
        this.inputSources = inputSources;
        this._onShutdown = onShutdown;
    }

    addEventListener(type, listener) {
        let listeners = this._listeners.get(type);
        if (!listeners) {
            listeners = new Set();
            this._listeners.set(type, listeners);
        }
        listeners.add(listener);
    }

    removeEventListener(type, listener) {
        this._listeners.get(type)?.delete(listener);
    }

    dispatchEvent(event) {
        const listeners = this._listeners.get(event.type) ?? [];
        for (const listener of [...listeners]) {
            try {
                listener(event);
            } catch (err) {
                this.listenerErrors.push(err);
            }
        }
        return true;
    }

    requestReferenceSpace(type) {
        return Promise.resolve({ type });
    }

    requestAnimationFrame() {
        return 1;
    }

    cancelAnimationFrame() {
    }

    updateRenderState(state) {
        Object.assign(this.renderState, state);
    }

    end() {
        if (this.ended) {
            return Promise.reject(new DOMException('The session has already ended.', 'InvalidStateError'));
        }

        // like the browser, shut the session down at once and fire the end event later
        this.ended = true;
        this._onShutdown(this);
        this.endEventFired = new Promise((resolve) => {
            setTimeout(() => {
                this.dispatchEvent(new Event('end'));
                resolve();
            });
        });
        return this.endEventFired;
    }
}

/**
 * Stand-in for navigator.xr. Like the browser, it grants sessions asynchronously and rejects a
 * request for an immersive session while another one is pending or active.
 */
class FakeXRSystem extends EventTarget {
    /**
     * The number of times session support was checked.
     *
     * @type {number}
     */
    supportChecks = 0;

    /**
     * The number of sessions requested.
     *
     * @type {number}
     */
    requestCount = 0;

    /**
     * The sessions granted, in order.
     *
     * @type {FakeXRSession[]}
     */
    sessions = [];

    /**
     * When set, the next session request is rejected with this error.
     *
     * @type {Error|null}
     */
    nextRequestError = null;

    /**
     * The input sources of the sessions granted.
     *
     * @type {object[]}
     */
    inputSources = [];

    _pending = false;

    _active = null;

    isSessionSupported() {
        this.supportChecks++;
        return Promise.resolve(true);
    }

    requestSession() {
        this.requestCount++;

        if (this._pending || this._active) {
            return Promise.reject(new DOMException('An immersive session is already pending or active.', 'InvalidStateError'));
        }

        this._pending = true;

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this._pending = false;

                const error = this.nextRequestError;
                if (error) {
                    this.nextRequestError = null;
                    reject(error);
                    return;
                }

                const session = new FakeXRSession(this.inputSources, (ended) => {
                    if (this._active === ended) {
                        this._active = null;
                    }
                });
                this._active = session;
                this.sessions.push(session);
                resolve(session);
            });
        });
    }
}

export { createController, createFrame, createViewerFrame, FakeXRSession, FakeXRSystem };
