## Custom Middleware

One of the great benefits of [redux](http://redux.js.org/) is the easy path it provides for writing middleware to perform various actions in response to some or all of the redux actions that are the source of all changes to the application's state tree. The open-source community provides some great middleware options like the [redux logger](https://github.com/fcomb/redux-logger) that we include behind an environment variable to assist in development.

In the Tidepool Uploader, we also include two custom middlewares: one for making calls to our metrics API and one for logging application errors.

The source for the metrics middleware is found in `lib/redux/utils/metrics.js`. It performs a call to the Tidepool metrics API for any redux action that includes a `metric` property inside its `meta` property.

The source of the error-logging middleware is found in `lib/redux/utils/errors.js`. It performs a call to the Tidepool server-side error logging for any redux action that has the boolean flag `error` as true and a JavaScript `Error` object as its `payload`.

If the source code of our custom middlewares confuses more than it answers questions, we recommended reading the excellent [intro to middleware](http://redux.js.org/docs/advanced/Middleware.html) included in the redux documentation.
