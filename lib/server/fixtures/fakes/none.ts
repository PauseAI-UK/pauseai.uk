import type { Fake } from "../fake";

/** For a service no fixture build calls, such as Netlify's background functions: nothing answers. */
export const noFake: Fake = () => undefined;
