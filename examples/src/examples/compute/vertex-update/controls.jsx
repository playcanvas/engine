import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
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
        <Panel headerText='Blob'>
            <LabelGroup text='Amplitude'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.amplitude' }}
                    min={0}
                    max={0.75}
                    precision={2}
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
            <LabelGroup text='Wireframe'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.wireframe' }}
                />
            </LabelGroup>
        </Panel>
    );
}
