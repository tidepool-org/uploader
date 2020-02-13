## CSS modules

### CSS what?
For a quick breakdown on what CSS modules are, check out [Glen Maddern's post ](http://glenmaddern.com/articles/css-modules) which summarizes pretty well.

### How they're used here
CSS modules allow for module-scoped styling for components. This is done by `require`ing the styles file and allowing the [Webpack CSS loader](https://github.com/webpack/css-loader) to process the file as a module. Since there are some styles that need to remain global (mainly webfonts and styles for 3rd party components), we selectively use the CSS module loader through a naming convention of `.module.less` for modules vs simply `.less` for a non-CSS-module Webpack loader chain.

Whenever a `.module.less` file is `require`d, it will be passed through the CSS module loader and have all it's class names transformed and exported. CSS modules also have a mechanism for extending and sharing class names across files through the `composes` keyword. Any file that is referenced by a `compose` will also be processed as a CSS module, regardless of file extension. In this way, we can use a normal `.less` file in a `compose` and gain the benefit of scoped, shared style classes while still letting the styles be used in a more traditional context as necessary (like being referenced though a LESS `extend` which would break if class names were transformed). In the following example, `coolText.less` will be processed and have a scoped form of neatStyle generated (something like `coolText_neatStyle__3woeh`) which will be paired with the scoped form of `awesomeClass` in the CSS module export list.

```css
.awesomeClass {
  composes: neatStyle from '../coolText.less'
}
```

In general, all of the components will have a `.module.less` as the styles are `require`d from within the JavaScript of the component. The files under `/styles/core` are a slightly mixed bag as they aren't generally `require`d individually from a JavaScript file (excepting `main.less`). The files in `/core` marked as modules don't use any module-incompatible LESS syntax features and are intended to be used as single-responsibility modules solely through the `composes` keyword from other `.module.less` files. The plain `.less` files can be used through `composes`, but for one reason or another require the ability to be used in a global context in addition to a scoped context and therefore cannot be exclusively loaded by the Webpack CSS module loader.

### Concerning classnames
When creating names for classes in a CSS module, it's good to keep in mind the final use for the file. If one is going to be `require`ing the file for inclusion in a JavaScript module, then a good practice is to keep all the names camelCase in order to ease addressing them in React/JSX components. For example,
```css
.classOne {
  color: #BADA55;
}
.class-two {
  color: #C0FFEE;
}
```
In order to use these class names in JSX it would look something like this:
```JavaScript
<div className={styles.classOne}>One</div>
<div className={styles['class-two']}>Two</div>
```
where the first is less cumbersome.

If the module that you're creating will be a single-responsibility module (like `typography` or `layout`) and will only ever have it's class names referenced by external `composes` from other modules, then the advantage of the JSX syntax simplicity isn't present. If there's some reason to not use camelCase (e.g. legacy code or third party dependency) then it may make more sense to use another naming scheme. In general, for consistency, default to camelCase when possible.
