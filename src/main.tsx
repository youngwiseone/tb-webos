import {render} from 'preact';
import {App} from './app';
import {applyTokens} from './theme/tokens';
import './theme/global.css';
import './theme/retro.css';
import './theme/network.css';

applyTokens();
render(<App />, document.getElementById('root')!);
