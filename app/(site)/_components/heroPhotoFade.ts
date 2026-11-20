// The script that fades each hero photo in as it loads, to soften the pop as
// photos land. HomeHero puts it inline, above the photos, so it's listening
// before the first of them arrives and never waits for React to start: a
// photo is never hidden, so one that has loaded shows at once. It starts the
// fade with the browser's animation call rather than an attribute or class,
// which would differ from the HTML React hydrates against. Without
// JavaScript the photos just show.
//
// Load events don't bubble, so one listener on the document catches them as
// they're captured. Running it again does nothing (HeroMarqueeEffects).
export const HERO_PHOTO_FADE_SCRIPT = `if(!window.heroPhotoFade){window.heroPhotoFade=true;document.addEventListener("load",function(event){var img=event.target;if(img.tagName==="IMG"&&img.closest('[data-marquee-track="hero"]'))img.animate([{opacity:0},{opacity:1}],{duration:380,easing:"ease-out"})},true)}`;
