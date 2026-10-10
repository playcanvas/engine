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
        <>
            <Panel headerText='Scene Rendering'>
                <LabelGroup text='resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.scale' }}
                        min={0.5}
                        max={1}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Bloom'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.bloom' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Anti-Aliasing'>
                <LabelGroup text='method'>
                    <SelectInput
                        type='string'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.aa.method' }}
                        options={[
                            { v: 'none', t: 'None' },
                            { v: 'smaa', t: 'SMAA 1x' },
                            { v: 'taa', t: 'TAA' },
                            { v: 'msaa', t: 'MSAA 4x' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='TAA Settings'>
                <LabelGroup text='sharpness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.taa.sharpness' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='jitter'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.taa.jitter' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
