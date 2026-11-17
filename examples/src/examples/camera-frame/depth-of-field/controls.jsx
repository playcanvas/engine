import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput,
    Label
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
                <LabelGroup text='Debug'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.debug' }}
                        type='number'
                        options={[
                            { v: 0, t: 'NONE' },
                            { v: 1, t: 'BLOOM' },
                            { v: 2, t: 'VIGNETTE' },
                            { v: 3, t: 'DOF-COC' },
                            { v: 4, t: 'DOF-BLUR' },
                            { v: 5, t: 'SCENE' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Depth of Field'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Near Blur'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.nearBlur' }}
                    />
                </LabelGroup>
                <LabelGroup text='Focus Distance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.focusDistance' }}
                        min={0}
                        max={800}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Focus Range'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.focusRange' }}
                        min={0}
                        max={300}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='High Quality'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.highQuality' }}
                    />
                </LabelGroup>
                <LabelGroup text='Blur Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.blurRadius' }}
                        min={1}
                        max={20}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Blur Rings'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.blurRings' }}
                        min={2}
                        max={10}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Blur Ring Points'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.blurRingPoints' }}
                        min={2}
                        max={10}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='DOF Stats'>
                <LabelGroup text='Blur Samples'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.blurSamples' }}
                        value={observer.get('data.stats.blurSamples')}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='TAA (Work in Progress)'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.taa.enabled' }}
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
