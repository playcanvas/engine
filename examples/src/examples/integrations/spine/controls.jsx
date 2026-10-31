import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

const animations = ['idle', 'walk', 'run', 'jump', 'hoverboard', 'portal', 'death'].map((name) => ({
    v: name,
    t: name[0].toUpperCase() + name.slice(1)
}));

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <Panel headerText='Spineboy'>
            <LabelGroup text='Animation'>
                <SelectInput
                    type='string'
                    options={animations}
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'spine.animation' }}
                />
            </LabelGroup>
            <LabelGroup text='Aim'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'spine.aim' }}
                />
            </LabelGroup>
            <LabelGroup text='Speed'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'spine.speed' }}
                    min={0}
                    max={2}
                    precision={2}
                />
            </LabelGroup>
        </Panel>
    );
}
