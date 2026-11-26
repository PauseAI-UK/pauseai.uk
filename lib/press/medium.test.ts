import { describe, expect, it } from "vitest";
import { mediumOf } from "./medium";

describe("mediumOf", () => {
  it("is a video on a video site, or one of its subdomains", () => {
    expect(mediumOf("https://www.youtube.com/watch?v=abc")).toBe("Video");
    expect(mediumOf("https://youtu.be/abc")).toBe("Video");
    expect(mediumOf("https://m.tiktok.com/@pauseai/123")).toBe("Video");
  });

  it("is a video when the page says it is one, in any case", () => {
    expect(mediumOf("https://www.example.org/news/march", "video.other")).toBe("Video");
    expect(mediumOf("https://www.example.org/news/march", "VIDEO")).toBe("Video");
    expect(mediumOf("https://www.example.org/news/march", "article")).toBe("Article");
  });

  it("is a video at a video page's address", () => {
    expect(mediumOf("https://www.bbc.co.uk/news/av/uk-123")).toBe("Video");
    expect(mediumOf("https://www.example.org/videos/march")).toBe("Video");
    expect(mediumOf("https://www.example.org/news/clip")).toBe("Video");
  });

  it("is photos on a photo agency's site, or one of its subdomains", () => {
    expect(mediumOf("https://www.alamy.com/stock-photo-march-123.html")).toBe("Photos");
    expect(mediumOf("https://media.gettyimages.co.uk/detail/123")).toBe("Photos");
  });

  it("is photos at a gallery's address", () => {
    expect(mediumOf("https://www.example.org/news/in-pictures/march")).toBe("Photos");
    expect(mediumOf("https://www.example.org/gallery-march-on-whitehall")).toBe("Photos");
    expect(mediumOf("https://www.example.org/photos")).toBe("Photos");
  });

  it("is an article otherwise, on a site whose name only ends like a video site's", () => {
    expect(mediumOf("https://www.example.org/news/march")).toBe("Article");
    expect(mediumOf("https://notyoutube.com/news/march")).toBe("Article");
    expect(mediumOf("https://www.example.org/watchdog-warns")).toBe("Article");
  });

  it("is an article at an address that can't be parsed, unless the page says it's a video", () => {
    expect(mediumOf("not a link")).toBe("Article");
    expect(mediumOf("not a link", "video")).toBe("Video");
  });
});
