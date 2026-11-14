import { BindingTwoWay, BooleanInput, LabelGroup, Panel } from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const toggle = (/** @type {string} */ path, /** @type {string} */ text) => (
        <LabelGroup text={text}>
            <BooleanInput
                type='toggle'
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
                value={observer.get(`settings.${path}`)}
            />
        </LabelGroup>
    );

    return (
        <Panel headerText='Settings'>
            {toggle('applyCulling', 'Apply Culling')}
            {toggle('showFrustum', 'Frustum')}
            {toggle('showBounds', 'Bounds')}
            {toggle('showVelocity', 'Velocity')}
            {toggle('throughObserver', 'Observer View')}
        </Panel>
    );
}
