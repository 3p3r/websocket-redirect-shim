'use strict';

/* global window, WebSocket*/

(function (WebSocketNative = window.WebSocket) {
  const debug = require('debug')('ws:redirect');
  debug('patching native WebSocket class to support HTTP redirects');
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
          } finally {
            debug('websocket final endpoint: "%s"', this.endpoint);
            this.socket = new WebSocketNative(this.endpoint, ...args);
            debug('flushing %d queued operations', this.work.length);
            for (const op of this.work) op(this.socket);
          }
        })(),
        new Proxy(this, {
          get: function (target, prop) {
            debug('GETTER trace: "%s"', prop);
            switch (prop) {
              case 'construct':
              case 'endpoint':
              case 'socket':
              case 'work':
                debug('GETTER "%s" does not go through proxy', prop);
                return Reflect.get(...arguments);
              case 'OPEN':
              case 'CLOSED':
              case 'CLOSING':
              case 'CONNECTING':
                debug('GETTER "%s" is a static', prop);
                return Reflect.get(WebSocketNative, prop);
              case 'readyState':
              case 'bufferedAmount':
                return this.socket ? Reflect.get(this.socket, prop) : 0;
              case 'binaryType':
                return this.socket ? Reflect.get(this.socket, prop) : 'blob';
              case 'extensions':
              case 'protocol':
              case 'url':
                return this.socket ? Reflect.get(this.socket, prop) : '';
              default:
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
              case 'endpoint':
              case 'socket':
              case 'work':
                return Reflect.set(...arguments);
              default:
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
