import {
    BindingTwoWay,
    BooleanInput,
    Button,
    Label,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useEffect, useRef, useState } from 'react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const fileInput = useRef(null);
    const [mode, setMode] = useState(observer.get('data.mode') ?? 'crowd');
    const [names, setNames] = useState(observer.get('data.animationNames') ?? []);

    useEffect(() => {
        // observer.on returns an EventHandle to unbind with - the observer has no 'off' method
        const events = [
            observer.on('data.mode:set', () => setMode(observer.get('data.mode'))),
            observer.on('data.animationNames:set', () => {
                setNames(observer.get('data.animationNames') ?? []);
            })
        ];
        return () => events.forEach((event) => event?.unbind());
    }, [observer]);

    return (
        <>
            <Panel headerText='Characters'>
                <LabelGroup text='Mode'>
                    <SelectInput
                        options={[
                            { v: 'single', t: 'Single' },
                            { v: 'crowd', t: 'Crowd' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.mode' }}
                    />
                </LabelGroup>
                <LabelGroup text='Material'>
                    <SelectInput
                        options={[
                            { v: 'shader', t: 'Shader' },
                            { v: 'standard', t: 'Standard' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.material' }}
                    />
                </LabelGroup>
                {mode === 'single' && (
                    <LabelGroup text='Animation'>
                        <SelectInput
                            key={names.join('|')}
                            type='number'
                            options={names.map((name, index) => ({ v: index, t: name }))}
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'data.animation' }}
                        />
                    </LabelGroup>
                )}
                {mode === 'single' && (
                    <LabelGroup text='Speed'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'data.speed' }}
                            min={0}
                            max={3}
                            step={0.05}
                        />
                    </LabelGroup>
                )}
                {mode === 'crowd' && (
                    <LabelGroup text='Count'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'data.count' }}
                            min={0}
                            max={10000}
                            precision={0}
                            step={100}
                        />
                    </LabelGroup>
                )}
                <LabelGroup text='Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.shadows' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Convert GLB' collapsible collapsed>
                <LabelGroup text='Sample FPS'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fps' }}
                        min={2}
                        max={60}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
                <LabelGroup text='Embed texture'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.embedTexture' }}
                    />
                </LabelGroup>
                <input
                    ref={fileInput}
                    type='file'
                    accept='.glb,.gltf,model/gltf-binary'
                    style={{ display: 'none' }}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                            observer.emit('glb:selected', file);
                        }
                        event.target.value = '';
                    }}
                />
                <Button text='Pick GLB...' onClick={() => fileInput.current?.click()} />
                <Button text='Save VAT' onClick={() => observer.emit('vat:save')} />
                <LabelGroup text='Status'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.status' }}
                        value={observer.get('data.status')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
