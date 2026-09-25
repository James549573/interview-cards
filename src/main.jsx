import { render } from 'preact';
import { App } from './app.jsx';
import { registerSW } from 'virtual:pwa-register';
import './style.css';

registerSW({ immediate: true });

render(<App />, document.getElementById('app'));
