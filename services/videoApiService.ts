interface VideoUploadResult {
  cid: string;
  gatewayUrl: string;
}

interface VideoUploadOptions {
  creator: string;
  thumbnailUrl?: string;
  platform?: string;           // 'web' | 'mobile' | 'desktop'
  deviceInfo?: string;         // Device fingerprint
  browserInfo?: string;        // Browser details
  userHP?: number;            // User's Hive Power
  viewport?: string;          // Screen resolution
  connectionType?: string;    // Network connection info
}

interface VideoConversionResponse {
  success: boolean;
  ipfsUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  processingTime?: number;
  cid?: string;
  gatewayUrl?: string;
}

interface VideoConversionRequest {
  video: File;
  creator: string;
  thumbnailUrl?: string;
}

class VideoApiService {
  private readonly oracleApiUrl = 'https://transcode.skatehive.app';
  private readonly macMiniApiUrl = 'https://minivlad.tail83ea3e.ts.net/video';
  private readonly raspberryPiApiUrl = 'https://vladsberry.tail83ea3e.ts.net/video';

  // Conversion timeout (15 minutes for larger files)
  private readonly CONVERSION_TIMEOUT = 900000;

  // Request retry configuration
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 1000;

  /**
   * Generate a correlation ID for tracking requests
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect device and browser information for logging (Enhanced version)
   */
  private getDeviceInfo(): {
    platform: string;
    deviceInfo: string;
    browserInfo: string;
    viewport: string;
    connectionType: string;
  } {
    const ua = navigator.userAgent;
    const platform = navigator.platform;

    // Enhanced device type detection
    let deviceType = 'desktop';
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      deviceType = 'mobile';
      if (/iPad/i.test(ua)) deviceType = 'tablet';
    }

    // Enhanced OS detection
    let os = 'unknown';
    if (/Mac/i.test(platform)) os = 'macOS';
    else if (/Win/i.test(platform)) os = 'Windows';
    else if (/Linux/i.test(platform)) os = 'Linux';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';

    // Enhanced browser detection
    let browser = 'unknown';
    if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edge|Edg/i.test(ua)) browser = 'Edge';

    return {
      platform: deviceType,
      deviceInfo: `${deviceType}/${os}/${browser}`,
      browserInfo: `${browser} on ${os}`,
      viewport: `${window.screen.width}x${window.screen.height}`,
      connectionType: (navigator as any).connection?.effectiveType || 'unknown'
    };
  }

  /**
   * Enhanced FormData construction with device and user information
   */
  private buildEnhancedFormData(
    video: File,
    options: VideoUploadOptions,
    correlationId: string
  ): FormData {
    const deviceInfo = this.getDeviceInfo();
    const formData = new FormData();

    // Core video data
    formData.append('video', video);
    formData.append('creator', options.creator);

    // Enhanced tracking information
    formData.append('platform', options.platform || deviceInfo.platform);
    formData.append('deviceInfo', options.deviceInfo || deviceInfo.deviceInfo);
    formData.append('browserInfo', options.browserInfo || deviceInfo.browserInfo);
    formData.append('viewport', options.viewport || deviceInfo.viewport);
    formData.append('correlationId', correlationId);

    // User context
    if (options.userHP !== undefined) {
      formData.append('userHP', options.userHP.toString());
    }

    // Connection info
    if (deviceInfo.connectionType !== 'unknown') {
      formData.append('connectionType', options.connectionType || deviceInfo.connectionType);
    }

    // Optional fields
    if (options.thumbnailUrl) {
      formData.append('thumbnailUrl', options.thumbnailUrl);
    }

    return formData;
  }

  /**
   * Upload video to the transcoding API (simplified approach like mobile app)
   * @param video - Video file to upload
   * @param options - Upload options including creator
   * @returns Promise with CID and gateway URL
   */
  async uploadVideoToWorker(
    video: File,
    options: VideoUploadOptions
  ): Promise<VideoUploadResult> {
    const WORKER_API_URL = `${this.oracleApiUrl}/transcode`;
    const correlationId = this.generateCorrelationId();

    try {
      console.log('🎬 Starting video upload to worker...', {
        correlationId,
        creator: options.creator,
        fileSize: `${(video.size / 1024 / 1024).toFixed(2)}MB`,
        fileName: video.name
      });

      // Create enhanced FormData with device and user information
      const formData = this.buildEnhancedFormData(video, options, correlationId);

      const uploadResponse = await fetch(WORKER_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Video worker upload failed:', {
          correlationId,
          status: uploadResponse.status,
          error: errorText
        });
        throw new Error(`Video upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json();

      if (!result.cid || !result.gatewayUrl) {
        throw new Error('Invalid response from video upload service');
      }

      console.log('✅ Video upload successful:', {
        correlationId,
        cid: result.cid,
        creator: options.creator
      });
      return {
        cid: result.cid,
        gatewayUrl: result.gatewayUrl,
      };
    } catch (error) {
      console.error('Failed to upload video to worker:', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload video using size-based routing strategy
   * @param video - Video file to upload
   * @param options - Upload options including creator
   * @returns Promise with CID and gateway URL
   */
  async uploadVideo(
    video: File,
    options: VideoUploadOptions
  ): Promise<VideoUploadResult> {
    const deviceInfo = this.getDeviceInfo();

    console.log('🎬 Starting video upload process...', {
      fileName: video.name,
      fileSize: `${(video.size / 1024 / 1024).toFixed(2)}MB`,
      fileType: video.type,
      creator: options.creator,
      platform: options.platform || deviceInfo.platform,
      browserInfo: deviceInfo.browserInfo,
      viewport: deviceInfo.viewport
    });

    // Always use direct upload to avoid Vercel proxy size limits
    console.log('🎬 Using direct upload (no proxy size limits)');
    return this.uploadVideoDirectly(video, {
      ...options,
      platform: options.platform || deviceInfo.platform,
      deviceInfo: options.deviceInfo || deviceInfo.deviceInfo,
      browserInfo: options.browserInfo || deviceInfo.browserInfo,
      viewport: options.viewport || deviceInfo.viewport,
      connectionType: options.connectionType || deviceInfo.connectionType
    });
  }

  /**
   * Upload video directly to APIs (for production to avoid Vercel size limits)
   * @param video - Video file to upload
   * @param options - Upload options including creator
   * @returns Promise with CID and gateway URL
   */
  async uploadVideoDirectly(
    video: File,
    options: VideoUploadOptions
  ): Promise<VideoUploadResult> {
    const correlationId = this.generateCorrelationId();

    // Try Oracle first, then Mac Mini M4, then Raspberry Pi API
    const apiUrls = [
      { name: 'Oracle', url: `${this.oracleApiUrl}/transcode` },
      { name: 'Mac Mini M4', url: `${this.macMiniApiUrl}/transcode` },
      { name: 'Raspberry Pi', url: `${this.raspberryPiApiUrl}/transcode` }
    ];

    console.log('� Video upload started', {
      correlationId,
      creator: options.creator,
      platform: options.platform || 'auto-detected',
      fileSize: `${(video.size / 1024 / 1024).toFixed(2)}MB`,
      fileName: video.name
    });

    for (const api of apiUrls) {
      try {
        console.log(`🔄 Uploading video directly to ${api.name} API...`, {
          correlationId,
          apiUrl: api.url
        });

        // Create enhanced FormData with device and user information
        const formData = this.buildEnhancedFormData(video, options, correlationId);

        const uploadResponse = await fetch(api.url, {
          method: 'POST',
          body: formData,
          // Include credentials for CORS if needed
          mode: 'cors',
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.warn(`${api.name} direct upload failed:`, {
            correlationId,
            status: uploadResponse.status,
            error: errorText
          });
          continue; // Try next API
        }

        const result = await uploadResponse.json();

        if (!result.cid || !result.gatewayUrl) {
          console.warn(`${api.name} returned invalid response:`, {
            correlationId,
            result
          });
          continue; // Try next API
        }

        console.log(`✅ ${api.name} direct video upload successful:`, {
          correlationId,
          cid: result.cid,
          creator: options.creator
        });
        return {
          cid: result.cid,
          gatewayUrl: result.gatewayUrl,
        };
      } catch (error) {
        console.warn(`${api.name} direct upload error:`, {
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue; // Try next API
      }
    }

    // If we get here, all APIs failed
    console.error('All video upload APIs failed:', { correlationId });
    throw new Error('All video upload APIs failed. Please try again later.');
  }

  /**
   * Upload video with proxy fallback (for development CORS issues)
   * @param video - Video file to upload
   * @param options - Upload options including creator
   * @returns Promise with CID and gateway URL
   */
  async uploadVideoWithProxy(
    video: File,
    options: VideoUploadOptions
  ): Promise<VideoUploadResult> {
    const correlationId = this.generateCorrelationId();

    // Try Oracle API via proxy (Raspberry Pi doesn't work via proxy)
    const proxyUrl = '/api/video-proxy?url=' + encodeURIComponent(`${this.oracleApiUrl}/transcode`);

    try {
      console.log('🔄 Uploading video via proxy to Render API...', {
        correlationId,
        creator: options.creator,
        fileSize: `${(video.size / 1024 / 1024).toFixed(2)}MB`
      });

      // Create enhanced FormData with device and user information
      const formData = this.buildEnhancedFormData(video, options, correlationId);

      const uploadResponse = await fetch(proxyUrl, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Proxy video upload failed:', {
          correlationId,
          status: uploadResponse.status,
          error: errorText
        });
        throw new Error(`Proxy upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json();

      if (!result.cid || !result.gatewayUrl) {
        throw new Error('Invalid response from proxy upload service');
      }

      console.log('✅ Proxy video upload successful:', {
        correlationId,
        cid: result.cid,
        creator: options.creator
      });
      return {
        cid: result.cid,
        gatewayUrl: result.gatewayUrl,
      };
    } catch (error) {
      console.error('Failed to upload video via proxy:', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Proxy upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simple API availability check (just returns true - no complex health checking)
   * @returns API status information
   */
  async getApiStatus(): Promise<{
    primaryAPI: boolean;
    primaryURL: string;
    fallbackAPI: boolean;
    fallbackURL: string;
    checkDuration: string;
    timestamp: string;
  }> {
    const startTime = Date.now();

    const check = async (url: string): Promise<boolean> => {
      try {
        const response = await fetch(`${url}/healthz`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      } catch {
        return false;
      }
    };

    const [oracleOk, macOk] = await Promise.all([
      check(this.oracleApiUrl),
      check(this.macMiniApiUrl),
    ]);

    const duration = Date.now() - startTime;

    return {
      primaryAPI: oracleOk,
      primaryURL: this.oracleApiUrl,
      fallbackAPI: macOk,
      fallbackURL: this.macMiniApiUrl,
      checkDuration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
  }

  // Legacy method for backward compatibility
  async convertVideo(request: VideoConversionRequest): Promise<VideoConversionResponse> {
    try {
      const deviceInfo = this.getDeviceInfo();

      const result = await this.uploadVideo(request.video, {
        creator: request.creator,
        thumbnailUrl: request.thumbnailUrl,
        platform: deviceInfo.platform,
        deviceInfo: deviceInfo.deviceInfo,
        browserInfo: deviceInfo.browserInfo,
        viewport: deviceInfo.viewport,
        connectionType: deviceInfo.connectionType
      });

      return {
        success: true,
        ipfsUrl: result.gatewayUrl,
        cid: result.cid,
        gatewayUrl: result.gatewayUrl,
      };
    } catch (error) {
      console.error('Video conversion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Utility method for delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const videoApiService = new VideoApiService();
export default videoApiService;
