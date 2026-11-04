import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import { DEPTHRESOLVE_MAX, DEPTHRESOLVE_MIN, DEPTHRESOLVE_SAMPLE0 } from 'playcanvas';

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
        <>
            <Panel headerText='Depth Fog'>
                <LabelGroup text='Split'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.split' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Resolve Mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.mode' }}
                        type='string'
                        options={[
                            { v: DEPTHRESOLVE_MIN, t: 'Min' },
                            { v: DEPTHRESOLVE_MAX, t: 'Max' },
                            { v: DEPTHRESOLVE_SAMPLE0, t: 'Sample 0' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Fog Density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.density' }}
                        min={0.01}
                        max={0.4}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Pixel Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.pixelScale' }}
                        min={1}
                        max={8}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.animate' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
