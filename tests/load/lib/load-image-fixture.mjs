import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

export function createDeterministicImageFixture() {
  const bytes = Buffer.from(ONE_PIXEL_PNG_BASE64, "base64");
  return {
    bytes,
    checksum: createHash("sha256").update(bytes).digest("base64"),
    contentLength: bytes.length,
    contentType: "image/png",
    filename: "load-fixture.png",
  };
}
