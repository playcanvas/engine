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
            <Panel headerText='Renderer'>
                <LabelGroup text='Renderer'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'renderer' }}
                        value={observer.get('renderer') ?? 0}
                        options={[
                            { v: 0, t: 'Auto' },
                            { v: 1, t: 'Raster (CPU Sort)' },
                            { v: 2, t: 'Raster (GPU Sort)' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Anti-alias'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.antialias' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Scene'>
                <LabelGroup text='Skydome'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skydome' }}
                    />
                </LabelGroup>
                <LabelGroup text='Compact'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.compact' }}
                    />
                </LabelGroup>
                <LabelGroup text='Orientation'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.orientation' }}
                        type='number'
                        options={[
                            { v: 0, t: '0°' },
                            { v: 90, t: '90°' },
                            { v: 180, t: '180°' },
                            { v: 270, t: '270°' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Tone & Color'>
                <LabelGroup text='Tonemapping'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.tonemapping' }}
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
                <LabelGroup text='Exposure (EV)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.grading.exposure' }}
                        min={-10}
                        max={10}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Contrast'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.grading.contrast' }}
                        min={0.5}
                        max={1.5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Bloom'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.bloom.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Bloom Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.bloom.intensity' }}
                        min={0}
                        max={0.2}
                        precision={3}
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
        </>
    );
}
