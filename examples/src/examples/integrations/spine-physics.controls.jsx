import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

const motions = ['none', 'sway', 'rock', 'shake'].map((name) => ({
    v: name,
    t: name[0].toUpperCase() + name.slice(1)
}));

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <Panel headerText='Physics'>
            <LabelGroup text='Animate'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'spine.animate' }}
                />
            </LabelGroup>
            <LabelGroup text='Inheritance'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'spine.inheritance' }}
                />
            </LabelGroup>
            <LabelGroup text='Motion'>
                <SelectInput
                    type='string'
                    options={motions}
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'spine.motion' }}
                />
            </LabelGroup>
        </Panel>
    );
}
