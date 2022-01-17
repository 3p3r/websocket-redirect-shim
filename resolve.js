'use strict';

const _ = require('lodash');
const { ok } = require('assert');
const { URL } = require('url');
const { promises: fs } = require('fs');
const { default: axios } = require('axios');

async function main(evt, ctx) {
  console.log('event:', evt);
  console.log('context:', ctx);
  try {
    const dig = _.get(evt, 'queryStringParameters.url', '');
    console.log('dig:', dig);
    const agw = {
      host: _.get(evt, 'headers.Host', ''),
      stage: _.get(evt, 'requestContext.stage', ''),
      resource: _.get(evt, 'requestContext.resourcePath', ''),
    };
    const agwUrl = `https://${agw.host}/${agw.stage}${agw.resource}`;
    if (dig === '' && isHttpUrl(agwUrl)) {
      console.log('dig is empty and we are hosted in API Gateway, returning the shim.');
      const patch = await fs.readFile('websocket-redirect-shim.polyfilled.min.js', { encoding: 'utf-8' });
      const script = `;window.WEBSOCKET_REDIRECT_RESOLVER='${agwUrl}';${patch};`;
      return createResponse(200, script, {
        'Content-Type': 'application/javascript; charset=utf-8',
      });
    }
    ok(isWebUrl(dig), 'dig is not a valid WEB URL');
    const dug = await followRecursive(dig);
    ok(isWsUrl(dug), 'dug is not a valid WS URL');
    return createResponse(200, { dig, dug });
  } catch (err) {
    console.error('error:', err);
    return createResponse(500);
  }
}

const createResponse = (statusCode = 200, body = {}, headers = {}) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  },
  body: _.isString(body) ? body : JSON.stringify(body),
});

const isWebUrl = (s) => isWsUrl(s) || isHttpUrl(s);
const isHttpUrl = (s) => isUrl(s, ['http', 'https']);
const isWsUrl = (s) => isUrl(s, ['ws', 'wss']);
const isUrl = (s, protocols) => {
  try {
    const parsed = new URL(s);
    return protocols
      ? parsed.protocol
        ? protocols.map((x) => `${x.toLowerCase()}:`).includes(parsed.protocol)
        : false
      : true;
  } catch (err) {
    return false;
  }
};

const followRecursive = async function (url = 'wss://...', limit = 24) {
  const response = await followOnce(url);
  if (limit < 0 || response === url) return url;
  else return await followRecursive(response, --limit);
};
const followOnce = async function (url = 'wss://...') {
  try {
    const endpoint = url.replace(/^ws/, 'http');
    const response = await axios.get(endpoint, {
      validateStatus: (status) => status >= 200 && status < 400,
      maxRedirects: 0,
    });
    if (response.status >= 300) {
      const location = response.headers['location'];
      ok(isWebUrl(location), 'location is not a valid WEB URL');
      return location;
    }
  } catch (err) {
    console.log('follow once failed:', err);
  }
  return url;
};

module.exports = { main };
