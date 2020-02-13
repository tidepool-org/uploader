### The uploader's usage of Redux for application state management

As of February of 2016, we have migrated the application state (including UI state) management in the Tidepool Uploader to [Redux](http://redux.js.org/). Redux is a lightweight but powerful state container for JavaScript applications that takes inspiration equally from (a) Facebook's [Flux](https://facebook.github.io/flux/) application architecture (especially its emphasis on one-way data flow) and (b) functional programming, in particular [Elm](http://elm-lang.org/), a functional programming language for building GUIs on the web.

Please read the general [Redux @ Tidepool](http://developer.tidepool.io/docs/front-end/redux/index.html 'Tidepool developer portal: Redux @ Tidepool') documentation before reading the documents listed below giving details of our usage of Redux in the Tidepool uploader.

Keep in mind also that we have [some work remaining](https://trello.com/c/mmMR0qpw 'Trello: align the uploader\'s use of Redux with blip\'s') to bring the uploader's Redux implementation more in line with that in Tidepool's main web application [blip](https://github.com/tidepool-org/blip 'GitHub: blip').

Detailed documentation on the uploader's Redux implementation:

- [Example state tree](ExampleStateTree.md)
- [Glossary of state tree terms](StateTreeGlossary.md)
- [Custom middleware](CustomMiddleware.md)
