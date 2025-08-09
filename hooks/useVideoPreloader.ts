import { useEffect, useRef, useState } from 'react';

interface PreloadedVideo {
  src: string;
  element: HTMLVideoElement;
  isLoaded: boolean;
}

export const useVideoPreloader = (videoSources: string[], currentIndex: number) => {
  const preloadedVideos = useRef<Map<string, PreloadedVideo>>(new Map());
  const [loadingStatus, setLoadingStatus] = useState<Record<string, boolean>>({});

  // Create and preload video elements
  useEffect(() => {
    const preloadNext = (index: number, lookahead: number = 4) => { // Increased from 2 to 4
      for (let i = 1; i <= lookahead; i++) {
        const nextIndex = index + i;
        if (nextIndex >= videoSources.length) continue;
        
        const src = videoSources[nextIndex];
        if (!src || preloadedVideos.current.has(src)) continue;

        // Create video element for preloading
        const video = document.createElement('video');
        video.src = src;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto'; // More aggressive preloading
        video.crossOrigin = 'anonymous';
        
        // Hide the video element
        video.style.position = 'absolute';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        
        const preloadedVideo: PreloadedVideo = {
          src,
          element: video,
          isLoaded: false
        };

        // Track loading status
        setLoadingStatus(prev => ({ ...prev, [src]: true }));

        video.addEventListener('loadeddata', () => {
          preloadedVideo.isLoaded = true;
          setLoadingStatus(prev => ({ ...prev, [src]: false }));
          console.log(`Video preloaded: ${src.substring(0, 50)}...`);
        });

        video.addEventListener('error', (e) => {
          const errorTarget = e.target as HTMLVideoElement;
          const errorCode = errorTarget.error?.code;
          const errorMessage = errorTarget.error?.message || 'Unknown error';
          
          // Only log meaningful errors, not network timeouts
          if (errorCode !== 3) { // MEDIA_ERR_DECODE = 3
            console.warn(`Failed to preload video (${errorCode}): ${errorMessage}`);
          }
          
          setLoadingStatus(prev => ({ ...prev, [src]: false }));
          preloadedVideos.current.delete(src);
          try {
            document.body.removeChild(video);
          } catch (removeError) {
            // Element might already be removed
          }
        });

        // Add to DOM to start loading
        document.body.appendChild(video);
        preloadedVideos.current.set(src, preloadedVideo);
      }
    };

    // Preload videos around current index
    preloadNext(currentIndex);

    // Cleanup old preloaded videos that are too far away
    const cleanup = () => {
      preloadedVideos.current.forEach((preloadedVideo, src) => {
        const videoIndex = videoSources.indexOf(src);
        const distance = Math.abs(videoIndex - currentIndex);
        
        // Remove videos that are more than 3 positions away
        if (distance > 3) {
          try {
            document.body.removeChild(preloadedVideo.element);
          } catch (e) {
            // Element might already be removed
          }
          preloadedVideos.current.delete(src);
          setLoadingStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[src];
            return newStatus;
          });
        }
      });
    };

    cleanup();
  }, [currentIndex, videoSources]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preloadedVideos.current.forEach((preloadedVideo) => {
        try {
          document.body.removeChild(preloadedVideo.element);
        } catch (e) {
          // Element might already be removed
        }
      });
      preloadedVideos.current.clear();
    };
  }, []);

  const getPreloadedVideo = (src: string): HTMLVideoElement | null => {
    const preloaded = preloadedVideos.current.get(src);
    return preloaded?.isLoaded ? preloaded.element : null;
  };

  const isVideoPreloaded = (src: string): boolean => {
    const preloaded = preloadedVideos.current.get(src);
    return preloaded?.isLoaded || false;
  };

  const isVideoLoading = (src: string): boolean => {
    return loadingStatus[src] || false;
  };

  return {
    getPreloadedVideo,
    isVideoPreloaded,
    isVideoLoading,
    preloadedCount: preloadedVideos.current.size
  };
};
