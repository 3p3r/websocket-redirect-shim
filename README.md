# websocket-redirect-shim

a shim (patch) to support WebSocket redirect requests in browsers

## prerequisite

this shim needs a server-side helper to resolve the eventual WebSocket address for it. the server side helper is also
written in NodeJS and requires the [serverless framework](https://www.serverless.com/) to deploy into AWS.

deploy with:

```bash
serverless deploy
```

example output:

```bash
$ serverless deploy
Serverless: Packaging service...
Serverless: Excluding development dependencies...
Serverless: Ensuring that deployment bucket exists
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading artifacts...
Serverless: Uploading service websocket-redirect-shim.zip file to S3 (9.32 MB)...
Serverless: Validating template...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
..............
Serverless: Stack update finished...
Service Information
service: websocket-redirect-shim
stage: dev
region: us-east-1
stack: websocket-redirect-shim-dev
resources: 12
api keys:
  None
endpoints:
  GET - <endpoint URL>
functions:
  resolve: websocket-redirect-shim-dev-resolve
layers:
  None
```

`<endpoint URL>` is where you'll find the shim's JavaScript and the same endpoint can resolve an address after redirects
for you if you pass it a `?url=` query string. Both HTTP and WS URL schemes are supported. You do not need to directly
work with the resolver. The patch internally handles that.

this server helper is necessary due to the fact that currently it's impossible to detect AND follow a URL manually in
all major browsers. both the `fetch()` api and `XMLHttpRequest` object cannot do that and gymnastics with `iframe`s do
not interest me. in a browser redirects are handled internally and transparently and are not exposed to end user.

## usage

Just include the patch somewhere before you create a `WebSocket` in a browser. As soon as you create the socket, a GET
request will be made to your provided websocket endpoint. If response comes back with a 3xx status, resolver will follow
it until status no longer sets to 3xx and your `WebSocket` instance will get connected to the last redirect in the chain

## polyfilled vs lean

After you `npm install` in this repo, you get a polyfilled version (`websocket-redirect-shim.polyfill.min.js`) and a
lean version (`websocket-redirect-shim.min.js`). Use the lean version if you are sure about the browser environment you
need this patch in. Your environment needs to support these features:

- Async/Await
- WebSocket
- Reflect
- Proxy

## `window.WEBSOCKET_REDIRECT_RESOLVER`

The patch looks for the resolver endpoint through this variable. If you use the patch through the helper Lambda, the
patch script file will have this defined at its top.
