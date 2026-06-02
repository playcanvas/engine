import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    BooleanInput,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import * as pc from 'playcanvas';

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
            <Panel headerText='Full Body Layer'>
                <LabelGroup text='active state'>
                    <SelectInput
                        options={['Idle', 'Walk'].map(_ => ({ v: _, t: _ }))}
                        binding={new BindingTwoWay()}
                        link={{
                            observer,
                            path: 'fullBodyLayer.state'
                        }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Upper Body Layer'>
                <LabelGroup text='active state'>
                    <SelectInput
                        options={['Eager', 'Idle', 'Dance'].map(_ => ({ v: _, t: _ }))}
                        binding={new BindingTwoWay()}
                        link={{
                            observer,
                            path: 'upperBodyLayer.state'
                        }}
                    />
                </LabelGroup>
                <LabelGroup text='blend type'>
                    <SelectInput
                        options={[
                            { v: pc.ANIM_LAYER_OVERWRITE, t: 'Overwrite' },
                            { v: pc.ANIM_LAYER_ADDITIVE, t: 'Additive' }
                        ]}
                        value={pc.ANIM_LAYER_ADDITIVE}
                        binding={new BindingTwoWay()}
                        link={{
                            observer,
                            path: 'upperBodyLayer.blendType'
                        }}
                    />
                </LabelGroup>
                <LabelGroup text='use mask'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{
                            observer,
                            path: 'upperBodyLayer.useMask'
                        }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Options'>
                <LabelGroup text='blend'>
                    <SliderInput
                        min={0.01}
                        max={0.99}
                        binding={new BindingTwoWay()}
                        link={{
                            observer,
                            path: 'options.blend'
                        }}
                        value={0.5}
                    />
                </LabelGroup>
                <LabelGroup text='skeleton'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{
                            observer,
                            path: 'options.skeleton'
                        }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
