import {
    BindingTwoWay,
    Button,
    BooleanInput,
    ColorPicker,
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
            </Panel>
            <Panel headerText='Effect'>
                <LabelGroup text='Whole Room'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'wholeRoom' }}
                    />
                </LabelGroup>
                <LabelGroup text='Style'>
                    <SelectInput
                        options={[
                            { v: 'ember', t: 'Ember' },
                            { v: 'plasma', t: 'Plasma' },
                            { v: 'mist', t: 'Mist' },
                            { v: 'smooth', t: 'Smooth' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'style' }}
                    />
                </LabelGroup>
                <Button
                    text='Restart'
                    onClick={() => {
                        observer.emit('restart');
                    }}
                />
                <LabelGroup text='Loop'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'loop' }}
                    />
                </LabelGroup>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'enabled' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Parameters'>
                <LabelGroup text='Duration'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'duration' }}
                        min={0.5}
                        max={6}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Noise Freq'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'noiseFrequency' }}
                        min={0.1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Edge Width'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'edgeWidth' }}
                        min={0.02}
                        max={0.5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Edge Color'>
                    <ColorPicker binding={new BindingTwoWay()} link={{ observer, path: 'edgeColor' }} />
                </LabelGroup>
                <LabelGroup text='Glow'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'glow' }}
                        min={1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Lift Distance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'liftDistance' }}
                        min={0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Wave Amount'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'waveAmplitude' }}
                        min={0}
                        max={0.3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Wave Freq'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'waveFrequency' }}
                        min={0}
                        max={15}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
