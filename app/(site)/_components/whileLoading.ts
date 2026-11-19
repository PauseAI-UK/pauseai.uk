// The script that marks the home page as still loading: `data-loading` on
// <html>, from when the hero is parsed until the page's load event, or ten
// seconds, whichever is first. While it's there, styles hold back the photos
// a visitor can't see yet (styles/base.css, HomeHero.module.css). A browser
// would fetch them alongside the ones they can see, and on a slow connection
// whatever is being fetched shares the line.
//
// Inline, so it runs before anything is fetched, and only when the home page
// is the first page loaded: React doesn't run a script in a page it renders
// in the browser, and by then there's nothing to wait for. Without JavaScript
// nothing is held back.
export const WHILE_LOADING_SCRIPT = `(function(){var root=document.documentElement;function loaded(){root.removeAttribute("data-loading")}root.setAttribute("data-loading","");addEventListener("load",loaded);setTimeout(loaded,10000)})()`;
