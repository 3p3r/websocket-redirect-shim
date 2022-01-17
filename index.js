'use strict';

/* global window, document*/

// core-js provides Reflect API shim
require('core-js/stable');
// this library from Google provides Proxy API shim
require('proxy-polyfill');
// regenerator-runtime provides async/await shims
require('regenerator-runtime/runtime');

require('./patch');
