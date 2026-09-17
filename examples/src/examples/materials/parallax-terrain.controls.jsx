import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import {
    PARALLAX_OCCLUSION,
    PARALLAX_OFFSET,
    SHADOW_PCF1_32F,
    SHADOW_PCF3_32F,
    SHADOW_PCF5_32F,
    SHADOW_VSM_32F,
    SHADOW_PCSS_32F
} from 'playcanvas';

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
            <Panel headerText='Parallax'>
                <LabelGroup text='Mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.mode' }}
                        type='string'
                        options={[
                            // 'none' is not an engine mode - the example unassigns the height map
                            { v: 'none', t: 'None' },
                            { v: PARALLAX_OFFSET, t: 'Offset' },
                            { v: PARALLAX_OCCLUSION, t: 'Occlusion' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.samples' }}
                        min={1}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Self Shadow'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.selfShadowSamples' }}
                        min={0}
                        max={32}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Height'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.height' }}
                        min={0.0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Base'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.base' }}
                        min={0.0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Light'>
                <LabelGroup text='Rotation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lightRotation' }}
                        min={0}
                        max={360}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.animate' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shadow Type'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.shadowType' }}
                        type='number'
                        options={[
                            { v: SHADOW_PCF1_32F, t: 'PCF1_32F' },
                            { v: SHADOW_PCF3_32F, t: 'PCF3_32F' },
                            { v: SHADOW_PCF5_32F, t: 'PCF5_32F' },
                            { v: SHADOW_VSM_32F, t: 'VSM_32F' },
                            { v: SHADOW_PCSS_32F, t: 'PCSS_32F' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Num Cascades'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.numCascades' }}
                        min={1}
                        max={4}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
