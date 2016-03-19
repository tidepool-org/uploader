Reference documentation for application/UI state in the Tidepool Uploader.

As of February of 2016, we have migrated the application state (including UI state) management in the Tidepool Uploader to [redux](http://redux.js.org/). Redux is a lightweight but powerful state container for JavaScript applications that takes inspiration equally from (a) Facebook's [Flux](https://facebook.github.io/flux/) application architecture (especially its emphasis on one-way data flow) and (b) functional programming, in particular [Elm](http://elm-lang.org/), a functional programming language for building GUIs on the web.

The redux documentation is very well-written. If you are unfamiliar with the library, we recommended starting with the redux [Basics](http://redux.js.org/docs/basics/index.html) docs to familiarize yourself with the standard redux vocabulary before reading more of the documentation here about our use of redux in the Tidepool Uploader.

- [Example state tree](ExampleStateTree.md)
- [Glossary of state tree terms](StateTreeGlossary.md)
- [Custom middleware](CustomMiddleware.md)
