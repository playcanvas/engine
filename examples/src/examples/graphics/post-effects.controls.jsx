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
            <Panel headerText='BLOOM [KEY_1]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.bloom.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.bloom.bloomIntensity' }}
                    />
                </LabelGroup>
                <LabelGroup text='threshold'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.bloom.bloomThreshold' }}
                    />
                </LabelGroup>
                <LabelGroup text='blur amount'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.bloom.blurAmount' }}
                        min={1}
                        max={30}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='SEPIA [KEY_2]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.sepia.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='amount'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.sepia.amount' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='VIGNETTE [KEY_3]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.vignette.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='darkness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.vignette.darkness' }}
                    />
                </LabelGroup>
                <LabelGroup text='offset'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.vignette.offset' }}
                        max={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='BOKEH [KEY_4]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.bokeh.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='aperture'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.bokeh.aperture' }}
                        max={0.2}
                    />
                </LabelGroup>
                <LabelGroup text='max blur'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.bokeh.maxBlur' }}
                        max={0.1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='SSAO [KEY_5]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.ssao.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.ssao.radius' }}
                        max={10}
                    />
                </LabelGroup>
                <LabelGroup text='samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.ssao.samples' }}
                        max={32}
                    />
                </LabelGroup>
                <LabelGroup text='brightness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.ssao.brightness' }}
                    />
                </LabelGroup>
                <LabelGroup text='downscale'>
                    <SelectInput
                        options={[
                            { v: 1, t: 'None' },
                            { v: 2, t: '50%' },
                            { v: '4', t: '25%' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'scripts.ssao.downscale' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='POST-PROCESS UI [KEY_6]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.postProcessUI.enabled' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
