# HuntJS: Backend

This package provides a simple API for defining GET and POST routes for puzzle
backends. It is intentially minimal to allow backend to be easily portable
between a server (for during the Hunt), or the browser (for static archiving
after the Hunt).

Your backend endpoints can accept GET or POST requests. GET requests can accept
JSON-encoded data as the "data" query parameter. POST requests can accept
JSON or url-encoded bodies. Backend endpoints always return JSON data.

Backend endpoints can also read/write from session data. During the Hunt, this
data will be stored in a MySQL database where it won't be accessible to
hunters -- browsers will just get a session ID, cryptographically signed to
prevent forgery. After the hunt, session data will be stored in localStorage
in the user's browser.

This NPM package uses two different implementations with the same API -- when
required in Node.JS, it acts as a thin wrapper around Express. When bundled
for the browser by Webpack (or most other bundlers, like Browserify), it
exposes an API that HuntJS-client can call as `window.__huntjs__`.


## Quickstart

```
import HuntJS from 'huntjs-server';

HuntJS.get('/example1', () => ({ some: 'response' }));

HuntJS.serve();
```

## Examples / Documentation

```
import HuntJS from 'huntjs-server';

// Simple GET route
HuntJS.get('/example1', () => {
  // This can be any data that can be JSON-encoded
  return {
    some: 'response';
  };
});

// GET data parameter -- e.g. /example2?data={foo:"bar"}
// HuntJS handles URL-decoding and JSON-parsing.
HuntJS.get('/example2', ({ data }) => {
  return {
    ohHiYouSaid: data.foo,
  },
});

// Simple POST route
HuntJS.post('/example3', () => {
  // This can be any data that can be JSON-encoded
  return {
    some: 'response';
  };
});

// Taking POST data. The body of the request may either be JSON-encoded
// and delivered with Content-Type: application/json, or it may be
// URL-encoded and delivered with Content-Type application/x-www-form-urlencoded
HuntJS.post('/example4', ({ data }) => {
  return {
    ohHiYouSaid: data.foo,
  },
});

// Getting and setting persistent session data
HuntJS.post('/example5save', ({ data, session }) => {
  session.set('mydata', data);

  return {
    saved: true,
  };
});
HuntJS.get('/example5load', ({ session }) => {
  return {
    savedData: session.mydata,
  },
});

// Returning an error
HuntJS.get('/example6', ({ data }) => {
  if (data.password !== 'letmein') {
    // First argument is the HTTP error code, the second is an error that
    // will be returned to the user.
    //
    // The "new" keyword is not needed; HuntJS.Error is a plain function.
    throw HuntJS.Error(422, '')
  }
});

// Returning a promise (for asynchronous responses)
HuntJS.get('/example7', () => {
  return new Promise((resolve, reject) => {
    doSomethingSlow((err, result) => {
      if (err) {
        reject(HuntJS.Error(500, 'Something failed'));
      } else {
        resolve({ some: 'data' });
      }
    });
  });
});
```

## Configuration

HuntJS is configured on the server using environment variables, and in
the browser using global constants (that should get filled in
by Webpack's DefinePlugin).

### Server Configuration

`HUNT_CORS_ALLOW_ALL`: Allow requests from any origin with CORS.

`HUNT_CORS_WHITELIST`: Comma-separated list of origins permitted to access this
backend with CORS.

`HUNT_SESSION_SECRET`: A random secret used to sign session cookies.

`HUNT_PORT`: What port to serve on
