import {
    BindingTwoWay,
    BooleanInput,
    Label,
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
        <Panel headerText='Sculpture'>
            <LabelGroup text='Batching'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.batching' }}
                />
            </LabelGroup>
            <LabelGroup text='Draw Calls'>
                <Label binding={new BindingTwoWay()} link={{ observer, path: 'stats.drawCalls' }} />
            </LabelGroup>
            <LabelGroup text='Pattern'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.pattern' }}
                    type='string'
                    options={[
                        { v: 'cycle', t: 'Cycle' },
                        { v: 'wave', t: 'Wave' },
                        { v: 'ripple', t: 'Ripple' },
                        { v: 'spiral', t: 'Spiral' },
                        { v: 'saddle', t: 'Saddle' },
                        { v: 'dome', t: 'Dome' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Shape'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.shape' }}
                    type='string'
                    options={[
                        { v: 'sphere', t: 'Sphere' },
                        { v: 'box', t: 'Box' },
                        { v: 'cone', t: 'Cone' },
                        { v: 'capsule', t: 'Capsule' },
                        { v: 'cylinder', t: 'Cylinder' },
                        { v: 'mixed', t: 'Mixed' }
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
        </Panel>
    );
}
