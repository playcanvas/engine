import {
    BindingTwoWay,
    BooleanInput,
    Label,
    LabelGroup,
    Panel,
    SliderInput,
    ColorPicker,
    SelectInput,
    VectorInput
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
            <Panel headerText='Preset'>
                <LabelGroup text='Type'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'preset' }}
                        type='string'
                        options={[
                            { v: 'none', t: 'None' },
                            { v: 'snow', t: 'Snow' },
                            { v: 'rain', t: 'Rain' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Fog Density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'fogDensity' }}
                        min={0}
                        max={0.5}
                        precision={3}
                        step={0.001}
                    />
                </LabelGroup>
                <LabelGroup text='Exposure'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'exposure' }}
                        min={0}
                        max={5}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Splat Fog'>
                    <BooleanInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'useFog' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Animation'>
                <LabelGroup text='Speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'speed' }}
                        min={0}
                        max={40}
                        precision={2}
                        step={0.1}
                    />
                </LabelGroup>
                <LabelGroup text='Drift'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'drift' }}
                        min={0}
                        max={1}
                        precision={2}
                        step={0.01}
                    />
                </LabelGroup>
                <LabelGroup text='Angle'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'angle' }}
                        min={0}
                        max={360}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Particle Properties'>
                <LabelGroup text='Color'>
                    <ColorPicker binding={new BindingTwoWay()} link={{ observer, path: 'color' }} />
                </LabelGroup>
                <LabelGroup text='Opacity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'opacity' }}
                        min={0}
                        max={1}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Min Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'particleMinSize' }}
                        min={0}
                        max={1}
                        precision={2}
                        step={0.01}
                    />
                </LabelGroup>
                <LabelGroup text='Max Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'particleMaxSize' }}
                        min={0}
                        max={1}
                        precision={2}
                        step={0.01}
                    />
                </LabelGroup>
                <LabelGroup text='Elongate'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'elongate' }}
                        min={1}
                        max={20}
                        precision={1}
                        step={0.5}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Grid (rebuilds)'>
                <LabelGroup text='Extents'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'extents' }}
                        dimensions={3}
                    />
                </LabelGroup>
                <LabelGroup text='Density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'density' }}
                        min={0.5}
                        max={4}
                        precision={1}
                        step={0.1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Particles'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'particles' }}
                        value={observer.get('particles')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
