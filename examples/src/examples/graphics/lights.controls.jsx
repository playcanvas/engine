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
            <Panel headerText='OMNI LIGHT [KEY_1]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.omni.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.omni.intensity' }}
                    />
                </LabelGroup>
                <LabelGroup text='shadow intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.omni.shadowIntensity' }}
                    />
                </LabelGroup>
                <LabelGroup text='cookie'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.omni.cookieIntensity' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='SPOT LIGHT [KEY_2]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.spot.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.spot.intensity' }}
                    />
                </LabelGroup>
                <LabelGroup text='shadow intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.spot.shadowIntensity' }}
                    />
                </LabelGroup>
                <LabelGroup text='cookie'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.spot.cookieIntensity' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='DIRECTIONAL LIGHT [KEY_3]'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.directional.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.directional.intensity' }}
                    />
                </LabelGroup>
                <LabelGroup text='shadow intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lights.directional.shadowIntensity' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
