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
        <Panel headerText='Settings'>
            <LabelGroup text='Segments'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.segments' }}
                    min={3}
                    max={48}
                    precision={0}
                />
            </LabelGroup>
            <LabelGroup text='Depth Test'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.depthTest' }}
                    value={observer.get('settings.depthTest')}
                />
            </LabelGroup>
            <LabelGroup text='Animate'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.animate' }}
                    value={observer.get('settings.animate')}
                />
            </LabelGroup>
        </Panel>
    );
}
