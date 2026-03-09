/**
 * EXIF Metadata Extraction
 * Extracts location, date, camera info, and dimensions from image files
 */

// Dynamic import to handle build-time issues
let ExifReader: any = null;

// Lazy load ExifReader only when needed (browser-only)
async function getExifReader() {
  if (ExifReader) return ExifReader;
  
  try {
    const exifModule = await import('exifreader');
    ExifReader = exifModule.default || exifModule;
    return ExifReader;
  } catch (err) {
    console.warn('ExifReader not available:', err);
    return null;
  }
}

export interface ExifData {
  location: {
    lat: number;
    lng: number;
    altitude?: number;
  } | null;
  date: string | null;
  camera: {
    make?: string;
    model?: string;
  };
  dimensions: {
    width?: number;
    height?: number;
  };
}

/**
 * Parse GPS coordinates from EXIF format
 */
function parseGPS(gpsData: any): number | null {
  if (!gpsData || !gpsData.description) return null;
  
  try {
    // EXIF GPS format: "40° 44' 54.36\" N" → 40.7484
    const match = gpsData.description.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/);
    if (!match) return null;
    
    const [, degrees, minutes, seconds, direction] = match;
    let decimal = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / 3600;
    
    // Southern and Western coordinates are negative
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  } catch (err) {
    console.warn('GPS parsing failed:', err);
    return null;
  }
}

/**
 * Extract EXIF metadata from image file
 */
export async function extractExif(file: File): Promise<ExifData | null> {
  try {
    const Reader = await getExifReader();
    if (!Reader) return null;
    
    const arrayBuffer = await file.arrayBuffer();
    const tags = Reader.load(arrayBuffer);
    
    // Extract location
    const lat = parseGPS(tags.GPSLatitude);
    const lng = parseGPS(tags.GPSLongitude);
    const location = (lat !== null && lng !== null) ? {
      lat,
      lng,
      altitude: tags.GPSAltitude?.description ? parseFloat(tags.GPSAltitude.description) : undefined,
    } : null;
    
    // Extract date
    let date: string | null = null;
    if (tags.DateTimeOriginal?.description) {
      // Convert EXIF date format "2024:03:09 14:30:45" to ISO
      const exifDate = tags.DateTimeOriginal.description;
      const isoDate = exifDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      date = new Date(isoDate).toISOString();
    } else if (tags.DateTime?.description) {
      const exifDate = tags.DateTime.description;
      const isoDate = exifDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      date = new Date(isoDate).toISOString();
    }
    
    // Extract camera info
    const camera = {
      make: tags.Make?.description,
      model: tags.Model?.description,
    };
    
    // Extract dimensions
    const dimensions = {
      width: tags.ImageWidth?.value || tags['Image Width']?.value,
      height: tags.ImageHeight?.value || tags['Image Height']?.value,
    };
    
    return {
      location,
      date,
      camera,
      dimensions,
    };
  } catch (err) {
    console.warn('EXIF extraction failed:', err);
    return null;
  }
}

/**
 * Generate alt text from EXIF data
 */
export function exifToAltText(exif: ExifData | null, baseText: string = 'Skateboarding photo'): string {
  if (!exif) return baseText;
  
  let alt = baseText;
  
  // Add date if available
  if (exif.date) {
    const date = new Date(exif.date);
    const formatted = date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    alt += ` taken on ${formatted}`;
  }
  
  // Note: Location name would need reverse geocoding, which requires an API
  // For now, we just note that location is available
  if (exif.location) {
    alt += ` (geotagged)`;
  }
  
  return alt;
}
