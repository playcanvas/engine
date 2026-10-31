import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import { PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F } from 'playcanvas';

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
            <Panel headerText='Scanner'>
                <LabelGroup text='Speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.speed' }}
                        min={10}
                        max={150}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Band width'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.bandWidth' }}
                        min={0.5}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Grid size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.gridSize' }}
                        min={1}
                        max={16}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Scene Maps'>
                <LabelGroup text='Renderer'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.renderer' }}
                        type='string'
                        options={[
                            { v: 'forward', t: 'Forward' },
                            { v: 'cameraFrame', t: 'CameraFrame' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Depth (frame)'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.depthSource' }}
                        type='string'
                        options={[
                            { v: 'prepass', t: 'Prepass' },
                            { v: 'scenePass', t: 'Scene pass (TAA)' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='MSAA (frame)'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.msaa' }}
                    />
                </LabelGroup>
                <LabelGroup text='Format (frame)'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.renderFormat' }}
                        type='number'
                        options={[
                            { v: PIXELFORMAT_111110F, t: 'RG11B10F' },
                            { v: PIXELFORMAT_RGBA16F, t: 'RGBA16F' },
                            { v: PIXELFORMAT_RGBA32F, t: 'RGBA32F' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
