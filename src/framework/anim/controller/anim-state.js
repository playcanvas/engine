import { Debug } from '../../../core/debug.js';
import { AnimTrack } from '../evaluator/anim-track.js';

import { AnimBlendTree1D } from './anim-blend-tree-1d.js';
import { AnimBlendTreeCartesian2D } from './anim-blend-tree-2d-cartesian.js';
import { AnimBlendTreeDirectional2D } from './anim-blend-tree-2d-directional.js';
import { AnimBlendTreeDirect } from './anim-blend-tree-direct.js';
import { AnimNode } from './anim-node.js';
import {
    ANIM_BLEND_1D, ANIM_BLEND_2D_CARTESIAN, ANIM_BLEND_2D_DIRECTIONAL, ANIM_BLEND_DIRECT, ANIM_CONTROL_STATES
} from './constants.js';

/**
 * Defines a single state that the controller can be in. Each state contains either a single
 * AnimNode or a AnimBlendTree of multiple AnimNodes, which will be used to animate the Entity
 * while the state is active. An AnimState will stay active and play as long as there is no
 * AnimTransition with its conditions met that has that AnimState as its source state.
 *
 * @ignore
 */
class AnimState {
    /** @private */
    _animations = {};

    /** @private */
    _animationList = [];

    /**
     * Create a new AnimState instance.
     *
     * @param {AnimController} controller - The controller this AnimState is associated with.
     * @param {string} name - The name of the state. Used to find this state when the controller
     * transitions between states and links animations.
     * @param {number} [speed] - The speed animations in the state should play at. Individual
     * {@link AnimNodes} can override this value.
     * @param {boolean} [loop] - Determines whether animations in this state should loop.
     * @param {object|null} [blendTree] - If supplied, the AnimState will recursively build a
     * {@link AnimBlendTree} hierarchy, used to store, blend and play multiple animations.
     */
    constructor(controller, name, speed = 1, loop = true, blendTree) {
        this._controller = controller;
        this._name = name;
        this._speed = speed;
        this._loop = loop;
        this._hasAnimations = false;
        const findParameter = this._controller.findParameter.bind(this._controller);
        if (blendTree) {
            this._blendTree = this._createTree(
                blendTree.type,
                this,
                null,
                name,
                1.0,
                blendTree.parameter ? [blendTree.parameter] : blendTree.parameters,
                blendTree.children,
                blendTree.syncAnimations,
                this._createTree,
                findParameter
            );
        } else {
            this._blendTree = new AnimNode(this, null, name, 1.0, speed);
        }
    }

    _createTree(type, state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter) {
        switch (type) {
            case ANIM_BLEND_1D:
                return new AnimBlendTree1D(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
            case ANIM_BLEND_2D_CARTESIAN:
                return new AnimBlendTreeCartesian2D(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
            case ANIM_BLEND_2D_DIRECTIONAL:
                return new AnimBlendTreeDirectional2D(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
            case ANIM_BLEND_DIRECT:
                return new AnimBlendTreeDirect(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
        }

        Debug.error(`Invalid anim blend type: ${type}`);
        return undefined;
    }

    _getNodeFromPath(path) {
        let currNode = this._blendTree;
        for (let i = 1; i < path.length; i++) {
            currNode = currNode.getChild(path[i]);
        }
        return currNode;
    }

    addAnimation(path, animTrack) {
        const pathString = path.join('.');
        const indexOfAnimation = this._animationList.findIndex(function (animation) {
            return animation.path === pathString;
        });
        if (indexOfAnimation >= 0) {
            this._animationList[indexOfAnimation].animTrack = animTrack;
        } else {
            const node = this._getNodeFromPath(path);
            node.animTrack = animTrack;
            this._animationList.push(node);
        }
        this._updateHasAnimations();
    }

    _updateHasAnimations() {
        this._hasAnimations = this._animationList.length > 0 && this._animationList.every(animation => animation.animTrack && animation.animTrack !== AnimTrack.EMPTY);
    }

    get name() {
        return this._name;
    }

    set animations(value) {
        this._animationList = value;
        this._updateHasAnimations();
    }

    get animations() {
        return this._animationList;
    }

    get hasAnimations() {
        return this._hasAnimations;
    }

    set speed(value) {
        this._speed = value;
    }

    get speed() {
        return this._speed;
    }

    set loop(value) {
        this._loop = value;
    }

    get loop() {
        return this._loop;
    }

    get nodeCount() {
        if (!this._blendTree || (this._blendTree.constructor === AnimNode)) return 1;
        return this._blendTree.getNodeCount();
    }

    get playable() {
        return (ANIM_CONTROL_STATES.indexOf(this.name) !== -1 || this.animations.length === this.nodeCount);
    }

    get looping() {
        if (this.animations.length > 0) {
            const trackClipName = this.name + '.' + this.animations[0].animTrack.name;
            const trackClip = this._controller.animEvaluator.findClip(trackClipName);
            if (trackClip) {
                return trackClip.loop;
            }
        }
        return false;
    }

    get totalWeight() {
        let sum = 0;
        for (let i = 0; i < this.animations.length; i++) {
            sum += this.animations[i].weight;
        }
        return sum;
    }

    get timelineDuration() {
        let duration = 0;
        for (let i = 0; i < this.animations.length; i++) {
            const animation = this.animations[i];
            if (animation.animTrack.duration > duration) {
                duration = animation.animTrack.duration;
            }
        }
        return duration;
    }
}

export { AnimState };
