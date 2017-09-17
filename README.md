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
  session.set({ mydata: data });

  return {
    saved: true,
  };
});
HuntJS.get('/example5load', ({ session }) => {
  const sessionData = session.get({
    defaultValue: { mydata: 10 },
  });

  return {
    savedData: sessionData.mydata,
  };
});

// Getting and setting team-wide session data
//
// A few notes about team-wide data:
//   - We authenticate the user's team, so the user cannot reset team-wide
//     data by just clearing their cookies (like they can with session data)
//   - When setting default team-wide data, it's safe to dynamically generate
//     the default values (e.g. randomize the value). The team-wide data
//     storage system has been designed to handle concurrency -- even if two
//     requests come in simulatenously, only one server will set the default
//     value and the other server will load that value.
//   - Fetching and saving team-wide data is asynchronous. Use async/await.
HuntJS.post('/example6save', async ({ data, team }) => {
  await team.set({ someData: data });

  return {
    saved: true,
  };
});
HuntJS.get('/example6load', ({ session }) => {
  const teamData = await team.get({
    defaultValue: { someData: Math.random() },
  });

  return {
    savedData: teamData.someData,
  };
});

// Returning an error
HuntJS.get('/example7', ({ data }) => {
  if (data.password !== 'letmein') {
    // First argument is the HTTP error code, the second is an error that
    // will be returned to the user.
    //
    // The "new" keyword is not needed; HuntJS.Error is a plain function.
    throw HuntJS.Error(422, '')
  }
});

// We're running on Node 8, so you can use async functions
HuntJS.get('/example8', async () => {
  const x = await doSomethingThatReturnsAPromise();

  resolve({ result: x });
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
