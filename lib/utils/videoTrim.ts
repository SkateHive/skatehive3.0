/**
 * Client-side video trimming via canvas + MediaRecorder.
 *
 * Re-encodes the selected [start, end] range of a video File into a WebM Blob,
 * preserving aspect ratio and capping at 1920x1080. Used by the media-prepare
 * flow before the trimmed clip is uploaded to the transcoder.
 *
 * Extracted from VideoTrimModal so the same logic can run at publish time
 * (trim is applied when the user confirms, not at file-selection time).
 */
export async function createTrimmedVideo(
  file: File,
  start: number,
  end: number
): Promise<Blob> {
  console.log(`🎬 Creating trimmed video: ${start}s to ${end}s`);

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = end - start;

      if (duration <= 0 || start >= video.duration) {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Invalid trim range"));
        return;
      }

      // Create canvas for recording with optimized settings
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });

      if (!ctx) {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Preserve original aspect ratio while limiting max resolution
      const originalWidth = video.videoWidth;
      const originalHeight = video.videoHeight;
      const aspectRatio = originalWidth / originalHeight;

      let canvasWidth = originalWidth;
      let canvasHeight = originalHeight;

      const maxWidth = 1920;
      const maxHeight = 1080;

      if (canvasWidth > maxWidth) {
        canvasWidth = maxWidth;
        canvasHeight = Math.round(maxWidth / aspectRatio);
      }

      if (canvasHeight > maxHeight) {
        canvasHeight = maxHeight;
        canvasWidth = Math.round(maxHeight * aspectRatio);
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000, // 2.5 Mbps — quality/size balance
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        URL.revokeObjectURL(videoUrl);
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Recording failed"));
      };

      video.currentTime = start;

      video.onseeked = () => {
        mediaRecorder.start(100); // 100ms chunks

        video.play().catch((error) => {
          console.error("Video play error:", error);
          URL.revokeObjectURL(videoUrl);
          reject(new Error("Video playback failed"));
        });

        setTimeout(() => {
          video.pause();
          mediaRecorder.stop();
        }, duration * 1000);
      };

      let animationId: number;
      const drawFrame = () => {
        if (!video.paused && !video.ended && video.currentTime < end) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          animationId = requestAnimationFrame(drawFrame);
        }
      };

      video.onplay = () => drawFrame();
      video.onpause = () => {
        if (animationId) cancelAnimationFrame(animationId);
      };
      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Video playback error"));
      };
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error("Failed to load video"));
    };
  });
}
