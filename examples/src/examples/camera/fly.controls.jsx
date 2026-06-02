import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SliderInput,
    VectorInput,
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
            <Panel headerText='Attributes'>
                <LabelGroup text='Rotate speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.rotateSpeed' }}
                        min={0.1}
                        max={1}
                        step={0.01}
                    />
                </LabelGroup>
                <LabelGroup text='Rotate joystick sensitivity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.rotateJoystickSens' }}
                        min={0}
                        max={10}
                        step={0.01}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Move speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.moveSpeed' }}
                        min={1}
                        max={10}
                    />
                </LabelGroup>
                <LabelGroup text='Move fast speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.moveFastSpeed' }}
                        min={1}
                        max={10}
                    />
                </LabelGroup>
                <LabelGroup text='Move slow speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.moveSlowSpeed' }}
                        min={1}
                        max={10}
                    />
                </LabelGroup>
                <LabelGroup text='Rotate damping'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.rotateDamping' }}
                        min={0}
                        max={0.999}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Move damping'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.moveDamping' }}
                        min={0}
                        max={0.999}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Pitch range'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.pitchRange' }}
                        dimensions={2}
                    />
                </LabelGroup>
                <LabelGroup text='Yaw range'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.yawRange' }}
                        dimensions={2}
                    />
                </LabelGroup>
                <LabelGroup text='Gamepad deadzone'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.gamepadDeadZone' }}
                        dimensions={2}
                    />
                </LabelGroup>
                <LabelGroup text='Mobile input layout'>
                    <TextInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.mobileInputLayout' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
