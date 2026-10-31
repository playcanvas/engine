import {
    BindingTwoWay,
    ColorPicker,
    LabelGroup,
    BooleanInput,
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
            <Panel headerText='Global'>
                <LabelGroup text='Blend'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'blend' }}
                        min={0}
                        max={1}
                        precision={2}
                        step={0.01}
                    />
                </LabelGroup>
                <LabelGroup text='Exposure'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'exposure' }}
                        min={0}
                        max={3}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Brightness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'brightness' }}
                        min={0}
                        max={5}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Texture Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'textureScale' }}
                        min={0.25}
                        max={1}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Debug'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'debugRt' }}
                        value={observer.get('debugRt') ?? true}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Environment'>
                <LabelGroup text='Exposure'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'skyExposure' }}
                        min={0}
                        max={5}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Rotation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'envRotation' }}
                        min={0}
                        max={360}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
                <LabelGroup text='Skydome'>
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
            </Panel>
            <Panel headerText='Dir Light'>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lightIntensity' }}
                        min={0}
                        max={15}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lightColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'shadows' }}
                        value={observer.get('shadows') ?? true}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Omni Lights'>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'omniIntensity' }}
                        min={0}
                        max={5}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'omniRadius' }}
                        min={0.1}
                        max={20}
                        precision={1}
                        step={0.1}
                    />
                </LabelGroup>
                <LabelGroup text='Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'omniColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'omniShadows' }}
                        value={observer.get('omniShadows') || false}
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
