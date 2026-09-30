import { Component } from 'react';

import { SelectInput } from './OverlaySelectInput.mjs';
import { PHYSICS_AMMO, PHYSICS_JOLT } from '../constants.mjs';
import { jsx } from '../jsx.mjs';
import { patchState, readState, validPhysicsBackend } from '../url-state.mjs';

/**
 * @typedef {object} Props
 * @property {Function} onSelect - On select handler.
 */

/**
 * @typedef {object} State
 * @property {string} backend - The selected physics backend.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

/**
 * Picks the physics backend for the examples that offer the choice. Like the graphics device,
 * the pick is remembered across examples and sessions and carried in shared links.
 */
class PhysicsSelector extends TypedComponent {
    /** @type {State} */
    state = {
        backend: validPhysicsBackend(readState().physics) ??
            validPhysicsBackend(localStorage.getItem('preferredPhysicsBackend')) ??
            PHYSICS_AMMO
    };

    /**
     * @param {string} value - The newly picked physics backend.
     */
    onSelect(value) {
        localStorage.setItem('preferredPhysicsBackend', value);
        patchState({ physics: value });
        this.setState({ backend: value });
        this.props.onSelect(value);
    }

    render() {
        return jsx(SelectInput, {
            id: 'physicsBackendSelectInput',
            options: [
                { t: 'Ammo', v: PHYSICS_AMMO },
                { t: 'Jolt', v: PHYSICS_JOLT }
            ],
            value: this.state.backend,
            onSelect: this.onSelect.bind(this),
            prefix: 'Physics: '
        });
    }
}

export { PhysicsSelector };
