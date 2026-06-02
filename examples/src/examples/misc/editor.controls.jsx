import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SliderInput,
    SelectInput,
    ColorPicker
} from '@playcanvas/pcui/react';
import { useState } from 'react';

import * as pc from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [type, setType] = useState('translate');
    const [proj, setProj] = useState(pc.PROJECTION_PERSPECTIVE);

    // observe changes to the camera and gizmo type
    observer.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
        const [category, key] = path.split('.');
        switch (category) {
            case 'camera': {
                switch (key) {
                    case 'proj':
                        setType(value);
                        break;
                }
                break;
            }
            case 'gizmo': {
                switch (key) {
                    case 'type':
                        setType(value);
                        break;
                }
                break;
            }
        }
    });

    return (
        <>
            <Panel headerText='Transform'>
                <LabelGroup text='Type'>
                    <SelectInput
                        options={[
                            { v: 'translate', t: 'Translate' },
                            { v: 'rotate', t: 'Rotate' },
                            { v: 'scale', t: 'Scale' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.type' }}
                        onSelect={setType}
                    />
                </LabelGroup>
                {(type === 'translate' || type === 'rotate') && (
                    <LabelGroup text='Coord Space'>
                        <SelectInput
                            options={[
                                { v: 'world', t: 'World' },
                                { v: 'local', t: 'Local' }
                            ]}
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'gizmo.coordSpace' }}
                        />
                    </LabelGroup>
                )}
                <LabelGroup text='Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.size' }}
                        min={0.1}
                        max={10.0}
                    />
                </LabelGroup>
                <LabelGroup text='Snap Increment'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snapIncrement' }}
                        min={1}
                        max={10}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Projection'>
                    <SelectInput
                        options={[
                            { v: pc.PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                            { v: pc.PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'camera.proj' }}
                        onSelect={value => setProj((parseInt(value, 10) || 1) - 1)}
                    />
                </LabelGroup>
                {proj === pc.PROJECTION_PERSPECTIVE && (
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
            <Panel headerText='Grid'>
                <LabelGroup text='Resolution'>
                    <SelectInput
                        options={[
                            { v: 3, t: 'High' },
                            { v: 2, t: 'Medium' },
                            { v: 1, t: 'Low' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'grid.resolution' }}
                    />
                </LabelGroup>
                <LabelGroup text='Color X'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'grid.colorX' }}
                    />
                </LabelGroup>
                <LabelGroup text='Color Z'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'grid.colorZ' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='View Cube'>
                <LabelGroup text='Color X'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'viewCube.colorX' }}
                    />
                </LabelGroup>
                <LabelGroup text='Color Y'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'viewCube.colorY' }}
                    />
                </LabelGroup>
                <LabelGroup text='Color Z'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'viewCube.colorZ' }}
                    />
                </LabelGroup>
                <LabelGroup text='Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'viewCube.radius' }}
                        min={10}
                        max={50}
                    />
                </LabelGroup>
                <LabelGroup text='Text Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'viewCube.textSize' }}
                        min={1}
                        max={50}
                    />
                </LabelGroup>
                <LabelGroup text='Line Thickness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'viewCube.lineThickness' }}
                        min={1}
                        max={20}
                    />
                </LabelGroup>
                <LabelGroup text='Line Length'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'viewCube.lineLength' }}
                        min={10}
                        max={200}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
