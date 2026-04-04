import { mount } from 'svelte';
import 'highlight.js/styles/atom-one-dark.css';
import './styles/themes.css';
import 'reveal.js/reveal.css';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
