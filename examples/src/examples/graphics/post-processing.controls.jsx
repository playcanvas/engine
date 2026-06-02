import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
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
            <Panel headerText='Scene Rendering'>
                <LabelGroup text='resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.scale' }}
                        min={0.2}
                        max={1}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='background'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.background' }}
                        min={0}
                        max={50}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='emissive'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.emissive' }}
                        min={0}
                        max={400}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Tonemapping'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.tonemapping' }}
                        type='number'
                        options={[
                            { v: pc.TONEMAP_LINEAR, t: 'LINEAR' },
                            { v: pc.TONEMAP_FILMIC, t: 'FILMIC' },
                            { v: pc.TONEMAP_HEJL, t: 'HEJL' },
                            { v: pc.TONEMAP_ACES, t: 'ACES' },
                            { v: pc.TONEMAP_ACES2, t: 'ACES2' },
                            { v: pc.TONEMAP_NEUTRAL, t: 'NEUTRAL' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Debug'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.debug' }}
                        type='number'
                        options={[
                            { v: 0, t: 'NONE' },
                            { v: 1, t: 'BLOOM' },
                            { v: 2, t: 'VIGNETTE' },
                            { v: 3, t: 'SCENE' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='BLOOM'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.bloom.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.bloom.intensity' }}
                        min={0}
                        max={100}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='blur level'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.bloom.blurLevel' }}
                        min={1}
                        max={16}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Grading'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.grading.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='saturation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.grading.saturation' }}
                        min={0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='brightness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.grading.brightness' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='contrast'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.grading.contrast' }}
                        min={0.5}
                        max={1.5}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Color Enhance'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='shadows'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.shadows' }}
                        min={-3}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='highlights'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.highlights' }}
                        min={-3}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='midtones'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.midtones' }}
                        min={-1}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='vibrance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.vibrance' }}
                        min={-1}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='dehaze'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.dehaze' }}
                        min={-1}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Vignette'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.vignette.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='inner'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.vignette.inner' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='outer'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.vignette.outer' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='curvature'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.vignette.curvature' }}
                        min={0.01}
                        max={10}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.vignette.intensity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.vignette.color' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Fringing'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fringing.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fringing.intensity' }}
                        min={0}
                        max={100}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='TAA (Work in Progress)'>
                <LabelGroup text='enabled'>
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
