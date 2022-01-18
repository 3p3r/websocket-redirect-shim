'use strict';

/* global window, WebSocket*/

(function (WebSocketNative = window.WebSocket) {
  const debug = require('debug')('ws:redirect');
  debug('patching native WebSocket class to support HTTP redirects');
  const statics = Object.keys(WebSocketNative);
  debug('websocket statics: "%o"', statics);
  window.WebSocket = class {
    constructor(url, ...args) {
      this.work = [];
      this.endpoint = url.replace(/^http/, 'ws');
      debug('ws constructed with url: "%s" and endpoint: "%s"', url, this.endpoint);
      return (
        (async () => {
          try {
            const resolver =
              window.WEBSOCKET_REDIRECT_RESOLVER || `${location.protocol}//${location.host}${location.pathname}`;
            debug('websocket address resolver: "%s"', resolver);
            const endpoint = `${resolver}?url=${encodeURIComponent(this.endpoint)}`;
            debug('resolver query endpoint: "%s"', endpoint);
            const response = await fetch(endpoint);
            debug('resolver query response: "%o"', response);
            const { dig, dug } = await response.json();
            debug('resolver dig: "%o" dug: "%o"', dig, dug);
            this.endpoint = dug;
          } catch (err) {
            debug('failed to query for a redirect: "%o"', err);
          } finally {
            debug('websocket final endpoint: "%s"', this.endpoint);
            this.socket = new WebSocketNative(this.endpoint, ...args);
            debug('flushing %d queued operations', this.work.length);
            for (const op of this.work) {
              try {
                op(this.socket);
              } catch (err) {
                debug('failed to execute queued: %o', err);
              }
            }
          }
        })(),
        new Proxy(this, {
          get: function (target, prop) {
            debug('GETTER trace: "%s"', prop);
            if (statics.includes(prop)) {
              debug('GETTER "%s" is a static', prop);
              return Reflect.get(WebSocketNative, prop);
            }
            switch (prop) {
              default:
                debug('GETTER "%s" does not go through proxy', prop);
                return Reflect.get(...arguments);
              case 'readyState':
              case 'bufferedAmount':
                return this.socket ? Reflect.get(this.socket, prop) : 0;
              case 'binaryType':
                return this.socket ? Reflect.get(this.socket, prop) : 'blob';
              case 'extensions':
              case 'protocol':
              case 'url':
                return this.socket ? Reflect.get(this.socket, prop) : '';
              case 'send':
              case 'close':
              case 'dispatchEvent':
              case 'addEventListener':
              case 'removeEventListener':
                return this.socket
                  ? Reflect.get(this.socket, prop)
                  : function (...args) {
                      if (target.socket) {
                        debug('socket is ready, skip queueing get "%s" with args "%o"', prop, args);
                        return Reflect.get(target.socket, prop).call(target.socket, ...args);
                      } else {
                        debug('socket is not ready yet. queueing get "%s" with args "%o"', prop, args);
                        target.work.push((socket) => Reflect.get(socket, prop).call(socket, ...args));
                      }
                    };
            }
          },
          set: function (target, prop, value) {
            debug('SETTER trace: "%s"="%o"', prop, value);
            switch (prop) {
              default:
                return Reflect.set(...arguments);
              case 'binaryType':
              case 'onmessage':
              case 'onerror':
              case 'onclose':
              case 'onopen':
                return this.socket
                  ? Reflect.set(this.socket, prop, value)
                  : (() => {
                      if (target.socket) {
                        debug('socket is ready, skip queueing set "%s" with value "%o"', prop, value);
                        Reflect.set(socket, prop, value);
                      } else {
                        debug('socket is not ready yet, queueing set "%s" with value "%o"', prop, value);
                        target.work.push((socket) => Reflect.set(socket, prop, value));
                      }
                      return true;
                    })();
            }
          },
        })
      );
    }
  };
})(window.WebSocket);
