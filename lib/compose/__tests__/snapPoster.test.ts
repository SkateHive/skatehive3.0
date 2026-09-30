import assert from "node:assert/strict";
import { applyVideoPoster, selectSnapPoster } from "../snapPoster";

const POSTER = "https://ipfs.skatehive.app/ipfs/bafybeiposter";
const COVER = "https://ipfs.skatehive.app/ipfs/bafybeicover";
const VIDEO = "https://ipfs.skatehive.app/ipfs/bafybeivideo";

function run() {
  // Untrimmed upload: no captured frame, so the transcoder poster is the one to keep.
  assert.equal(selectSnapPoster(null, POSTER), POSTER);
  assert.equal(selectSnapPoster(undefined, `  ${POSTER}  `), POSTER);

  // A cover the author already captured wins over the generated frame.
  assert.equal(selectSnapPoster(COVER, POSTER), COVER);

  // A trim-modal blob is not durable. Fall through to the transcoder URL.
  assert.equal(selectSnapPoster("blob:http://localhost/frame", POSTER), POSTER);

  // Missing or unusable worker field keeps the previous behaviour.
  assert.equal(selectSnapPoster(null, undefined), null);
  assert.equal(selectSnapPoster(null, ""), null);
  assert.equal(selectSnapPoster(null, "not-a-url"), null);
  assert.equal(selectSnapPoster(null, "javascript:alert(1)"), null);

  const untrimmed = applyVideoPoster(
    { app: "Skatehive App 3.0", tags: ["snaps"], images: [] as string[] },
    VIDEO,
    POSTER,
  );
  assert.deepEqual(untrimmed.thumbnail, [POSTER]);
  assert.deepEqual(untrimmed.images, [POSTER]);
  assert.deepEqual(untrimmed.image, [POSTER]);

  // Photos already in `images` stay put. The video poster still lands on thumbnail.
  const withPhotos = applyVideoPoster(
    { images: ["https://ipfs.skatehive.app/ipfs/bafybeiphoto"] },
    VIDEO,
    POSTER,
  );
  assert.deepEqual(withPhotos.images, ["https://ipfs.skatehive.app/ipfs/bafybeiphoto"]);
  assert.deepEqual(withPhotos.thumbnail, [POSTER]);
  assert.equal(withPhotos.image, undefined);

  const untouched = applyVideoPoster(
    { images: [] as string[] },
    VIDEO,
    null,
  );
  assert.deepEqual(untouched, { images: [] });
  assert.equal("thumbnail" in untouched, false);

  const noVideo = applyVideoPoster({ images: [] as string[] }, null, POSTER);
  assert.deepEqual(noVideo, { images: [] });

  console.log("PASS: untrimmed snap poster selection and metadata");
}

run();
