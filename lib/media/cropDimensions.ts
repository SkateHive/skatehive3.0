/**
 * Pure crop-output sizing for the shared media editor (ImageCropper).
 *
 * Given a target aspect (width / height) and a max long-side dimension,
 * compute the output canvas size. The long side is clamped to `maxDimension`
 * so cropped images/covers stay Instagram-friendly and light.
 */
export function computeCropOutput(
  aspect: number,
  maxDimension: number
): { width: number; height: number } {
  // Guard against bad input — fall back to a square at the max dimension.
  if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(maxDimension) || maxDimension <= 0) {
    const side = Number.isFinite(maxDimension) && maxDimension > 0 ? Math.round(maxDimension) : 1080;
    return { width: side, height: side };
  }

  if (aspect >= 1) {
    // Square or landscape → width is the long side.
    return { width: Math.round(maxDimension), height: Math.round(maxDimension / aspect) };
  }
  // Portrait → height is the long side.
  return { width: Math.round(maxDimension * aspect), height: Math.round(maxDimension) };
}
