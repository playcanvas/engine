import React from 'react';

// @ts-ignore: library file import
import { Container, Button } from '@playcanvas/pcui/pcui-react';

interface MenuProps {
    lintErrors: boolean,
    hasEditedFiles: boolean,
    playButtonRef: any
}
const Menu = (props: MenuProps) => {

    let mouseTimeout: any = null;
    let clickFullscreenListener: EventListener = null;

    return <Container id='menu'>
        <img src='https://playcanvas.com/viewer/static/playcanvas-logo.png' />
        <Button icon='E256' text='' />
        <Button icon='E236' text='' />
        <Button icon='E259' text='' onClick={() => {
            window.open("https://github.com/playcanvas/engine");
        }}/>
        <Button icon='E127' text='' id='fullscreen-button' onClick={() => {
            if (clickFullscreenListener) {
                document.removeEventListener('mousemove', clickFullscreenListener);
            }
            document.querySelector('#canvas-container').classList.toggle('fullscreen');
            const app = document.querySelector('#appInner');
            app.classList.toggle('fullscreen');
            if (app.classList.contains('fullscreen')) {
                clickFullscreenListener = () => {
                    app.classList.add('active');
                    if (mouseTimeout) {
                        window.clearTimeout(mouseTimeout);
                    }
                    mouseTimeout = setTimeout(() => {
                        app.classList.remove('active');
                    }, 2000);
                };
                document.addEventListener('mousemove', clickFullscreenListener);
            }
        }}/>
        <Button id='play-button' enabled={!props.lintErrors && props.hasEditedFiles} icon='E131' text='' ref={props.playButtonRef} />
    </Container>;
};

export default Menu;
