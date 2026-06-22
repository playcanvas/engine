import {
    BindingTwoWay,
    LabelGroup,
    BooleanInput,
    Button,
    Panel,
    SelectInput,
    SliderInput,
    Label,
    TextInput
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
            <Panel headerText='Scene'>
                <LabelGroup text='URL'>
                    <TextInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'url' }}
                        value={observer.get('url') || ''}
                        placeholder='Enter gsplat URL...'
                    />
                </LabelGroup>
                <LabelGroup text='Orientation'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'orientation' }}
                        type='number'
                        options={[
                            { v: 0, t: '0°' },
                            { v: 90, t: '90°' },
                            { v: 180, t: '180°' },
                            { v: 270, t: '270°' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Environment'>
                    <SelectInput
                        type='string'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'environment' }}
                        value={observer.get('environment') || 'none'}
                        options={[
                            { v: 'none', t: 'None' },
                            { v: 'rosendal', t: 'Rosendal Sunset' },
                            { v: 'industrial-sunset', t: 'Industrial Sunset' },
                            { v: 'partly-cloudy', t: 'Partly Cloudy' },
                            { v: 'moonlit', t: 'Moonlit Sky' },
                            { v: 'sunflowers', t: 'Sunflowers' },
                            { v: 'table-mountain', t: 'Table Mountain' },
                            { v: 'cloud-layers', t: 'Cloud Layers' },
                            { v: 'night', t: 'Night Sky' }
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
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Camera Frame'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraFrame' }}
                        value={observer.get('cameraFrame') || false}
                    />
                </LabelGroup>
                <LabelGroup text='FOV'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraFov' }}
                        min={10}
                        max={360}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Fisheye'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'fisheye' }}
                        min={0}
                        max={1}
                        precision={4}
                        step={0.0001}
                    />
                </LabelGroup>
                <LabelGroup text='High Res'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'highRes' }}
                        value={observer.get('highRes') || false}
                    />
                </LabelGroup>
                <LabelGroup text='Tonemapping'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'toneMapping' }}
                        value={observer.get('toneMapping') ?? 0}
                        options={[
                            { v: 0, t: 'Linear' },
                            { v: 1, t: 'Filmic' },
                            { v: 2, t: 'Hejl' },
                            { v: 3, t: 'ACES' },
                            { v: 4, t: 'ACES2' },
                            { v: 5, t: 'Neutral' },
                            { v: 6, t: 'None' }
                        ]}
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
            </Panel>
            <Panel headerText='Settings'>
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
                <LabelGroup text='Min Pixel Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'minPixelSize' }}
                        min={0}
                        max={5}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Min Contribution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'minContribution' }}
                        min={0}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Alpha Clip'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'alphaClipForward' }}
                        min={0}
                        max={1}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Radial'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'radialSorting' }}
                        value={observer.get('radialSorting') ?? true}
                    />
                </LabelGroup>
                <LabelGroup text='Compact'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'compact' }}
                        value={observer.get('compact') || false}
                    />
                </LabelGroup>
                <LabelGroup text='LOD Preset'>
                    <SelectInput
                        type='string'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lodPreset' }}
                        value={observer.get('lodPreset') || 'desktop'}
                        options={[
                            { v: 'desktop-max', t: 'Desktop Max (0-5)' },
                            { v: 'desktop', t: 'Desktop (1-5)' },
                            { v: 'mobile-max', t: 'Mobile Max (2-5)' },
                            { v: 'mobile', t: 'Mobile (3-5)' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='LOD Base Dist'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lodBaseDistance' }}
                        min={1}
                        max={50}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='LOD Multiplier'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lodMultiplier' }}
                        min={1.2}
                        max={5}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Splat Budget'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={0}
                        max={40}
                        precision={1}
                        step={0.1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Debug'>
                <LabelGroup text='Debug Render'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'debug' }}
                        value={observer.get('debug') ?? 0}
                        options={[
                            { v: 0, t: 'None' },
                            { v: 1, t: 'LOD' },
                            { v: 2, t: 'SH Update' },
                            { v: 4, t: 'AABBs' },
                            { v: 5, t: 'Node AABBs' }
                        ]}
                    />
                </LabelGroup>
                <Button
                    text='Log Textures'
                    onClick={() => {
                        observer.emit('logTextures');
                    }}
                />
                <Button
                    text='Log Buffers'
                    onClick={() => {
                        observer.emit('logBuffers');
                    }}
                />
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Resolution'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.resolution' }}
                        value={observer.get('data.stats.resolution')}
                    />
                </LabelGroup>
                <LabelGroup text='GSplat Count'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.gsplats' }}
                        value={observer.get('data.stats.gsplats')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
