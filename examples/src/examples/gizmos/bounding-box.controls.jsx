import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useState } from 'react';

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [proj, setProj] = useState(PROJECTION_PERSPECTIVE);

    return (
        <>
            <Panel headerText='Theme'>
                <LabelGroup text='Base'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.base' }}
                    />
                </LabelGroup>
                <LabelGroup text='Occluded'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.occluded' }}
                    />
                </LabelGroup>
                <LabelGroup text='Fill'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.fill' }}
                    />
                </LabelGroup>
                <LabelGroup text='Primary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.primary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Secondary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.secondary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Tertiary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.tertiary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Corner'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.corner' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Layers'>
                <LabelGroup text='Edges'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.edges' }}
                    />
                </LabelGroup>
                <LabelGroup text='Handles'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.handles' }}
                    />
                </LabelGroup>
                <LabelGroup text='Readout'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.readout' }}
                    />
                </LabelGroup>
                <LabelGroup text='Icon'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.icon' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Render'>
                <LabelGroup text='Arm Length'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.armLength' }}
                        min={0.05}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Arm Thickness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.armThickness' }}
                        min={1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Padding'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.padding' }}
                        min={0}
                        max={0.5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Handle Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.handleSize' }}
                        min={2}
                        max={20}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Snap'>
                <LabelGroup text='Snap'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snap' }}
                    />
                </LabelGroup>
                <LabelGroup text='Increment'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snapIncrement' }}
                        min={0.05}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Projection'>
                    <SelectInput
                        options={[
                            { v: PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                            { v: PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'camera.proj' }}
                        onSelect={(value) => setProj((parseInt(value, 10) || 1) - 1)}
                    />
                </LabelGroup>
                {proj === PROJECTION_PERSPECTIVE && (
                    <LabelGroup text='FOV'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'camera.fov' }}
                            min={30}
                            max={100}
                        />
                    </LabelGroup>
                )}
            </Panel>
        </>
    );
}
