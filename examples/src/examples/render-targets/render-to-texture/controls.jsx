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

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <Panel headerText='Drone Camera'>
            <LabelGroup text='Projection'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.projection' }}
                    type='string'
                    options={[
                        { v: 'alternate', t: 'Alternate' },
                        { v: 'perspective', t: 'Perspective' },
                        { v: 'orthographic', t: 'Orthographic' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Speed'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.speed' }}
                    min={0}
                    max={3}
                    precision={2}
                />
            </LabelGroup>
            <LabelGroup text='Overlay'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.overlay' }}
                />
            </LabelGroup>
        </Panel>
    );
}
