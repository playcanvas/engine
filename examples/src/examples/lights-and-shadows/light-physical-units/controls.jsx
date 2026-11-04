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
                <LabelGroup text='Rect (lm)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.rect.luminance' }}
                        min={0.0}
                        max={800000.0}
                    />
                </LabelGroup>
                <LabelGroup text='Point (lm)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.point.luminance' }}
                        min={0.0}
                        max={800000.0}
                    />
                </LabelGroup>
                <LabelGroup text='Spot (lm)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.spot.luminance' }}
                        min={0.0}
                        max={200000.0}
                    />
                </LabelGroup>
                <LabelGroup text='Spot angle'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.spot.aperture' }}
                        min={1.0}
                        max={90.0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Aperture (F/x)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.camera.aperture' }}
                        min={1.0}
                        max={16.0}
                    />
                </LabelGroup>
                <LabelGroup text='Shutter (1/x) s'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.camera.shutter' }}
                        min={1.0}
                        max={1000.0}
                    />
                </LabelGroup>
                <LabelGroup text='ISO'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.camera.sensitivity' }}
                        min={100.0}
                        max={1000.0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Scene'>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.camera.animate' }}
                    />
                </LabelGroup>
                <LabelGroup text='Physical'>
                    <BooleanInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.scene.physicalUnits' }}
                    />
                </LabelGroup>
                <LabelGroup text='Skylight'>
                    <BooleanInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.scene.sky' }}
                    />
                </LabelGroup>
                <LabelGroup text='Sky (lm/m2)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.sky.luminance' }}
                        min={0.0}
                        max={100000.0}
                    />
                </LabelGroup>
                <LabelGroup text='Sun (lm/m2)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.sun.luminance' }}
                        min={0.0}
                        max={100000.0}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
