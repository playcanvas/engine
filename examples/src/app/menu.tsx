import React, { useEffect } from 'react';

// @ts-ignore: library file import
import Container from '@playcanvas/pcui/Container/component';
// @ts-ignore: library file import
import Button from '@playcanvas/pcui/Button/component';

interface MenuProps {
    useTypescript: boolean,
    setShowMiniStats: (value: boolean) => void
}
const Menu = (props: MenuProps) => {

    let mouseTimeout: any = null;
    let clickFullscreenListener: EventListener = null;

    const toggleFullscreen = () => {
        if (clickFullscreenListener) {
            document.querySelector('iframe').contentDocument.removeEventListener('mousemove', clickFullscreenListener);
        }
        document.querySelector('#canvas-container').classList.toggle('fullscreen');
        const app = document.querySelector('#appInner');
        app.classList.toggle('fullscreen');
        document.querySelector('iframe').contentDocument.getElementById('appInner').classList.toggle('fullscreen');
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
            document.querySelector('iframe').contentDocument.addEventListener('mousemove', clickFullscreenListener);
        }
    };

    useEffect(() => {
        const escapeKeyEvent = (e: any) => {
            if (e.keyCode === 27 && document.querySelector('#canvas-container').classList.contains('fullscreen')) {
                toggleFullscreen();
            }
        };
        document.querySelector('iframe').contentDocument.addEventListener('keydown', escapeKeyEvent);
        document.addEventListener('keydown', escapeKeyEvent);
    });

    return <Container id='menu'>
        <Container id='menu-buttons'>
            <img id='playcanvas-icon' src='https://playcanvas.com/viewer/static/playcanvas-logo.png' onClick={() => {
                window.open("https://github.com/playcanvas/engine");
            }}/>
            <Button icon='E256' text='' onClick={() => {
                const tweetText = encodeURI(`Check out this @playcanvas engine example! ${location.href.replace('#/', '')}`);
                window.open(`https://twitter.com/intent/tweet?text=${tweetText}`);
            }}/>
            <Button icon='E149' id='showMiniStatsButton' text='' onClick={() => {
                document.getElementById('showMiniStatsButton').classList.toggle('selected');
                props.setShowMiniStats(document.getElementById('showMiniStatsButton').classList.contains('selected'));
            }}/>
            <Button icon='E127' text='' id='fullscreen-button' onClick={toggleFullscreen}/>
        </Container>
    </Container>;
};

export default Menu;
