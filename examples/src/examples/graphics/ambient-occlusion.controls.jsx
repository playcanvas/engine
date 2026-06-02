import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
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
            <LabelGroup text='enabled'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.enabled' }}
                />
            </LabelGroup>
            <Panel headerText='Ambient Occlusion'>
                <LabelGroup text='Type'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.type' }}
                        type='string'
                        options={[
                            { v: pc.SSAOTYPE_NONE, t: 'None' },
                            { v: pc.SSAOTYPE_LIGHTING, t: 'Lighting' },
                            { v: pc.SSAOTYPE_COMBINE, t: 'Combine' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='blurEnabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.blurEnabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='randomize'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.randomize' }}
                    />
                </LabelGroup>
                <LabelGroup text='radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.radius' }}
                        max={50}
                    />
                </LabelGroup>
                <LabelGroup text='samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.samples' }}
                        min={1}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.intensity' }}
                    />
                </LabelGroup>
                <LabelGroup text='power'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.power' }}
                        min={0.1}
                        max={10}
                    />
                </LabelGroup>
                <LabelGroup text='minAngle'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.minAngle' }}
                        max={90}
                    />
                </LabelGroup>
                <LabelGroup text='scale'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.scale' }}
                        options={[
                            { v: 1.0, t: '100%' },
                            { v: 0.75, t: '75%' },
                            { v: 0.5, t: '50%' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='TAA'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.taa' }}
                    />
                </LabelGroup>
                <LabelGroup text='debug'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ssao.debug' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
