import { AnimBlendTree1D, AnimBlendTreeCartesian2D, AnimBlendTreeDirectional2D, AnimBlendTreeDirect } from './anim-blend-tree.js';
import { AnimNode } from './anim-node.js';
import {
    ANIM_STATE_START, ANIM_STATE_END, ANIM_STATE_ANY
} from './constants.js';

import {
    ANIM_BLEND_1D, ANIM_BLEND_2D_DIRECTIONAL, ANIM_BLEND_2D_CARTESIAN, ANIM_BLEND_DIRECT
} from './constants.js';

/**
 * @private
 * @class
 * @name AnimState
 * @classdesc Defines a single state that the controller can be in. Each state contains either a single AnimNode or a AnimBlendTree of multiple AnimNodes, which will be used to animate the Entity while the state is active. An AnimState will stay active and play as long as there is no AnimTransition with it's conditions met that has that AnimState as it's source state.
 * @description Create a new AnimState.
 * @param {AnimController} controller - The controller this AnimState is associated with.
 * @param {string} name - The name of the state. Used to find this state when the controller transitions between states and links animations.
 * @param {number} speed - The speed animations in the state should play at. Individual {@link AnimNodes} can override this value.
 * @param {boolean} loop - Determines whether animations in this state should loop.
 * @param {object|null} blendTree - If supplied, the AnimState will recursively build a {@link AnimBlendTree} hierarchy, used to store, blend and play multiple animations.
 */
class AnimState {
    constructor(controller, name, speed, loop, blendTree) {
        this._controller = controller;
        this._name = name;
        this._animations = {};
        this._animationList = [];
        this._speed = speed || 1.0;
        this._loop = loop === undefined ? true : loop;
        var findParameter = this._controller.findParameter.bind(this._controller);
        if (blendTree) {
            switch (blendTree.type) {
                case ANIM_BLEND_1D:
                    this._blendTree = new AnimBlendTree1D(this, null, name, 1.0, [blendTree.parameter], blendTree.children, findParameter);
                    break;
                case ANIM_BLEND_2D_CARTESIAN:
                    this._blendTree = new AnimBlendTreeCartesian2D(this, null, name, 1.0, blendTree.parameters, blendTree.children, findParameter);
                    break;
                case ANIM_BLEND_2D_DIRECTIONAL:
                    this._blendTree = new AnimBlendTreeDirectional2D(this, null, name, 1.0, blendTree.parameters, blendTree.children, findParameter);
                    break;
                case ANIM_BLEND_DIRECT:
                    this._blendTree = new AnimBlendTreeDirect(this, null, name, 1.0, blendTree.parameters, blendTree.children, findParameter);
                    break;
            }
        } else {
            this._blendTree = new AnimNode(this, null, name, 1.0, speed);
        }
    }

    _getNodeFromPath(path) {
        var currNode = this._blendTree;
        for (var i = 1; i < path.length; i++) {
            currNode = currNode.getChild(path[i]);
        }
        return currNode;
    }

    addAnimation(path, animTrack) {
        var pathString = path.join('.');
        var indexOfAnimation = this._animationList.findIndex(function (animation) {
            return animation.path === pathString;
        });
        if (indexOfAnimation >= 0) {
            this._animationList[indexOfAnimation].animTrack = animTrack;
        } else {
            var node = this._getNodeFromPath(path);
            node.animTrack = animTrack;
            this._animationList.push(node);
        }
    }

    get name() {
        return this._name;
    }

    get animations() {
        return this._animationList;
    }

    set animations(value) {
        this._animationList = value;
    }

    get speed() {
        return this._speed;
    }

    get loop() {
        return this._loop;
    }

    get nodeCount() {
        if (!this._blendTree || !(this._blendTree.constructor === AnimBlendTree)) return 1;
        return this._blendTree.getNodeCount();
    }

    get playable() {
        return (this.name === ANIM_STATE_START || this.name === ANIM_STATE_END || this.name === ANIM_STATE_ANY || this.animations.length === this.nodeCount);
    }

    get looping() {
        if (this.animations.length > 0) {
            var trackClipName = this.name + '.' + this.animations[0].animTrack.name;
            var trackClip = this._controller.animEvaluator.findClip(trackClipName);
            if (trackClip) {
                return trackClip.loop;
            }
        }
        return false;
    }

    get totalWeight() {
        var sum = 0;
        var i;
        for (i = 0; i < this.animations.length; i++) {
            sum += this.animations[i].weight;
        }
        return sum;
    }

    get timelineDuration() {
        var duration = 0;
        var i;
        for (i = 0; i < this.animations.length; i++) {
            var animation = this.animations[i];
            if (animation.animTrack.duration > duration) {
                duration = animation.animTrack.duration;
            }
        }
        return duration;
    }
}

export { AnimState };
