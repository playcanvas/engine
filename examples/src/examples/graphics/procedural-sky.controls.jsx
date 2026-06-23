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
            <Panel headerText='Time of Day'>
                <LabelGroup text='Hour'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.time.hour' }}
                        min={0}
                        max={24}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.time.animate' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Sky'>
                <LabelGroup text='Turbidity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.sky.turbidity' }}
                        min={1}
                        max={20}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Rayleigh'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.sky.rayleigh' }}
                        min={0}
                        max={4}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Exposure'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.sky.exposure' }}
                        min={0}
                        max={4}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Effects'>
                <LabelGroup text='SSAO'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.effects.ssao' }}
                    />
                </LabelGroup>
                <LabelGroup text='Bloom'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.effects.bloom' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Moon (night key light)'>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.moon.intensity' }}
                        min={0}
                        max={5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.moon.color' }}
                    />
                </LabelGroup>
                <LabelGroup text='Direction'>
                    <VectorInput
                        dimensions={3}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.moon.direction' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Night sky'>
                <LabelGroup text='Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.color' }}
                    />
                </LabelGroup>
                <LabelGroup text='Brightness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.brightness' }}
                        min={0}
                        max={0.3}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Star brightness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.starBrightness' }}
                        min={0}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Star density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.density' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Star size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.starSize' }}
                        min={0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Twilight glow'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.twilight' }}
                        min={0}
                        max={5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Moon size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.moonSize' }}
                        min={0}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Moon glow'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.night.moonGlow' }}
                        min={0}
                        max={40}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
