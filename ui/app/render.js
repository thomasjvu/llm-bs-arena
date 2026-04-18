import { SLOT_IDS, buildTurnRibbon } from './layout.js';
import { EXPERIMENTS } from './experiments.js';

const JUDGE_SCRIBBLE_SVG = String.raw`<svg version="1.1" viewBox="0 0 48 48" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" d="M33.191,16.825c4.108,4.482-5.229,14.317-7.718,12.323c-2.491-1.991,2.739-3.734,0.746-4.854C24.229,23.175,5.679,28.776,6.8,31.516c1.12,2.738,3.237,1.119,4.481,3.11c1.245,1.992,8.217,11.828,13.071,8.218c4.856-3.611-1.867-9.709-0.622-14.939c1.246-5.227,6.722-7.966,4.854-9.709s-13.319-4.98-16.93-6.724c-3.61-1.742-9.087-2.239-9.087,2.491s-0.996,8.341,2.613,8.341c3.611,0,2.863-13.943,10.832-16.682c7.967-2.739,25.022-0.374,24.026,1.246c-0.996,1.618-21.537,6.474-23.03,11.826C15.514,24.046,3.563,36.37,1.944,30.02c-1.618-6.347,11.33-14.314,17.18-12.074c5.852,2.241,5.354,2.615,3.486,4.358c-1.867,1.743-3.113,12.323,4.357,13.071c7.47,0.747,16.185-5.354,16.185-10.456c0-5.105,0.248-11.206-5.104-13.944c-5.354-2.737-4.73-3.237-7.47-2.863c-2.739,0.374-3.361,0.498-4.856,2.365c-1.493,1.867-8.091,10.582-1.119,10.458s-1.37-5.228-3.361-7.967c-1.993-2.739,13.693-3.487,15.811,0.996c2.115,4.48,8.838,7.22,7.966,10.831c-0.87,3.611-8.963,18.798-20.415,13.568c-11.454-5.227-3.361-12.947-1.246-12.696c2.117,0.248,14.939,0.748,17.304-5.229c2.365-5.976,8.341-15.188,3.984-15.811c-4.356-0.624-12.076,1.743-12.823,2.365"><animate attributeName="d" begin="0s" dur="0.24s" values="M16,24.2c-0.7,2.5-0.7,5.2-0.1,7.7c5-1.8,7.6-8.3,5.1-13c-3.4,1.9-5.5,5.7-6.3,9.6s-0.3,7.9,0.3,11.8c1.3,1.2,3.4,1.1,4.9,0.2c1.5-0.9,2.5-2.4,3.4-3.8c0.7-1.2,1.3-2.4,1.7-3.7c1.3-5-2.2-10.1-6.4-13.2c-3.1-2.2-7.5-3.7-10.4-1.2c-2.4,2.1-2,6.6,0.7,8.2c1.6,0.9,3.6,0.9,5.4,0.8c10.6-0.8,21-4.5,29.7-10.8C36.4,14,27,17.7,23.5,25c0,2.3,2,4.3,4.3,4.3c0.9,0,1.7-0.3,2.6-0.6C35.6,26.9,41,23,41.4,17.5c-3-4.2-8.9-6-13.6-4.2c-1.4,0.5-2.6,1.3-3.8,2.1c-5.9,4.3-9.8,11.2-10.5,18.5c-0.2,2.6-0.1,5.3,1.4,7.4s4.7,3.1,6.8,1.7c0-3.7-2.1-7.3-5.3-9.2C22,34,27.6,33,32.9,31c3.1-1.2,6.5-3.3,6.7-6.7c0.2-2.7-1.9-5-3.9-6.9c-3.4-3.3-7-6.5-10.7-9.6c-1.7-1.4-3.8-2.9-5.9-2.5c-0.8,2.6,0.2,5.5,1.2,8c4,9.6,8.8,18.8,14.3,27.6;M22.6,23.9c-0.4,1.1-0.5,2.4-0.2,3.5c0.8,0.1,1.6-0.4,2-1.1c0.4-0.7,0.6-1.5,0.6-2.3c0-0.9-0.1-1.8-0.5-2.5c-0.4-0.7-1.3-1.3-2.1-1.2c-0.8,0.1-1.5,0.8-1.9,1.5c-0.5,1-0.7,2.1-0.5,3.2c0.3,1.1,1.1,2,2.1,2.4c0.8,0.3,1.7,0.2,2.6,0c1.4-0.3,2.9-0.6,4-1.6c1.1-0.9,1.7-2.5,1.1-3.8c-0.2-0.5-0.6-0.9-1.1-1.3c-2.3-2.1-5.4-3.2-8.4-3c-2.5,0.1-4.9,1-7,2.2c-1.1,0.6-2.4,1.3-3.6,1c2-3.9,3.6-7.9,4.8-12.1c0.2-0.6,0.4-1.3,0.3-2s-0.5-1.3-1.1-1.5C11.9,5.8,10.4,7.3,9.3,9c-1.3,2-2.2,4.7-1.1,6.8c0.6,1.2,1.8,2,3,2.6c3.6,1.9,7.8,2.5,11.8,1.7s7.6-3,10.2-6.2c0.7-0.9,1.4-2,1.5-3.2c-0.2-0.2-0.4-0.3-0.6-0.5c-3.8,2-6.3,6.1-6.5,10.3c0,0.5,0,0.9,0.1,1.4c0.4,1.6,1.9,2.6,3.5,2.8c1.6,0.2,3.2-0.4,4.6-1.1c2.7-1.4,5.2-3.7,5.7-6.7c0.1-0.3,0.1-0.7,0-1c-0.1-0.7-0.7-1.3-1.2-1.9c-0.2-0.2-0.5-0.5-0.7-0.7c-0.6-0.6-1.2-1.2-2-1.4c-0.9-0.2-1.9,0.3-2.7,0.7c-1,0.5-2.1,1.1-3,1.8c-0.7,0.5-1.3,1.1-1.9,1.7c-5.1,5.2-8.3,12.2-8.8,19.4c-3.9-0.7-7.7-2.3-10.9-4.7C9,30,7.8,28.7,7.9,27.2c1.2-0.4,2.6-0.4,3.9-0.5c3.8-0.2,7.7-0.6,11.3-1.7s7.1-3.2,9.5-6.2c0.5-0.6,0.9-1.3,1-2c0.1-0.4,0-0.8,0-1.1c-0.2-1.4-0.6-2.7-1.2-4c-1.8-3.3-5.5-5.6-9.3-5.5c-3,0.1-5.8,1.7-7.5,4.1c2.7,1.9,6.2,1.7,9.4,1.6s6.9,0.1,9.2,2.4c2.2,2.2,2.5,5.6,2.1,8.6c-0.2,2-0.7,4.1-1.4,6c-1,2.8-2.4,5.4-3.9,8c-0.9,1.6-1.9,3.3-3.6,4c-3.7-5.2-7.9-10.2-12.5-14.6c-0.1-0.1-0.2-0.2-0.2-0.4c0-0.2,0.3-0.4,0.5-0.5c3.3-1.4,6.5-2.9,9.6-4.6c2.1-1.1,4.2-2.4,5.7-4.2c0.7-0.8,1.3-1.9,1.1-3c-0.1-0.5-0.3-1-0.6-1.4c-1.7-2.7-5.1-4.1-8.2-3.8s-6.1,1.8-8.5,3.9c-2.2,1.9-4,4.3-4.6,7.2c-0.2,0.9-0.2,1.8,0.2,2.6c0.6,1.3,2.2,2,3.7,2c1.2,0,2.4-0.2,3.5-0.8c-3.8,1.2-6.1,5-7.2,8.8c-0.1,0.2-0.1,0.5-0.1,0.7c0,0.3,0.1,0.5,0.2,0.7c0.5,1.3,1.3,2.8,2.7,2.7;M19.8,39.5c0.5,1.4,0.9,2.9,1.4,4.3c3.2-5.1,3.6-11.9,1-17.4c-2.7,3.6-4,8.3-3.4,12.8c1.3-0.2,2.1-1.5,2.6-2.6C26.1,26.9,8.4,15.1,7.4,4.4C29.1,0.5,7.1,34.3,8,26.8c-0.1,1.1,0.9,2.1,1.6,3c2.1,2.5,6,2.9,9.1,1.8c3.1-1.2,5.5-3.6,7.8-6c-0.7,3.5-0.9,7.1-0.8,10.7c0,1.6,0.6,3.7,2.2,3.8c2.2-4,2.5-9,0.8-13.3c-1.8-4.2-5.5-7.6-9.9-8.9c-1.5,2.9-2.8,6.7-0.6,9.1c2.1,2.2,5.8,1.3,8.5-0.1c4.9-2.6,9.2-6.4,12.3-10.9c1-1.5,2-3.3,1.5-5.1c-0.7-2.9-4.8-3.7-7.2-2c-2.3,1.6-3.1,5-1.9,7.5c1.2,2.5,4.3,3.9,7,3.2c0-0.6,0-1.2,0-1.9c-5.7-2.1-12.3-0.2-17,3.6s-8,9.1-10.7,14.5c-1.2,2.4-2.4,5.2-1.5,7.7c4.4-5.4,3.7-13.1,3.9-20.1c0.1-3,0.6-6.5,3.1-8.2c1.7-1.2,3.9-1.2,6-1.4c3.7-0.4,7.3-1.3,10.6-2.9c-6,0.2-12.1,0.5-17.9-1c4.2,2,8.3,4.4,12,7.3c3,2.3,6,5.3,6.2,9.1c0.2,3.1-1.7,6-4.1,7.8c-2.4,1.8-5.5,2.8-8.4,3.5c-2.3,0.5-5.3,0.6-6.2-1.5c-0.4-0.9-0.3-2-0.1-2.9c0.5-2.8,1.2-5.5,2.2-8.2c1-2.7,2.2-5.3,4.5-7.1s5.7-2.2,7.8-0.4;M22.7,25.9c-1.1,1.5-1.5,3.5-1.1,5.3c1.8-1,3.1-3,2.8-5s-2.4-3.7-4.3-3.2c-1.3,0.4-2.2,1.6-2.6,2.9c-0.3,1.3-0.2,2.7,0.2,4c0.1,0.5,0.3,1,0.7,1.3c0.3,0.2,0.7,0.3,1.1,0.3c4.4,0.2,8.5-3.7,9-8.1c0.5-4.4-2.2-8.8-6-11c-1.3-0.8-2.8-1.3-4.3-1.2c-3,0.1-5.4,2.6-6.8,5.3c-0.9,1.9-1.5,4-1.6,6.1c0,0.7,0,1.3,0.1,1.9c0.6,2.6,3.5,4.2,6.2,4c2.7-0.3,5-2,6.7-4c1.6-1.9,3-4.3,2.8-6.8s-2.2-5-4.7-5c-2.7,0-4.6,2.6-5.8,5.1c-1.1,2.3-2,4.7-2.2,7.2s0.6,5.2,2.5,6.9c2.4,2.2,6.1,2.4,9.3,1.9c4.1-0.7,7.9-2.4,11.2-4.8c0.8-0.6,1.7-1.4,1.9-2.4c0.3-1.8-1.5-3.2-3.2-3.9c-3.9-1.4-8.3-0.8-12,1.1s-6.7,4.8-9.3,8c-1.1,1.4-2.1,3.3-1.2,4.8c0.5,0.9,1.6,1.3,2.7,1.3s2-0.4,3-0.9c2.6-1.2,5.1-2.7,7.4-4.5c1.5-1.2,2.9-2.5,3.8-4.1c0.9-1.7,1.2-3.7,0.5-5.4c-0.9-2.2-3.5-3.5-5.9-3.3S19,21.1,17.5,23s-2.6,4.1-3.4,6.4c-0.9,2.5-1.8,5.1-1.4,7.7s2.3,5.2,4.9,5.5c1.7,0.2,3.3-0.5,4.8-1.3c5-2.8,8.9-7.4,10.9-12.8s2-11.4,0.1-16.7c-0.9-2.4-2.4-4.9-4.8-5.6c-1.9-0.5-3.9,0.1-5.4,1.3s-2.5,2.9-3.3,4.7c-1.4,3.4-1.9,7.1-1.5,10.7c0.3,2.4,1.1,4.9,3.1,6.3c2,1.4,5.3,0.8,6-1.5c0.4-1.3-0.1-2.7-1-3.6c-0.9-0.9-2.3-1.4-3.6-1.5c-0.7-0.1-1.5,0-2.2,0.4c-0.6,0.4-1,1-1.4,1.7c-2.1,4.1-2,9.2,0.3,13.1c2-2.4,1.8-6.3-0.4-8.5c0.1,2.2,1.5,4.3,3.5,5.4;M19,40.1c0,0.6-0.9,0.2-1.2-0.3c-3.3-5.5-6.7-11-9-16.9C14.6,29,21.5,34.3,29,38.4c-4-7.4-7.7-15.1-8.4-23.4c1.9,0.4,3.5,1.7,5,3c4.5,3.9,8.9,8,13.2,12.1c-7.7-4-12.4-12.1-15.6-20.1c4.2,3.2,8.4,6.4,12.8,9.4c1.5,1,3,2,4.8,2.2c1-2.8,2.2-5.5,3.5-8.1c-0.9-0.8-2.3-0.2-3.2,0.5c-7.7,5.6-14.9,12-22,18.3c4.6-4.9,9.2-9.8,13.8-14.8c1.6-1.7,3.3-3.7,2.8-6c-1.7-0.8-3.6,0.2-5.2,1.1C25,16,19.7,19.7,14.6,23.7c4.2-5.6,10.1-10.1,13.7-16.1C27,7.3,25.7,8.2,24.7,9C16.7,15.3,9.6,22.7,3.7,31c2,0.6,4.2-0.5,6-1.5c8.3-4.8,16.6-9.6,24.9-14.4c-4.6,4.8-9,9.8-13,15.1c-1.2,1.6-2.4,3.3-2.4,5.3c2.5,0,4.8-1.6,6.8-3.1c4.7-3.5,9.4-7,13.2-11.5c-3.5,2.6-6.1,6.4-7.1,10.6c-0.3,1.4-0.4,3.1,0.5,4.1c0.8,0.9,2.1,1.1,3.2,0.9c1.1-0.3,2.1-1,3-1.7c1.9-1.8,3.4-4.1,3.8-6.6c0.7-4.1-1.7-8.5-5.4-10.3c-3.8-1.8-8.6-0.7-11.4,2.4C25.2,21,24.6,22,24,23c-1.4,2.3-2.6,4.7-3.2,7.3s-0.4,5.5,1,7.8c0.6,1,1.6,2,2.8,2.1c1,0.1,1.9-0.3,2.8-0.8c4.7-2.6,8-7.6,8.5-12.9c0.5-5.3-1.8-10.9-5.9-14.3c-4.1,3.6-4.9,9.8-3.7,15c0.7,2.9,2.1,5.8,4.5,7.6s6,2.1,8.3,0.2;M24.7,24.3c0,0.6-0.3,1.1-0.4,1.7c-0.1,0.6,0.2,1.3,0.8,1.3c0.2,0,0.4-0.2,0.6-0.3c1.9-1.6,2-4.8,0.3-6.6c-0.4-0.4-1-0.8-1.6-0.7c-0.3,0.1-0.6,0.2-0.8,0.4c-2.7,2.1-3.1,6.6-0.8,9.1c3.2,0,6.2-2.5,6.9-5.7S29.4,17,27,14.8c-1.7-1.6-4.2-2.5-6.3-1.6c-1.6,0.8-2.5,2.5-3.2,4.1c-1,2.4-2,4.8-2,7.4c0,2.6,1,5.3,3.2,6.7c2.9,1.9,7,0.8,9.7-1.4c2.1-1.7,3.8-4.3,3.6-7c-0.1-1.9-1.1-3.6-2.1-5.2c-1.5-2.3-3.4-4.6-6-5.4c-3.3-1.1-7.1,0.5-9.5,3.1s-3.3,6.2-3.9,9.7c-0.2,1.1-0.3,2.3,0,3.4c0.3,1,0.9,1.8,1.5,2.6c2.4,2.5,6,3.6,9.4,3.4c3.4-0.2,6.7-1.6,9.7-3.3c1.2-0.7,2.3-1.4,3.2-2.4c2.2-2.2,3.1-5.5,2.5-8.5c-1.1-5.2-6.5-8.7-11.8-8.4c-5.3,0.2-10,3.6-13,7.9c-0.9,1.3-1.7,2.8-2.1,4.3c-0.6,2-0.6,4.1-0.6,6.2c0,0.8,0,1.6,0.3,2.4c0.2,0.5,0.4,0.9,0.7,1.3c1.1,1.8,2.4,3.7,4.3,4.7c2,1.1,4.5,1.1,6.8,0.8c3.9-0.5,7.7-1.7,10.9-4.1c3.2-2.3,5.5-5.8,6-9.7c0.7-6-3.1-11.7-7.9-15.4c-0.6-0.5-1.3-0.9-2-1.2c-0.7-0.3-1.4-0.4-2.2-0.5c-1.7-0.3-3.4-0.5-5.1-0.2c-1.5,0.3-2.8,1-4,1.8c-3.8,2.5-6.9,5.9-8.8,10s-2.4,8.9-1.1,13.2c0.8,2.6,2.2,5.1,4,7.1c0.9,0.9,1.9,1.8,3.1,2.3c1.5,0.7,3.3,0.8,4.9,0.7c4.8-0.2,9.6-1.5,13.4-4.4c3.8-2.8,6.6-7.2,7-12c0.4-5.1-2-10.3-6.2-13.3c-5.1-3.5-12.4-3.4-17.3,0.4c-2.4,1.9-4.2,4.5-5.2,7.3c-1,2.9-1.3,6.1-0.3,8.9c1.1,2.9,3.5,5.3,6.5,6.2c4.9,1.5,10.2-0.9,14.3-4c1.6-1.3,3.2-2.7,4.2-4.5c1.4-2.6,1.4-5.9,0.3-8.7c-1.1-2.8-3.2-5.1-5.8-6.7c-4.5-2.9-11-3.3-14.7,0.4c-0.6,0.6-1.1,1.3-1.6,2c-1.1,1.4-2.2,2.9-2.8,4.5C10,23,10.7,27,13,29.7s6.1,4.1,9.6,3.6c1.8-0.3,3.5-0.9,5.1-1.8c3.3-1.8,6.3-4.9,6.3-8.6c0-2.4-1.3-4.6-2.7-6.5c-1.2-1.7-2.8-3.4-4.9-3.6c-2.2-0.2-4.1,1.3-5.5,3c-1.6,2.1-2.7,4.7-3,7.4c-0.2,1.6,0,3.4,1.2,4.4c1.2,1.1,3.3,1,4.6-0.2c1.2-1.1,1.7-2.9,1.4-4.6c-0.3-1.6-1.3-3.1-2.5-4.2c-1.6,0.4-2.2,2.3-2.5,3.9c-0.3,1.9-0.4,4.1,1,5.5c1.6,1.6,4.4,1,6.1-0.5c1-0.9,1.8-2.2,1.8-3.6c0-1.4-0.9-2.8-2.2-3.2c-1.3-0.4-2.7,0.3-3.4,1.4c-0.7,1.1-0.8,2.6-0.4,3.8c2.2-0.3,4.1-1.8,4.9-3.9C27.4,23.1,23.7,24.6,24.7,24.3z;M12.8,34.9c2.7-7.6,5.5-15.2,8.2-22.7c0.6-1.6,1.2-3.3,1.9-4.8c2.1,4.5,4.2,8.9,6.4,13.4c1,2,2.1,4.1,3.6,5.8c1.7,2,3.9,3.4,6.1,4.8c-5.4-0.2-10.7-2-15.5-4.6s-9.1-5.9-13.4-9.2c9.4-4.1,18.7-8.2,28.1-12.3c-6.9,7.2-12.8,15.5-17.4,24.4c-0.9,1.8-1.8,3.6-1.9,5.6c-0.1,2,0.7,4.1,2.4,5.1c-6.4-3.5-11-9.4-15.4-15.2c-0.8-1-1.6-2.2-1.5-3.6c0.2-1.4,1.4-2.3,2.6-3.1c2.3-1.5,4.8-3,7.5-3.8s5.7-0.8,8.2,0.4c3.8,1.9,5.7,6.3,6.3,10.5c0.3,1.9,0.4,4-0.3,5.8c-1.4,3.4-6,5.1-9.3,3.3c-0.5-0.3-0.9-0.6-1.3-1.1c-0.8-1.1-0.6-2.7,0.1-3.8s1.9-1.9,3.1-2.5c5-2.7,10.9-3.7,16.5-2.8c1.2,0.2,2.5,0.5,3.4,1.3c0.9,0.8,1.4,2.2,0.9,3.3c-0.6,1.1-2,1.4-3.2,1.6c-7,1.2-14.1,2-21.1,2.6c-2.7,0.2-5.4,0.4-8-0.2c0.9-1.9,2.4-3.6,3.9-5.2c4.7-5,9.9-9.7,15.3-13.9c1.8-1.4,3.8-2.9,4.3-5.2C28.1,8.3,22.8,7.3,17.6,6c5.6,4.4,10.9,9.1,16,14c0.8,0.8,1.7,1.6,2.3,2.6c1,1.6,1.3,3.6,1.3,5.5c0,2.5-0.4,4.9-1.2,7.3c-1.4-0.5-1.4-2.4-1-3.9c1.7-6.9,5-13.6,4.7-20.8c-0.1-1.2-0.2-2.4-0.8-3.4c-0.6-1-1.7-1.8-2.9-1.8c-1.8,0.1-2.9,1.9-3.7,3.4c-3.2,6-6.8,11.7-10.7,17.2c-1,1.3-2.5,2.8-4,2.2c-0.6-0.3-1-0.8-1.4-1.4c-3.2-4.8-4.9-10.7-4.7-16.5c0.7,0.1,1.2,0.8,1.5,1.5c3.4,6.7,6.3,13.7,8.7,20.9c0.8,2.3,1.5,4.7,3.1,6.7;M6.9,6.4c0.2,11,0.3,22.1,0.3,33.1c10.8-3.9,23.5,1.5,34-3c0.3,0.2,0.6,0.4,0.8,0.6c-1.3-1.1-1.6-3-1.8-4.7c-1.1-9-1.6-18.2-1.6-27.3c-8.8,0.5-17.5,0.7-26.3,0.4c0.5,10.1,0.9,20.1,1.1,30.2c7.8-2.4,16-3.4,24.1-3c-0.6-8.1-0.4-16.3,0.6-24.3c-6.5,2.4-13.7,2.8-20.4,1.1c1.5,7.7,2.1,15.5,1.9,23.3c5.1-1.2,10.2-2.4,15.3-3.6c-0.6-3.8-0.7-7.7-0.1-11.5c0.1-0.8,0.2-1.7-0.3-2.2c-0.4-0.4-1.1-0.5-1.7-0.5c-3.3-0.1-6.6,0.3-9.7,1.4c0,3.1,0.1,6.2,0.1,9.4c3.1,0.8,6.3-0.8,9.1-2.3c1.8-1,3.9-2.5,3.5-4.5c0-0.2-0.1-0.4-0.3-0.5c-0.2-0.2-0.5-0.2-0.8-0.1c-2.9,0.4-5.3,2.3-7.8,3.9c-7.3,4.5-16.2,5.6-24.8,6.4c4.4-2.2,8.7-4.3,13.1-6.5c6-3,12-5.9,17.7-9.3c0.8-0.5,1.7-1,2.2-1.8c0.5-0.8,0.7-2,0-2.7c-8.1-0.6-16.3,2-22.6,7.2c4.8-4.1,10.2-7.4,16-10c0.7,1,0.3,2.5-0.1,3.6c-2.7,7.2-6.6,14-8.1,21.5c-0.3,1.5-0.5,3.1,0.4,4.3c0.7,1,2,1.4,3.3,1.4c1.2-0.1,2.4-0.6,3.5-1.2c5.1-2.9,8.7-8.1,10-13.8c1.3-5.7,0.3-11.8-2.4-16.9c1.2,11.4,2.3,22.8,3.5,34.2c0.2,1.8,0.3,3.7-0.7,5.2;M16,24.2c-0.7,2.5-0.7,5.2-0.1,7.7c5-1.8,7.6-8.3,5.1-13c-3.4,1.9-5.5,5.7-6.3,9.6s-0.3,7.9,0.3,11.8c1.3,1.2,3.4,1.1,4.9,0.2c1.5-0.9,2.5-2.4,3.4-3.8c0.7-1.2,1.3-2.4,1.7-3.7c1.3-5-2.2-10.1-6.4-13.2c-3.1-2.2-7.5-3.7-10.4-1.2c-2.4,2.1-2,6.6,0.7,8.2c1.6,0.9,3.6,0.9,5.4,0.8c10.6-0.8,21-4.5,29.7-10.8C36.4,14,27,17.7,23.5,25c0,2.3,2,4.3,4.3,4.3c0.9,0,1.7-0.3,2.6-0.6C35.6,26.9,41,23,41.4,17.5c-3-4.2-8.9-6-13.6-4.2c-1.4,0.5-2.6,1.3-3.8,2.1c-5.9,4.3-9.8,11.2-10.5,18.5c-0.2,2.6-0.1,5.3,1.4,7.4s4.7,3.1,6.8,1.7c0-3.7-2.1-7.3-5.3-9.2C22,34,27.6,33,32.9,31c3.1-1.2,6.5-3.3,6.7-6.7c0.2-2.7-1.9-5-3.9-6.9c-3.4-3.3-7-6.5-10.7-9.6c-1.7-1.4-3.8-2.9-5.9-2.5c-0.8,2.6,0.2,5.5,1.2,8c4,9.6,8.8,18.8,14.3,27.6" repeatCount="indefinite" /></path></svg>`;

function byRole(root, role) {
  return root.querySelector(`[data-role="${role}"]`);
}

function setText(element, value) {
  if (element) element.textContent = value ?? '';
}

function clearNode(node) {
  if (node) node.textContent = '';
}

function shortenName(value) {
  if (!value) return 'Unknown';
  return value.length > 24 ? `${value.slice(0, 21)}...` : value;
}

function cleanReasoning(text) {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\[think\][\s\S]*?\[answer\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

function getPlayerName(player) {
  if (player?.displayName) return player.displayName;
  if (player?.modelId) return window.ModelThemes.getTheme(player.modelId).shortName || shortenName(player.modelId);
  return 'Unknown';
}

function getShortModelName(modelId, fallback = 'Unknown') {
  if (!modelId) return fallback;
  return window.ModelThemes.getTheme(modelId).shortName || fallback;
}

function getPlayerById(state, playerId) {
  return state?.players?.find((entry) => entry.id === playerId) ?? null;
}

function getHumanPlayer(state) {
  return state?.players?.find((entry) => entry.id === state?.humanPlayerId) ?? null;
}

function getHumanAction(state) {
  return state?.awaitingHumanAction || null;
}

function getCurrentTurnPlayerId(state) {
  if (!state?.players?.length) return null;
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.pendingPlay?.playerId) {
    return state.awaitingHumanAction.pendingPlay.playerId;
  }
  if (state.awaitingHumanAction?.playerId) return state.awaitingHumanAction.playerId;
  if (state.phase === 'challenging') {
    return state.thinkingPlayerId || state.pendingTurn?.playerId || null;
  }
  return state.players[state.currentPlayerIndex]?.id ?? null;
}

function getRevealShout(playerId, reveal) {
  if (!reveal) return '';
  if (reveal.stage === 'incoming') {
    if (playerId === reveal.challengerId) return 'objection!!';
    if (playerId === reveal.claimantId) return 'challenged';
    return '';
  }

  if (playerId === reveal.winnerId) return 'wins objection';
  if (playerId === reveal.loserId) return reveal.challengeCorrect ? 'takes pile' : 'loses challenge';
  return '';
}

function getPortraitState(player, state, reveal = null) {
  if (!player) return 'default';
  if (reveal) {
    if (reveal.stage === 'incoming') {
      if (player.id === reveal.claimantId) return 'judged';
      if (player.id === reveal.challengerId) return 'judging';
      return 'default';
    }
    if (player.id === reveal.claimantId) return reveal.claimantState || 'default';
    if (player.id === reveal.challengerId) return reveal.challengerState || 'default';
    return 'default';
  }
  if (state?.phase === 'finished') return state?.winner === player.id ? 'win' : 'lose';
  if (state?.winner === player.id) return 'win';
  if (player.isEliminated) return 'lose';
  if (state?.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'judged';
  if (state?.thinkingPlayerId === player.id) {
    return state.phase === 'challenging' ? 'judging' : 'thinking';
  }
  return 'default';
}

function getSeatStatus(player, state, reveal = null) {
  if (!player) return 'waiting';
  if (reveal) return '';
  if (player.isEliminated) return 'out';
  return '';
}

function getSeatClasses(player, state, reveal = null) {
  const classes = [];
  if (!player) return classes;
  if (reveal) {
    if (player.id === reveal.challengerId || player.id === reveal.claimantId) {
      classes.push('is-reveal-focus');
      if (player.id === reveal.winnerId && reveal.stage === 'resolution') classes.push('is-reveal-winner');
      if (player.id === reveal.loserId && reveal.stage === 'resolution') classes.push('is-reveal-loser');
      if (player.id === reveal.claimantId) classes.push('is-judged');
      if (player.id === reveal.challengerId) classes.push('is-judging-turn');
    } else {
      classes.push('is-inactive', 'is-reveal-muted');
    }
    if (player.role === 'human') classes.push('is-human');
    return classes;
  }
  if (state?.phase === 'finished') {
    if (state.winner === player.id) {
      classes.push('is-winner');
    } else {
      classes.push('is-finished-loser', 'is-inactive');
    }
    if (player.role === 'human') classes.push('is-human');
    return classes;
  }

  const currentTurnPlayerId = getCurrentTurnPlayerId(state);
  if (state?.winner === player.id) classes.push('is-winner');
  if (player.isEliminated) classes.push('is-eliminated');
  if (state?.phase === 'challenging' && state.pendingTurn?.playerId === player.id) classes.push('is-judged', 'is-acting-turn');
  if (state?.thinkingPlayerId === player.id) {
    classes.push('is-thinking');
    classes.push(state?.phase === 'challenging' ? 'is-judging-turn' : 'is-acting-turn');
  }
  if (state?.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) {
    classes.push('is-awaiting-human', 'is-acting-turn');
  }
  if (state?.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) {
    classes.push('is-awaiting-human', 'is-judging-turn');
  }
  if (currentTurnPlayerId === player.id) classes.push('is-current-turn');
  if (currentTurnPlayerId === player.id && state?.phase !== 'challenging' && state?.awaitingHumanAction?.type !== 'challenge') {
    classes.push('is-acting-turn');
  }
  if (player.role === 'human') classes.push('is-human');
  if (!classes.some((className) => ['is-winner', 'is-eliminated', 'is-judged', 'is-acting-turn', 'is-judging-turn', 'is-awaiting-human', 'is-thinking'].includes(className))) {
    classes.push('is-inactive');
  }
  return classes;
}

function getSeatBadge(player, state, reveal = null) {
  if (!player || !state) return '';
  if (reveal) return '';
  if (state.phase === 'finished') return state.winner === player.id ? 'winner' : 'lose';
  if (state.winner === player.id) return 'winner';
  if (state.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) return 'your turn';
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) return 'objection?';
  if (state.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'challenged';
  if (state.phase === 'challenging' && state.thinkingPlayerId === player.id) return 'judge';
  if (state.thinkingPlayerId === player.id) return 'acting';
  if (state.players?.[state.currentPlayerIndex]?.id === player.id && !state.pendingTurn) return 'acting';
  return '';
}

function getSeatShout(player, state, reveal = null) {
  if (!player || !state) return '';
  if (reveal) return getRevealShout(player.id, reveal);

  if (state.phase === 'finished') return state.winner === player.id ? 'winner' : 'lose';
  if (state.winner === player.id) return 'winner';
  if (state.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) return 'your move';
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) return 'objection?';
  if (state.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'challenged';
  if (state.phase === 'challenging' && state.thinkingPlayerId === player.id) {
    return 'judge';
  }
  if (state.thinkingPlayerId === player.id || state.players?.[state.currentPlayerIndex]?.id === player.id) {
    return 'acting';
  }

  return '';
}

function shouldRenderSeatShout(shoutText) {
  return ['objection?', 'winner', 'lose', 'objection!!', 'challenged', 'wins objection', 'takes pile', 'loses challenge', 'acting', 'judge'].includes(shoutText);
}

function renderCard(cardString, showFace = true) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-card';
  wrapper.innerHTML = showFace
    ? window.CardRenderer.getCardSVG(cardString)
    : window.CardRenderer.getCardBackSVG();
  return wrapper;
}

function renderSelectableHand(container, cards, selectedCards, onToggleCard) {
  cards.forEach((card) => {
    const cardEl = renderCard(card, true);
    cardEl.classList.add('is-selectable');
    if (selectedCards.has(card)) {
      cardEl.classList.add('is-selected');
    }
    cardEl.addEventListener('click', () => onToggleCard(card));
    container.appendChild(cardEl);
  });
}

function formatPhaseTimer(startedAt, now) {
  if (!startedAt || !now || now < startedAt) return '';
  const elapsedMs = now - startedAt;
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function formatRoundKicker(state) {
  if (!state) return 'launcher';
  const roundNumber = (state.totalTurns || 0) + 1;
  const actorId = state.pendingTurn?.playerId
    || state.awaitingHumanAction?.pendingPlay?.playerId
    || state.players?.[state.currentPlayerIndex]?.id
    || '';
  const actor = getPlayerById(state, actorId);
  const actorName = actor ? getPlayerName(actor).toUpperCase() : 'TABLE';
  return `ROUND ${roundNumber}: ${actorName}`;
}


function getCrossExaminationText(playerName, claimedCount, claimedRank) {
  const subject = playerName?.toLowerCase?.() === 'you'
    ? 'You are'
    : `${playerName} is`;
  return `${subject} under cross-examination for ${claimedCount} x ${claimedRank}.`;
}

function canPeekPlayerHand(player, state) {
  if (!player || !state) return false;
  if (!player.handVisible || !player.hand?.length) return false;
  if (!state.interactive) {
    return true;
  }
  return state.humanPlayerId === player.id;
}

function renderPeekTray(container, root, slotMeta, player, state, app) {
  const humanInteractivePeek = Boolean(
    state?.interactive &&
    player?.id &&
    state?.humanPlayerId === player.id
  );
  const visibleCount = Math.min(
    6,
    state?.interactive
      ? (player?.handSize || 0)
      : (player?.hand?.length || 0)
  );
  const peekable = canPeekPlayerHand(player, state);
  const isOpen = peekable && app.spectatorPeekPlayerId === player.id;
  const faceCards = humanInteractivePeek
    ? (player?.hand || [])
    : (player?.hand?.slice(0, 6) || []);
  const cards = isOpen ? faceCards : Array.from({ length: visibleCount }, () => null);
  const totalCount = isOpen
    ? (player?.hand?.length || 0)
    : (state?.interactive ? (player?.handSize || 0) : (player?.hand?.length || 0));
  const overflowCount = Math.max(0, totalCount - cards.length);
  const openSeq = isOpen ? String(app.peekRevealSeq || 0) : '0';
  const renderKey = [
    visibleCount > 0 ? 'show' : 'hide',
    peekable ? 'peek' : 'static',
    isOpen ? 'open' : 'closed',
    totalCount,
    isOpen ? faceCards.join(',') : 'backs',
    overflowCount,
    openSeq,
  ].join('|');

  root.dataset.peekable = peekable ? 'true' : 'false';
  root.dataset.peekOpen = isOpen ? 'true' : 'false';
  root.dataset.cardsVisible = visibleCount > 0 ? 'true' : 'false';
  root.dataset.peekLayout = humanInteractivePeek && isOpen ? 'grid' : 'row';

  if (!visibleCount && !isOpen) {
    root.dataset.peekRenderKey = '';
    root.dataset.peekAnimatedSeq = '';
    container.innerHTML = '';
    return;
  }

  if (root.dataset.peekRenderKey === renderKey) {
    return;
  }

  const shouldAnimate = isOpen && root.dataset.peekAnimatedSeq !== openSeq;
  root.dataset.peekRenderKey = renderKey;
  if (shouldAnimate) {
    root.dataset.peekAnimatedSeq = openSeq;
  }

  container.innerHTML = '';

  cards.forEach((card, index) => {
    const cardEl = renderCard(card || '', isOpen && Boolean(card));
    cardEl.style.setProperty('--peek-order', String(index));
    if (isOpen && shouldAnimate) {
      cardEl.classList.add('is-peek-revealed');
    }
    container.appendChild(cardEl);
  });

  if (overflowCount > 0) {
    const extra = document.createElement('div');
    extra.className = 'hand-overflow';
    extra.textContent = `+${overflowCount}`;
    container.appendChild(extra);
  }
}

function buildSpectatorFeedEntries(state) {
  const feed = state?.currentTurnFeed;
  if (!feed?.entries?.length) return [];

  return feed.entries.map((entry) => {
    const actor = getPlayerById(state, entry.playerId);
    const target = getPlayerById(state, entry.targetPlayerId);
    const actorName = getPlayerName(actor);
    const targetName = getPlayerName(target);

    if (entry.type === 'claim') {
      return {
        tone: 'live',
        turnNumber: feed.turnNumber,
        title: `${actorName} claims ${entry.claimedCount} x ${entry.claimedRank}.`,
        detail: 'Face-down cards hit the table.',
      };
    }

    if (entry.type === 'pass') {
      return {
        tone: 'neutral',
        turnNumber: feed.turnNumber,
        title: `${actorName} passes.`,
        detail: `No objection to ${targetName}'s ${entry.claimedCount} x ${entry.claimedRank}.`,
      };
    }

    if (entry.type === 'challenge') {
      return {
        tone: 'danger',
        turnNumber: feed.turnNumber,
        title: `${actorName} calls bullshit.`,
        detail: `Objecting to ${targetName}'s ${entry.claimedCount} x ${entry.claimedRank}.`,
      };
    }

    if (entry.outcome === 'lie_exposed') {
      if (state.winner && state.currentTurnFeed?.turnNumber === state.totalTurns) {
        const winner = getPlayerById(state, state.winner);
        return {
          tone: 'success',
          turnNumber: feed.turnNumber,
          title: `${getPlayerName(winner)} wins the table.`,
          detail: `${actorName} exposes the lie and clears out.`,
        };
      }
      return {
        tone: 'danger',
        turnNumber: feed.turnNumber,
        title: `${actorName} exposes the lie.`,
        detail: `${targetName} takes the pile.`,
      };
    }

    if (entry.outcome === 'false_challenge') {
      return {
        tone: 'success',
        turnNumber: feed.turnNumber,
        title: `${actorName} beats the objection.`,
        detail: `${targetName}'s claim stands.`,
      };
    }

    return {
      tone: 'success',
      turnNumber: feed.turnNumber,
      title: state.winner && state.currentTurnFeed?.turnNumber === state.totalTurns
        ? `${actorName} wins the table.`
        : `${actorName}'s claim stands.`,
      detail: state.winner && state.currentTurnFeed?.turnNumber === state.totalTurns
        ? `${actorName} empties out on ${entry.claimedCount} x ${entry.claimedRank}.`
        : `No one overturned ${actorName}'s ${entry.claimedCount} x ${entry.claimedRank}.`,
    };
  });
}

function getFlashValue(app, type, targetId = '') {
  const attention = app.attention;
  if (!attention) return '';

  if (type === 'player' && targetId && attention.playerIds?.includes(targetId)) {
    return `${attention.variant || 'turn'}-${attention.seq || 0}`;
  }

  if (type === 'zone' && targetId && attention.zones?.includes(targetId)) {
    return `${attention.variant || 'turn'}-${attention.seq || 0}`;
  }

  return '';
}

function renderSeat(slotDom, slotId, slotMeta, player, state, app) {
  const root = slotDom.root;
  const portrait = slotDom.portrait;
  const whistle = slotDom.whistle;
  const judgeFx = slotDom.judgeFx;
  const shout = slotDom.shout;
  const peek = slotDom.peek;
  const name = slotDom.name;
  const count = slotDom.count;
  const status = slotDom.status;
  const reveal = app.challengeReveal || null;

  root.className = 'cast-seat';
  root.dataset.facing = slotMeta?.facing || 'right';
  root.dataset.position = slotMeta?.stagePosition || slotId;
  root.dataset.section = slotMeta?.section || 'board';

  if (!player) {
    root.dataset.badge = '';
    root.dataset.playerId = '';
    root.dataset.flash = '';
    root.dataset.active = 'false';
    root.dataset.peekable = 'false';
    root.dataset.peekOpen = 'false';
    root.style.removeProperty('--seat-accent');
    root.style.removeProperty('--seat-accent-bright');
    root.style.removeProperty('--seat-secondary');
    root.style.removeProperty('--seat-accent-dim');
    portrait.innerHTML = '';
    clearNode(whistle);
    clearNode(judgeFx);
    clearNode(peek);
    setText(shout, '');
    setText(name, 'empty seat');
    setText(count, '0 cards');
    setText(status, '');
    return;
  }

  const theme = window.ModelThemes.getTheme(player.modelId);
  const portraitState = getPortraitState(player, state, reveal);
  const shoutText = getSeatShout(player, state, reveal);
  const badgeText = getSeatBadge(player, state, reveal);
  const showShout = shouldRenderSeatShout(shoutText);
  const showWhistle = !reveal && state?.phase === 'challenging' && state.pendingTurn?.playerId === player.id;
  const showJudgeFx = !reveal && state?.phase === 'challenging' && (
    state.awaitingHumanAction?.type === 'challenge'
      ? state.awaitingHumanAction.playerId === player.id
      : state.thinkingPlayerId === player.id
  );

  root.dataset.playerId = player.id;
  root.dataset.badge = showShout ? '' : badgeText;
  root.dataset.revealStage = reveal?.stage || '';
  root.style.setProperty('--seat-accent', theme.accent);
  root.style.setProperty('--seat-accent-bright', theme.accentBright);
  root.style.setProperty('--seat-secondary', theme.secondary);
  root.style.setProperty('--seat-accent-dim', theme.accentDim);

  root.dataset.active = state?.currentPlayerIndex != null && state.players?.[state.currentPlayerIndex]?.id === player.id ? 'true' : 'false';
  root.dataset.flash = getFlashValue(app, 'player', player.id);
  portrait.innerHTML = window.ModelThemes.getCharacterImage(
    player.modelId,
    portraitState,
    `${state?.totalTurns || 0}-${portraitState}-${player.handSize}`
  );
  whistle.innerHTML = showWhistle
    ? Array.from({ length: 3 }, (_, index) => `<span class="whistle-text whistle-text--${index + 1}">*whistle*</span>`).join('')
    : '';
  judgeFx.innerHTML = showJudgeFx ? JUDGE_SCRIBBLE_SVG : '';
  setText(shout, showShout ? shoutText : '');
  setText(name, getPlayerName(player));
  setText(count, `${player.handSize} ${player.handSize === 1 ? 'card' : 'cards'}`);
  setText(status, getSeatStatus(player, state, reveal));

  getSeatClasses(player, state, reveal).forEach((className) => root.classList.add(className));
  renderPeekTray(peek, root, slotMeta, player, state, app);
}

function renderTurnRibbon(container, state) {
  const queue = buildTurnRibbon(state);
  if (!queue.length) {
    container.innerHTML = '<div class="turn-pill">waiting</div>';
    return;
  }

  const previousRects = new Map();
  const existingNodes = new Map();
  [...container.children].forEach((node) => {
    const key = node.dataset?.key;
    if (!key) return;
    previousRects.set(key, node.getBoundingClientRect());
    existingNodes.set(key, node);
  });

  const nextNodes = [];

  queue.forEach((entry, index) => {
    const pillKey = `pill:${entry.id}`;
    const pill = existingNodes.get(pillKey) || document.createElement('div');
    pill.dataset.key = pillKey;
    pill.dataset.role = entry.role || 'standby';
    pill.className = 'turn-pill';
    if (entry.isLead) pill.classList.add('is-lead', 'is-current');
    if (entry.role === 'judge') pill.classList.add('is-judge');
    if (entry.isAwaitingHuman) pill.classList.add('is-awaiting-human');
    if (entry.isEliminated) pill.classList.add('is-eliminated');
    pill.setAttribute('aria-label', getShortModelName(entry.modelId, entry.name));
    pill.title = getShortModelName(entry.modelId, entry.name);

    let order = pill.querySelector('.turn-index');
    if (!order) {
      order = document.createElement('span');
      pill.appendChild(order);
    }
    order.className = 'turn-index';
    order.textContent = String(entry.order);

    let thumbFrame = pill.querySelector('.turn-thumb-frame');
    if (!thumbFrame) {
      thumbFrame = document.createElement('span');
      pill.appendChild(thumbFrame);
    }
    thumbFrame.className = 'turn-thumb-frame';

    let thumb = thumbFrame.querySelector('.turn-thumb');
    if (!thumb) {
      thumb = document.createElement('img');
      thumbFrame.appendChild(thumb);
    }
    thumb.className = 'turn-thumb';
    thumb.src = window.ModelThemes.getThumbnail(entry.modelId);
    thumb.alt = getShortModelName(entry.modelId, entry.name);

    let label = pill.querySelector('.turn-label');
    if (!label) {
      label = document.createElement('span');
      pill.appendChild(label);
    }
    label.className = `turn-label turn-label--${entry.role || 'standby'}`;
    label.textContent = entry.roleLabel || '';
    nextNodes.push(pill);

    if (index < queue.length - 1) {
      const arrowKey = `arrow:${index}`;
      const arrow = existingNodes.get(arrowKey) || document.createElement('div');
      arrow.dataset.key = arrowKey;
      arrow.className = 'turn-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '➜';
      nextNodes.push(arrow);
    }
  });

  container.replaceChildren(...nextNodes);

  nextNodes.forEach((node) => {
    const key = node.dataset?.key;
    const previousRect = key ? previousRects.get(key) : null;
    node.style.transition = 'none';
    node.style.transform = '';
    node.style.opacity = '';
    if (!previousRect) {
      return;
    }

    const nextRect = node.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    const deltaY = previousRect.top - nextRect.top;
    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
      node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
  });

  window.requestAnimationFrame(() => {
    nextNodes.forEach((node) => {
      node.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
      node.style.transform = '';
    });
  });
}

function renderPile(container, pileSize) {
  container.innerHTML = '';
  const icon = document.createElement('div');
  icon.className = 'pile-icon';
  if (!pileSize) {
    icon.classList.add('pile-icon--empty');
    container.appendChild(icon);
    return;
  }

  const cardCount = Math.min(3, pileSize);
  for (let index = 0; index < cardCount; index += 1) {
    const card = document.createElement('span');
    card.className = `pile-card pile-card--${index + 1}`;
    card.innerHTML = window.CardRenderer.getCardBackSVG();
    icon.appendChild(card);
  }
  container.appendChild(icon);
}

function renderExperimentGuide(container, selectedExperimentId) {
  if (!container) return;
  const selectedId = String(selectedExperimentId ?? '1');
  const experiment = EXPERIMENTS.find((entry) => entry.id === selectedId) || EXPERIMENTS[0];
  container.innerHTML = experiment
    ? `
      <article class="experiment-faq-item experiment-faq-item--single is-selected">
        <div class="experiment-faq-id">exp ${experiment.id}</div>
        <div class="experiment-faq-title">${experiment.title}</div>
        <div class="experiment-faq-line">${experiment.summary}</div>
        <div class="experiment-faq-detail">${experiment.detail}</div>
      </article>
    `
    : '';
}

function buildHudState(state, reveal, challengeReveal) {
  if (!state) {
    return {
      primary: 'table quiet',
      secondary: 'choose a table mode',
      emphasizeReveal: false,
    };
  }

  if (challengeReveal) {
    return {
      primary: challengeReveal.primary,
      secondary: challengeReveal.secondary,
      emphasizeReveal: true,
    };
  }

  if (state.phase === 'finished') {
    const winner = getPlayerById(state, state.winner);
    return {
      primary: 'winner decided',
      secondary: winner ? `${getPlayerName(winner)} wins the table` : 'table complete',
      emphasizeReveal: false,
    };
  }

  if (state.pendingTurn) {
    const actor = getPlayerById(state, state.pendingTurn.playerId);
    const judge = getPlayerById(state, state.awaitingHumanAction?.type === 'challenge'
      ? state.awaitingHumanAction.playerId
      : state.thinkingPlayerId);

    return {
      primary: `${state.pendingTurn.claimedCount} x ${state.pendingTurn.claimedRank} on table`,
      secondary: state.awaitingHumanAction?.type === 'challenge'
        ? `${getPlayerName(judge)} deciding objection`
        : state.phase === 'challenging' && judge
          ? `${getPlayerName(judge)} judging`
          : `${getPlayerName(actor)} acting`,
      emphasizeReveal: false,
    };
  }

  if (reveal?.label) {
    return {
      primary: reveal.label,
      secondary: 'table quiet',
      emphasizeReveal: true,
    };
  }

  const current = getPlayerById(state, state.players?.[state.currentPlayerIndex]?.id);
  return {
    primary: `${state.currentRank} required`,
    secondary: current ? `${getPlayerName(current)} acting` : 'table quiet',
    emphasizeReveal: false,
  };
}

function renderHudState(primaryContainer, secondaryContainer, state, reveal, challengeReveal) {
  primaryContainer.innerHTML = '';
  const hudState = buildHudState(state, reveal, challengeReveal);
  const primary = document.createElement('div');
  primary.className = 'claim-line';
  if (hudState.emphasizeReveal) {
    primary.classList.add('claim-line--reveal');
  }
  primary.textContent = hudState.primary;
  primaryContainer.appendChild(primary);
  setText(secondaryContainer, hudState.secondary);
}

function buildDialogueState(app) {
  const state = app.currentState;
  const awaitingHumanAction = getHumanAction(state);
  const latestTurn = state?.turns?.length ? state.turns[state.turns.length - 1] : null;

  if (!state) {
    return {
      speaker: 'launcher',
      text: 'Choose how you want to experience the table.',
      banner: null,
      runtime: 'idle',
    };
  }

  if (app.challengeReveal) {
    return {
      speaker: app.challengeReveal.stage === 'incoming'
        ? app.challengeReveal.challengerName
        : app.challengeReveal.winnerName,
      text: app.challengeReveal.secondary,
      banner: {
        state: app.challengeReveal.stage === 'incoming'
          ? 'objection'
          : (app.challengeReveal.challengeCorrect ? 'sustained' : 'overruled'),
        label: app.challengeReveal.primary,
        copy: app.challengeReveal.secondary,
      },
      runtime: 'reveal',
    };
  }

  if (state.phase === 'finished' && state.winnerName) {
    const winner = getPlayerById(state, state.winner);
    return {
      speaker: winner ? getPlayerName(winner) : state.winnerName,
      text: `${winner ? getPlayerName(winner) : state.winnerName} wins the table after ${state.totalTurns} turns.`,
      banner: {
        state: 'sustained',
        label: 'winner',
        copy: 'Use the utility drawer to start a new game.',
      },
      runtime: 'finished',
    };
  }

  if (awaitingHumanAction?.type === 'play') {
    return {
      speaker: awaitingHumanAction.playerName,
      text: `Select 1 to 4 cards and claim ${awaitingHumanAction.currentRank}.`,
      banner: {
        state: 'turn',
        label: 'your move',
        copy: 'Only the count and claimed rank are public.',
      },
      runtime: 'your play',
    };
  }

  if (awaitingHumanAction?.type === 'challenge' && awaitingHumanAction.pendingPlay) {
    return {
      speaker: getPlayerName(awaitingHumanAction.pendingPlay),
      text: `${getPlayerName(awaitingHumanAction.pendingPlay)} says ${awaitingHumanAction.pendingPlay.claimedCount} x ${awaitingHumanAction.pendingPlay.claimedRank}. Call bullshit or pass.`,
      banner: {
        state: 'objection',
        label: 'objection!!',
        copy: 'Challenge window is open.',
      },
      runtime: 'your call',
    };
  }

  if (state.phase === 'challenging' && state.pendingTurn) {
    const player = state.players.find((entry) => entry.id === state.pendingTurn.playerId);
    return {
      speaker: getPlayerName(player),
      text: getCrossExaminationText(
        getPlayerName(player),
        state.pendingTurn.claimedCount,
        state.pendingTurn.claimedRank
      ),
      banner: {
        state: 'objection',
        label: 'cross-examination',
        copy: 'Waiting for objections to resolve.',
      },
      runtime: 'challenge window',
    };
  }

  if (latestTurn?.challenged) {
    const challenger = state.players.find((entry) => entry.id === latestTurn.challengerId);
    const player = state.players.find((entry) => entry.id === latestTurn.playerId);
    return {
      speaker: latestTurn.challengeCorrect ? getPlayerName(challenger) : getPlayerName(player),
      text: latestTurn.challengeCorrect
        ? `${getPlayerName(challenger)} exposes the lie.`
        : `${getPlayerName(player)} survives the objection.`,
      banner: {
        state: latestTurn.challengeCorrect ? 'sustained' : 'overruled',
        label: latestTurn.challengeCorrect ? 'sustained' : 'overruled',
        copy: `${getPlayerName(player)} claimed ${latestTurn.claimedCount} x ${latestTurn.claimedRank}.`,
      },
      runtime: latestTurn.challengeCorrect ? 'caught' : 'claim stands',
    };
  }

  if (app.ephemeralThinkingPlayerId) {
    const thinker = state.players.find((entry) => entry.id === app.ephemeralThinkingPlayerId);
    return {
      speaker: getPlayerName(thinker),
      text: `${getPlayerName(thinker)} is preparing a play.`,
      banner: {
        state: 'turn',
        label: 'thinking',
        copy: `Required claim: ${state.currentRank}.`,
      },
      runtime: 'thinking',
    };
  }

  const current = state.players[state.currentPlayerIndex];
  return {
    speaker: getPlayerName(current),
    text: `${getPlayerName(current)} is up. Required claim: ${state.currentRank}.`,
    banner: {
      state: 'turn',
      label: 'turn live',
      copy: `Pile size: ${state.pileSize} cards.`,
    },
    runtime: app.autoPlaying ? 'auto running' : 'live',
  };
}

function buildTurnTrace(state, turn, options = {}) {
  if (!turn) return null;
  const includeNotes = !state?.interactive;
  const isPending = options.pending === true;
  const actor = getPlayerById(state, turn.playerId);
  const actorName = getPlayerName(actor);
  const rows = [{
    label: 'claim',
    tone: isPending ? 'live' : 'neutral',
    title: `${actorName} claims ${turn.claimedCount} x ${turn.claimedRank}.`,
    detail: isPending ? 'Face-down cards hit the table.' : 'Claim entered the table.',
    note: includeNotes ? cleanReasoning(turn.reasoning) : '',
  }];

  for (const decision of turn.challengeDecisions || []) {
    const judge = getPlayerById(state, decision.playerId);
    const judgeName = getPlayerName(judge);
    rows.push({
      label: decision.challenge ? 'challenge' : 'pass',
      tone: decision.challenge ? 'danger' : 'neutral',
      title: decision.challenge
        ? `${judgeName} calls bullshit.`
        : `${judgeName} passes.`,
      detail: decision.challenge
        ? `Objecting to ${actorName}'s ${turn.claimedCount} x ${turn.claimedRank}.`
        : `No objection to ${actorName}'s ${turn.claimedCount} x ${turn.claimedRank}.`,
      note: includeNotes ? cleanReasoning(decision.reasoning) : '',
    });
  }

  if (isPending) {
    const activeJudge = state.awaitingHumanAction?.type === 'challenge'
      ? getPlayerById(state, state.awaitingHumanAction.playerId)
      : getPlayerById(state, state.thinkingPlayerId);
    rows.push({
      label: 'status',
      tone: 'live',
      title: activeJudge ? `${getPlayerName(activeJudge)} is up next.` : 'Challenge window open.',
      detail: activeJudge
        ? `Waiting on ${getPlayerName(activeJudge)} to pass or object.`
        : 'Waiting for objections to resolve.',
      note: '',
    });
  } else {
    const challenger = getPlayerById(state, turn.challengerId);
    const challengerName = getPlayerName(challenger);
    const truthNote = includeNotes && Array.isArray(turn.actualCards) && turn.actualCards.length
      ? `hidden truth: ${turn.wasLie ? 'lie' : 'truth'}`
      : '';
    const resolutionNote = includeNotes
      ? [truthNote, cleanReasoning(turn.challengeReasoning)].filter(Boolean).join(' • ')
      : '';

    rows.push({
      label: 'result',
      tone: turn.challenged ? (turn.challengeCorrect ? 'danger' : 'success') : 'success',
      title: !turn.challenged
        ? `${actorName}'s claim stands.`
        : turn.challengeCorrect
          ? `${challengerName} exposes the lie.`
          : `${actorName} beats the objection.`,
      detail: !turn.challenged
        ? 'No one challenged.'
        : turn.challengeCorrect
          ? `${actorName} takes the pile.`
          : `${challengerName} takes the pile.`,
      note: resolutionNote,
    });
  }

  return {
    turnNumber: turn.turnNumber || ((state?.totalTurns || 0) + 1),
    headline: `${actorName} · ${turn.claimedCount} x ${turn.claimedRank}`,
    tone: isPending
      ? 'live'
      : turn.challenged
        ? (turn.challengeCorrect ? 'danger' : 'success')
        : 'neutral',
    rows,
  };
}

function buildLogTurns(state) {
  if (!state) return [];
  const turns = [];
  if (state.pendingTurn) {
    const pendingTrace = buildTurnTrace(state, state.pendingTurn, { pending: true });
    if (pendingTrace) turns.push(pendingTrace);
  }

  for (const turn of [...(state.turns || [])].reverse()) {
    const trace = buildTurnTrace(state, turn);
    if (trace) turns.push(trace);
  }

  return turns.slice(0, 8);
}

function createStatRows(statsObj) {
  return Object.values(statsObj || {}).sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.challengeAccuracy - a.challengeAccuracy;
  });
}

function renderDialogue(dom, app) {
  const state = app.currentState;
  const dialogue = buildDialogueState(app);
  const showSpectatorFeed = Boolean(state && !state.interactive);
  const feedEntries = showSpectatorFeed ? buildSpectatorFeedEntries(state) : [];

  dom.phaseKicker.hidden = false;
  setText(dom.phaseKicker, showSpectatorFeed ? formatRoundKicker(state) : dialogue.speaker);
  setText(dom.phaseTimer, formatPhaseTimer(app.messageTimerStartedAt, app.messageTimerNow));

  dom.phaseMain.hidden = showSpectatorFeed;
  if (!showSpectatorFeed) {
    setText(dom.phaseMain, dialogue.text);
  }

  dom.dialogueFeed.hidden = !showSpectatorFeed;
  if (showSpectatorFeed) {
    dom.dialogueFeed.innerHTML = feedEntries.length
      ? feedEntries.map((entry, index) => `
          <article class="dialogue-feed-entry dialogue-feed-entry--${entry.tone} ${index === feedEntries.length - 1 ? 'is-latest' : ''}">
            <div class="dialogue-feed-main">
              <div class="dialogue-feed-title">${entry.title}</div>
              <div class="dialogue-feed-detail">${entry.detail}</div>
            </div>
            <div class="dialogue-feed-round">turn ${entry.turnNumber}</div>
          </article>
        `).join('')
      : '<div class="dialogue-feed-empty">Waiting for the table to start.</div>';
  } else {
    dom.dialogueFeed.innerHTML = '';
  }

  if (dialogue.banner) {
    dom.challengeBanner.hidden = showSpectatorFeed;
    dom.challengeBanner.classList.remove('is-empty');
    dom.challengeBanner.dataset.state = dialogue.banner.state;
    setText(dom.challengeLabel, dialogue.banner.label);
    setText(dom.challengeCopy, dialogue.banner.copy);
  } else {
    dom.challengeBanner.hidden = true;
    dom.challengeBanner.classList.add('is-empty');
    dom.challengeBanner.dataset.state = '';
    setText(dom.challengeLabel, '');
    setText(dom.challengeCopy, '');
  }
}

function renderCommandPanel(dom, app, onToggleCard) {
  const state = app.currentState;
  const awaitingHumanAction = getHumanAction(state);
  const humanPlayer = getHumanPlayer(state);
  dom.commandPanel.hidden = !awaitingHumanAction;
  dom.dialogueHand.innerHTML = '';

  if (!awaitingHumanAction) {
    dom.selectedCards.innerHTML = '';
    return;
  }

  setText(dom.commandMode, state?.interactive ? 'manual' : (state?.provider || app.provider));

  if (awaitingHumanAction.type === 'play') {
    setText(dom.commandTitle, 'your play');
    setText(dom.commandRank, `claim ${awaitingHumanAction.currentRank}`);
    setText(dom.commandCopy, 'Pick 1 to 4 cards. The audience only sees the count and claimed rank.');
    dom.playButtons.hidden = false;
    dom.challengeButtons.hidden = true;
    dom.submitPlayBtn.disabled = app.selectedCards.size < 1 || app.selectedCards.size > 4;
    dom.clearPlayBtn.disabled = app.selectedCards.size === 0;

    if (humanPlayer?.id === awaitingHumanAction.playerId && Array.isArray(humanPlayer.hand) && humanPlayer.hand.length) {
      renderSelectableHand(dom.dialogueHand, humanPlayer.hand, app.selectedCards, onToggleCard);
    } else if (Array.isArray(humanPlayer?.hand) && humanPlayer.hand.length) {
      renderSelectableHand(dom.dialogueHand, humanPlayer.hand, app.selectedCards, onToggleCard);
    } else {
      dom.dialogueHand.innerHTML = '<span class="selected-pill selected-pill--muted">hand unavailable</span>';
    }

    dom.selectedCards.innerHTML = app.selectedCards.size
      ? [...app.selectedCards].map((card) => `<span class="selected-pill">${card}</span>`).join('')
      : '<span class="selected-pill selected-pill--muted">no cards selected</span>';
    return;
  }

  const pendingPlay = awaitingHumanAction.pendingPlay;
  setText(dom.commandTitle, 'your challenge');
  setText(dom.commandRank, pendingPlay ? `${pendingPlay.claimedCount} x ${pendingPlay.claimedRank}` : '');
  setText(
    dom.commandCopy,
    pendingPlay
      ? `${getPlayerName(pendingPlay)} says they played ${pendingPlay.claimedCount} x ${pendingPlay.claimedRank}.`
      : 'Decide whether to call bullshit.'
  );
  dom.playButtons.hidden = true;
  dom.challengeButtons.hidden = false;
  dom.selectedCards.innerHTML = '<span class="selected-pill selected-pill--muted">challenge window open</span>';
}

function mountCommandPanel(dom, layout, state) {
  const awaitingHumanAction = getHumanAction(state);
  let target = dom.commandPanelHome;

  if (awaitingHumanAction && state?.interactive && state?.humanPlayerId) {
    const humanSlotId = SLOT_IDS.find((slotId) => layout.slots?.[slotId] === state.humanPlayerId);
    target = dom.slots?.[humanSlotId]?.manual || dom.commandPanelHome;
  }

  if (target && dom.commandPanel.parentElement !== target) {
    target.appendChild(dom.commandPanel);
  }
}

export function renderPeekPanels(dom, app, layout) {
  const state = app.currentState;
  const viewState = state
    ? { ...state, thinkingPlayerId: app.ephemeralThinkingPlayerId ?? state.thinkingPlayerId }
    : null;

  SLOT_IDS.forEach((slotId) => {
    const slotDom = dom.slots?.[slotId];
    if (!slotDom) return;
    const playerId = layout?.slots?.[slotId];
    const player = viewState?.players?.find((entry) => entry.id === playerId) ?? null;

    if (!player) {
      slotDom.root.dataset.peekable = 'false';
      slotDom.root.dataset.peekOpen = 'false';
      slotDom.root.dataset.cardsVisible = 'false';
      slotDom.root.dataset.peekRenderKey = '';
      slotDom.peek.innerHTML = '';
      return;
    }

    renderPeekTray(slotDom.peek, slotDom.root, layout?.slotMeta?.[slotId], player, viewState, app);
  });
}

function renderLog(dom, state) {
  const turns = buildLogTurns(state);
  if (!turns.length) {
    dom.logList.innerHTML = '<div class="drawer-empty">Start a game to see the public action log.</div>';
    return;
  }

  dom.logList.innerHTML = '';
  turns.forEach((turn) => {
    const item = document.createElement('article');
    item.className = `log-turn log-turn--${turn.tone}`;

    const header = document.createElement('div');
    header.className = 'log-turn-header';

    const headline = document.createElement('div');
    headline.className = 'log-title';
    headline.textContent = turn.headline;

    const meta = document.createElement('div');
    meta.className = 'log-meta';
    meta.textContent = `turn ${turn.turnNumber}`;

    header.appendChild(headline);
    header.appendChild(meta);
    item.appendChild(header);

    const body = document.createElement('div');
    body.className = 'log-turn-body';

    turn.rows.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = `log-trace-row log-trace-row--${row.tone}`;

      const label = document.createElement('div');
      label.className = 'log-trace-label';
      label.textContent = row.label;
      rowEl.appendChild(label);

      const title = document.createElement('div');
      title.className = 'log-trace-title';
      title.textContent = row.title;
      rowEl.appendChild(title);

      const detail = document.createElement('div');
      detail.className = 'log-detail';
      detail.textContent = row.detail;
      rowEl.appendChild(detail);

      if (row.note) {
        const note = document.createElement('div');
        note.className = 'log-note';
        note.textContent = row.note;
        rowEl.appendChild(note);
      }

      body.appendChild(rowEl);
    });

    item.appendChild(body);
    dom.logList.appendChild(item);
  });
}

function renderStats(dom, statsState) {
  if (!dom.statsMeta || !dom.statsEmpty || !dom.statsTableWrap || !dom.statsBody) {
    return;
  }
  setText(dom.statsMeta, statsState.meta);
  if (statsState.loading) {
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = 'Loading leaderboard...';
    dom.statsTableWrap.hidden = true;
    return;
  }

  if (statsState.error) {
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = statsState.error;
    dom.statsTableWrap.hidden = true;
    return;
  }

  const rows = createStatRows(statsState.data);
  if (!rows.length) {
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = 'No comparable completed games found yet.';
    dom.statsTableWrap.hidden = true;
    return;
  }

  dom.statsBody.innerHTML = rows.map((stat, index) => {
    const theme = window.ModelThemes.getTheme(stat.modelId);
    return `
      <tr>
        <td>#${index + 1}</td>
        <td>
          <div class="stats-model">
            <span class="stats-dot" style="background:${theme.accent};"></span>
            <span>${shortenName(stat.modelId)}</span>
          </div>
        </td>
        <td>${formatPercent(stat.winRate)}</td>
        <td>${stat.wins}/${stat.gamesPlayed}</td>
        <td>${formatPercent(stat.lieFrequency)}</td>
        <td>${formatPercent(stat.lieSuccessRate)}</td>
        <td>${formatPercent(stat.paranoiaFrequency)}</td>
        <td>${formatPercent(stat.challengeAccuracy)}</td>
      </tr>
    `;
  }).join('');

  dom.statsEmpty.hidden = true;
  dom.statsTableWrap.hidden = false;
}

function renderLauncher(dom, app) {
  const canClose = Boolean(app.currentState);
  dom.launcher.hidden = !app.launcherOpen;
  dom.launcherCloseBtn.hidden = !canClose;
  dom.providerSelect.value = app.provider;
  if (dom.humanNameInput) {
    dom.humanNameInput.value = app.humanName;
  }
  const maskedServerKey = app.provider === 'nim' && !app.apiKey && app.serverApiKeyAvailable;
  if (document.activeElement !== dom.apiKeyInput) {
    dom.apiKeyInput.value = maskedServerKey ? '••••••••' : app.apiKey;
  }
  dom.apiKeyInput.dataset.filled = maskedServerKey || Boolean(app.apiKey) ? 'true' : 'false';
  dom.launchButton.disabled = app.launcherBusy;
  dom.launcherError.hidden = !app.launcherError;
  setText(dom.launcherError, app.launcherError);

  dom.launcherModeButtons.forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.launchMode === app.launcherMode);
  });

  const interactive = app.launcherMode === 'interactive';
  dom.humanNameField.hidden = true;
  dom.apiKeyField.hidden = app.provider !== 'nim';

  if (interactive) {
    setText(
      dom.launcherNote,
      app.provider === 'nim'
        ? (app.serverApiKeyAvailable ? 'Server key loaded.' : 'Session API key.')
        : 'Mock table for practicing manual turns.'
    );
  } else {
    setText(
      dom.launcherNote,
      app.provider === 'mock'
        ? 'Self-running mock table.'
        : 'Live spectator table with the frozen cohort.'
    );
  }
}

export function bindDom(documentRef = document) {
  const slots = Object.fromEntries(
    SLOT_IDS.map((slotId) => {
      const root = documentRef.querySelector(`[data-slot="${slotId}"]`);
      return [slotId, {
        root,
        portrait: byRole(root, 'portrait'),
        whistle: byRole(root, 'whistle'),
        judgeFx: byRole(root, 'judge-fx'),
        shout: byRole(root, 'shout'),
        peek: byRole(root, 'peek'),
        manual: byRole(root, 'manual'),
        name: byRole(root, 'name'),
        count: byRole(root, 'count'),
        status: byRole(root, 'status'),
      }];
    })
  );

  return {
    root: documentRef.getElementById('app-shell'),
    main: documentRef.querySelector('.app-main'),
    dialogueBox: documentRef.querySelector('.dialogue-box'),
    utilityDrawer: documentRef.getElementById('utility-drawer'),
    utilityToggleBtn: documentRef.getElementById('utility-toggle-btn'),
    utilityCloseBtn: documentRef.getElementById('utility-close-btn'),
    sidebarTabButtons: [...documentRef.querySelectorAll('[data-sidebar-tab]')],
    sidebarSections: [...documentRef.querySelectorAll('[data-sidebar-section]')],
    phaseKicker: documentRef.getElementById('phase-kicker'),
    phaseMain: documentRef.getElementById('phase-main'),
    dialogueFeed: documentRef.getElementById('dialogue-feed'),
    challengeBanner: documentRef.getElementById('challenge-banner'),
    challengeLabel: documentRef.getElementById('challenge-label'),
    challengeCopy: documentRef.getElementById('challenge-copy'),
    roundNotebook: documentRef.querySelector('.round-notebook'),
    roundNumber: documentRef.getElementById('round-number'),
    currentRank: documentRef.getElementById('current-rank'),
    pileCount: documentRef.getElementById('pile-count'),
    pileDisplay: documentRef.getElementById('pile-display'),
    pendingDisplay: documentRef.getElementById('pending-display'),
    pendingSubline: documentRef.getElementById('pending-subline'),
    phaseTimer: documentRef.getElementById('phase-timer'),
    turnRibbon: documentRef.getElementById('turn-ribbon'),
    slots,
    commandPanel: documentRef.getElementById('command-panel'),
    commandPanelHome: documentRef.getElementById('command-panel-home'),
    commandTitle: documentRef.getElementById('human-action-title'),
    commandRank: documentRef.getElementById('human-action-rank'),
    commandMode: documentRef.getElementById('human-action-mode'),
    commandCopy: documentRef.getElementById('human-action-copy'),
    dialogueHand: documentRef.getElementById('dialogue-hand'),
    selectedCards: documentRef.getElementById('selected-cards'),
    playButtons: documentRef.getElementById('human-play-buttons'),
    challengeButtons: documentRef.getElementById('human-challenge-buttons'),
    submitPlayBtn: documentRef.getElementById('submit-play-btn'),
    clearPlayBtn: documentRef.getElementById('clear-play-btn'),
    challengeBtn: documentRef.getElementById('challenge-btn'),
    passBtn: documentRef.getElementById('pass-btn'),
    logList: documentRef.getElementById('log-list'),
    statsMeta: documentRef.getElementById('stats-meta'),
    statsBody: documentRef.getElementById('stats-body'),
    statsEmpty: documentRef.getElementById('stats-empty'),
    statsTableWrap: documentRef.getElementById('stats-table-wrap'),
    statsRefreshBtn: documentRef.getElementById('stats-refresh-btn'),
    soundToggleBtn: documentRef.getElementById('sound-toggle-btn'),
    launcher: documentRef.getElementById('launcher-overlay'),
    launcherCloseBtn: documentRef.getElementById('launcher-close-btn'),
    launcherModeButtons: [...documentRef.querySelectorAll('[data-launch-mode]')],
    providerSelect: documentRef.getElementById('provider-select'),
    humanNameInput: documentRef.getElementById('human-name-input'),
    apiKeyInput: documentRef.getElementById('api-key-input'),
    humanNameField: documentRef.getElementById('human-name-field'),
    apiKeyField: documentRef.getElementById('api-key-field'),
    launcherNote: documentRef.getElementById('launcher-note'),
    launcherError: documentRef.getElementById('launcher-error'),
    launchButton: documentRef.getElementById('launch-btn'),
    newGameBtn: documentRef.getElementById('new-game-btn'),
    stepBtn: documentRef.getElementById('step-btn'),
    autoPlayBtn: documentRef.getElementById('auto-play-btn'),
    setupToggleBtn: documentRef.getElementById('setup-toggle-btn'),
    experimentSelect: documentRef.getElementById('experiment-select'),
    experimentGuideList: documentRef.getElementById('experiment-guide-list'),
    researchStatsLink: documentRef.getElementById('research-stats-link'),
  };
}

export function renderApp(dom, app, layout, onToggleCard) {
  const state = app.currentState;
  const viewState = state
    ? { ...state, thinkingPlayerId: app.ephemeralThinkingPlayerId ?? state.thinkingPlayerId }
    : null;
  const revealLocked = Boolean(app.challengeReveal);
  const dialogueMode = !viewState
    ? 'idle'
    : viewState.interactive
      ? 'idle'
      : 'spectator-feed';

  dom.root.dataset.mode = viewState?.interactive ? 'interactive' : (app.launcherMode || 'spectator');
  dom.root.dataset.sidebarOpen = app.utilityOpen ? 'true' : 'false';
  dom.root.dataset.challengeReveal = revealLocked ? app.challengeReveal.stage : '';
  if (dom.dialogueBox) {
    dom.dialogueBox.dataset.commandMode = dialogueMode;
  }

  renderDialogue(dom, { ...app, currentState: viewState });
  setText(dom.roundNumber, String((viewState?.totalTurns || 0) + 1));
  setText(dom.currentRank, viewState?.currentRank || 'A');
  setText(dom.pileCount, `${viewState?.pileSize || 0} ${(viewState?.pileSize || 0) === 1 ? 'card' : 'cards'}`);
  if (dom.roundNotebook) {
    dom.roundNotebook.dataset.flash = getFlashValue(app, 'zone', 'round');
  }
  dom.pendingDisplay.dataset.flash = getFlashValue(app, 'zone', 'claim');
  dom.pileDisplay.dataset.flash = getFlashValue(app, 'zone', 'pile');
  renderPile(dom.pileDisplay, viewState?.pileSize || 0);
  renderHudState(dom.pendingDisplay, dom.pendingSubline, viewState, app.transientReveal, app.challengeReveal);
  renderTurnRibbon(dom.turnRibbon, viewState);
  const activeExperimentId = viewState?.experimentId != null
    ? String(viewState.experimentId)
    : String(dom.experimentSelect?.value || '1');
  renderExperimentGuide(dom.experimentGuideList, activeExperimentId);
  if (dom.researchStatsLink) {
    dom.researchStatsLink.href = `/stats.html?experiment=${encodeURIComponent(activeExperimentId)}`;
  }

  SLOT_IDS.forEach((slotId) => {
    const playerId = layout.slots[slotId];
    const player = viewState?.players?.find((entry) => entry.id === playerId) ?? null;
    renderSeat(dom.slots[slotId], slotId, layout.slotMeta?.[slotId], player, viewState, app);
  });

  mountCommandPanel(dom, layout, viewState);
  renderCommandPanel(dom, app, onToggleCard);
  renderLog(dom, viewState);
  renderStats(dom, app.stats);
  renderLauncher(dom, app);
  setText(dom.soundToggleBtn, app.soundEnabled ? 'sound on' : 'sound off');
  dom.sidebarTabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.sidebarTab === app.sidebarTab);
  });
  dom.sidebarSections.forEach((section) => {
    section.hidden = section.dataset.sidebarSection !== app.sidebarTab;
  });
  if (dom.stepBtn) {
    dom.stepBtn.disabled = !app.currentGameId || app.autoPlaying || Boolean(viewState?.awaitingHumanAction) || app.stepBusy || revealLocked;
  }
  dom.autoPlayBtn.disabled = app.autoPlaying
    ? !app.currentGameId
    : !app.currentGameId || viewState?.phase === 'finished' || app.stepBusy || Boolean(viewState?.awaitingHumanAction) || revealLocked;
  setText(dom.autoPlayBtn, app.autoPlaying ? 'stop' : 'auto');
}

export function buildTextState(app, layout) {
  const state = app.currentState;
  return JSON.stringify({
    mode: state?.interactive ? 'interactive' : 'spectator',
    phase: state?.phase || 'idle',
    currentRank: state?.currentRank || null,
    pileSize: state?.pileSize || 0,
    awaitingHumanAction: state?.awaitingHumanAction || null,
    activePlayerId: layout.activePlayerId,
    utilityOpen: app.utilityOpen,
    sidebarTab: app.sidebarTab,
    attention: app.attention ? {
      playerIds: app.attention.playerIds,
      zones: app.attention.zones,
      variant: app.attention.variant,
    } : null,
    currentTurnFeed: state?.currentTurnFeed || null,
    slots: SLOT_IDS.map((slotId) => {
      const playerId = layout.slots[slotId];
      const player = state?.players?.find((entry) => entry.id === playerId);
      return {
        slotId,
        playerId,
        stagePosition: layout.slotMeta?.[slotId]?.stagePosition || slotId,
        facing: layout.slotMeta?.[slotId]?.facing || 'forward',
        name: getPlayerName(player),
        handSize: player?.handSize || 0,
        visible: Boolean(player?.handVisible),
        peekOpen: app.spectatorPeekPlayerId === playerId,
        status: player ? getSeatStatus(player, state) : 'empty',
      };
    }),
    selectedCards: [...app.selectedCards],
    transientReveal: app.transientReveal,
  });
}
