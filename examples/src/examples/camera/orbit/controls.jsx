import { BindingTwoWay, LabelGroup, Panel, SliderInput, VectorInput } from '@playcanvas/pcui/react';

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
                <LabelGroup text='Move speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.moveSpeed' }}
                        min={1}
                        max={10}
                    />
                </LabelGroup>
                <LabelGroup text='Zoom speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomSpeed' }}
                        min={0}
                        max={10}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Zoom pinch sensitivity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomPinchSens' }}
                        min={0}
                        max={10}
                        step={0.01}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Focus damping'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.focusDamping' }}
                        min={0}
                        max={0.999}
                        step={0.001}
                        precision={3}
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
                <LabelGroup text='Zoom damping'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomDamping' }}
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
                <LabelGroup text='Zoom range'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomRange' }}
                        dimensions={2}
                    />
                </LabelGroup>
                <LabelGroup text='Zoom scale min'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomScaleMin' }}
                        min={0}
                        max={1}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
