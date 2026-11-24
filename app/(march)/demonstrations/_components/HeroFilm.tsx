"use client";

import { useState } from "react";
import { m } from "./classes";

/**
 * A past march's film in the hero, in its white frame. It shows `poster`
 * until it's played, and loads nothing of the film before. While it plays
 * it stands straight and a little larger, and goes back when it stops.
 */
export default function HeroFilm({ film }: { film: { src: string; poster: string; label: string } }) {
  const [playing, setPlaying] = useState(false);
  return (
    <video
      className={m(playing ? "hero-film hero-film-playing" : "hero-film")}
      src={film.src}
      poster={film.poster}
      controls
      playsInline
      preload="none"
      aria-label={film.label}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
    />
  );
}
