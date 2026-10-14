import {
    BindingTwoWay,
    BooleanInput,
    Label,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import {
    TONEMAP_ACES,
    TONEMAP_ACES2,
    TONEMAP_FILMIC,
    TONEMAP_HEJL,
    TONEMAP_LINEAR,
    TONEMAP_NEUTRAL
} from 'playcanvas';

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
            <Panel headerText='Rendering'>
                <LabelGroup text='tonemapping'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.toneMapping' }}
                        type='number'
                        options={[
                            { v: TONEMAP_LINEAR, t: 'LINEAR' },
                            { v: TONEMAP_FILMIC, t: 'FILMIC' },
                            { v: TONEMAP_HEJL, t: 'HEJL' },
                            { v: TONEMAP_ACES, t: 'ACES' },
                            { v: TONEMAP_ACES2, t: 'ACES2' },
                            { v: TONEMAP_NEUTRAL, t: 'NEUTRAL' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Auto Exposure'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='exposure'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.readout' }}
                        value={observer.get('data.readout')}
                    />
                </LabelGroup>
                <LabelGroup text='compensation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.compensation' }}
                        min={-3}
                        max={3}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='min EV'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.minEv' }}
                        min={-10}
                        max={0}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='max EV'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.maxEv' }}
                        min={0}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Adaptation'>
                <LabelGroup text='dark to light'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.speedDarkToLight' }}
                        min={0.1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='light to dark'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.speedLightToDark' }}
                        min={0.1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Metering'>
                <LabelGroup text='low percent'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lowPercent' }}
                        min={0}
                        max={0.95}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='high percent'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.highPercent' }}
                        min={0.05}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='center weight'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.centerWeight' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='histogram'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.histogram' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
