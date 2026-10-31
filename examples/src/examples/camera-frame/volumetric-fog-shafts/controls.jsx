import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
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
            <Panel headerText='Lights'>
                <LabelGroup text='Spot Lights'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lights.spot' }}
                    />
                </LabelGroup>
                <LabelGroup text='Omni Light'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lights.omni' }}
                    />
                </LabelGroup>
                <LabelGroup text='Scattering'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lights.intensity' }}
                        min={0}
                        max={60}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lights.shadows' }}
                    />
                </LabelGroup>
                <LabelGroup text='Video Cookie'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lights.cookie' }}
                    />
                </LabelGroup>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lights.animate' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Volumetric Fog'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.density' }}
                        min={0}
                        max={0.006}
                        precision={4}
                    />
                </LabelGroup>
                <LabelGroup text='Extinction'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.extinction' }}
                        min={0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Max Distance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.maxDistance' }}
                        min={200}
                        max={4000}
                        precision={0}
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
                <LabelGroup text='Steps'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.steps' }}
                        min={2}
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
            </Panel>
        </>
    );
}
