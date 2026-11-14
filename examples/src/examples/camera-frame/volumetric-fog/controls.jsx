import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SliderInput,
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
            <Panel headerText='Volumetric Fog'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Tint'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.tint' }}
                    />
                </LabelGroup>
                <LabelGroup text='Density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.density' }}
                        min={0}
                        max={0.02}
                        precision={4}
                    />
                </LabelGroup>
                <LabelGroup text='Height Base'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.heightBase' }}
                        min={-100}
                        max={200}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Height Falloff'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.heightFalloff' }}
                        min={0}
                        max={0.2}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Anisotropy'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.anisotropy' }}
                        min={0}
                        max={0.95}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.intensity' }}
                        min={0}
                        max={5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Ambient Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.ambientColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='Ambient'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.ambientIntensity' }}
                        min={0}
                        max={0.1}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Max Distance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.maxDistance' }}
                        min={100}
                        max={1000}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Steps'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.steps' }}
                        min={4}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Resolution Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.scale' }}
                        min={0.25}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='TAA'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.taa' }}
                    />
                </LabelGroup>
                <LabelGroup text='Soft Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.softShadows' }}
                    />
                </LabelGroup>
                <LabelGroup text='Light Rotation'>
                    <VectorInput
                        dimensions={2}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.rotation' }}
                        value={[78, 120]}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
