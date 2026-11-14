import assert from "assert";
import {
  getYouTubeVideoId,
  isYouTubeUrl,
  youtubeEmbedUrl,
  youtubePosterUrl,
} from "../youtube";

const ID = "DXuq2P0xFg0";

assert.strictEqual(
  getYouTubeVideoId(`https://www.youtube.com/embed/${ID}`),
  ID,
  "embed url from the sktbr snap"
);
assert.strictEqual(
  getYouTubeVideoId(`https://www.youtube.com/embed/${ID}?feature=share`),
  ID,
  "embed url keeps the id when query params are present"
);
assert.strictEqual(
  getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  "dQw4w9WgXcQ",
  "watch url"
);
assert.strictEqual(
  getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"),
  "dQw4w9WgXcQ",
  "short url"
);
assert.strictEqual(
  getYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
  "dQw4w9WgXcQ",
  "shorts url"
);
assert.strictEqual(
  getYouTubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
  "dQw4w9WgXcQ",
  "nocookie embed"
);
assert.strictEqual(
  getYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share"),
  "dQw4w9WgXcQ",
  "mobile watch url"
);
assert.strictEqual(
  getYouTubeVideoId("https://odysee.com/$/embed/@sktbr/abc"),
  null,
  "odysee embed is not youtube"
);
assert.strictEqual(
  getYouTubeVideoId("https://ipfs.skatehive.app/ipfs/bafybeigdyrzt5sfp7"),
  null,
  "ipfs file is not youtube"
);
assert.strictEqual(getYouTubeVideoId("https://www.youtube.com/embed/short"), null);
assert.strictEqual(getYouTubeVideoId(""), null);
assert.strictEqual(getYouTubeVideoId(null), null);

assert.strictEqual(isYouTubeUrl(`https://www.youtube.com/embed/${ID}`), true);
assert.strictEqual(isYouTubeUrl("https://odysee.com/$/embed/@sktbr/abc"), false);

assert.strictEqual(
  youtubeEmbedUrl(ID),
  `https://www.youtube.com/embed/${ID}?autoplay=1&mute=1&playsinline=1`
);
assert.strictEqual(
  youtubePosterUrl(ID),
  `https://img.youtube.com/vi/${ID}/hqdefault.jpg`
);

console.log("youtube url tests passed");
