import { EventHandler } from '../../core/event-handler.js';
import { XrJoint } from './xr-joint.js';

class XrBody extends EventHandler {
    _manager;
    _tracking = false;
    _joints = [];
    _jointsById = {};

    // supported
    // available

    constructor(manager) {
        super();
        this._manager = manager;
    }

    update(frame) {
        const body = frame.body;
        if (!body) return;

        for (const [name, space] of body) {
            const pose = frame.getPose(space, this._manager._referenceSpace);
            let joint = this._jointsById[name];
            if (!joint) {
                joint = new XrJoint(0, name, null, this);
                this._jointsById[name] = joint;
                this._joints.push(joint);
            }
            joint.update(pose);
        }
    }

    /**
     * Returns joint by its id.
     *
     * @param {string} id - Id of a joint.
     * @returns {XrJoint|null} Joint or null if not available.
     */
    getJointById(id) {
        return this._jointsById[id] || null;
    }

    /**
     * List of joints of a body.
     *
     * @type {XrJoint[]}
     */
    get joints() {
        return this._joints;
    }

    get supported() {
        return true;
    }
}

export { XrBody };
