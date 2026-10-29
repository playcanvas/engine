import { BindingTwoWay, BooleanInput, Label, LabelGroup, Panel } from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <Panel headerText='Profiling'>
            <LabelGroup text='Profile from start'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.profileFromStart' }}
                    value={observer.get('settings.profileFromStart')}
                />
            </LabelGroup>
            <Label text='Takes effect on reload' />
        </Panel>
    );
}
