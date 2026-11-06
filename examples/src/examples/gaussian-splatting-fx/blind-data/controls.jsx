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
        <Panel headerText='Settings'>
            <LabelGroup text='View'>
                <SelectInput
                    type='number'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'view' }}
                    value={observer.get('view') ?? 0}
                    options={[
                        { v: 0, t: 'Effect' },
                        { v: 1, t: 'Logo Field' },
                        { v: 2, t: 'Edge Field' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Animate'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'animate' }}
                />
            </LabelGroup>
            <LabelGroup text='Shine'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'shine' }}
                    min={0}
                    max={2}
                    precision={2}
                />
            </LabelGroup>
            <LabelGroup text='Hue'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'hue' }}
                    min={-180}
                    max={180}
                    precision={0}
                />
            </LabelGroup>
            <LabelGroup text='Waves'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'waves' }}
                    min={0}
                    max={2}
                    precision={2}
                />
            </LabelGroup>
        </Panel>
    );
}
