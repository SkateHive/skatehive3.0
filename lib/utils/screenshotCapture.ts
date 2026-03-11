import { toBlob, toPng } from 'html-to-image';

/**
 * Wait for React Flow to be fully rendered and stable with enhanced checks
 */
async function waitForReactFlowReady(selector: string, timeout: number = 8000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (!element) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    // Check if React Flow container has proper dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    // Check if React Flow nodes and edges are rendered
    const nodes = element.querySelectorAll('.react-flow__node');
    const edges = element.querySelectorAll('.react-flow__edge');
    const viewport = element.querySelector('.react-flow__viewport');
    
    if (nodes.length > 0 && viewport) {
      // Check if nodes have proper positioning and are visible
      let properlyPositioned = 0;
      let visibleNodes = 0;
      
      nodes.forEach((node) => {
        const htmlNode = node as HTMLElement;
        const transform = htmlNode.style.transform;
        const nodeRect = htmlNode.getBoundingClientRect();
        
        // Check if node is positioned and visible
        if (transform && !transform.includes('translate(0px, 0px)')) {
          properlyPositioned++;
        }
        
        if (nodeRect.width > 0 && nodeRect.height > 0) {
          visibleNodes++;
        }
      });
      
      // If most nodes are properly positioned and visible, React Flow is ready
      if (properlyPositioned >= nodes.length * 0.8 && visibleNodes >= nodes.length * 0.8) {
        // Shorter final settling time for html-to-image
        await new Promise(resolve => setTimeout(resolve, 200));
        return;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('React Flow did not become ready within timeout period');
}

/**
 * Enhanced screenshot capture with better error handling and retries
 */
export async function captureElementScreenshot(
  elementSelector: string,
  options: {
    delay?: number;
    retries?: number;
    width?: number;
    height?: number;
    waitForReactFlow?: boolean;
  } = {}
): Promise<string> {
  const { delay = 200, retries = 1, waitForReactFlow = false } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const element = document.querySelector(elementSelector);
      if (!element) {
        throw new Error(`Element not found: ${elementSelector}`);
      }

      // Wait for React Flow to be ready if requested
      if (waitForReactFlow) {
        await waitForReactFlowReady(elementSelector);
      }
      
      // Minimal delay for stabilization
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Ensure all images are loaded with CORS and wait for problematic images
      const images = element.querySelectorAll('img');
      const imagePromises: Promise<void>[] = [];
      
      images.forEach((img) => {
        if (!img.crossOrigin) {
          img.crossOrigin = 'anonymous';
        }
        
        // Wait for each image to load or fail
        const imagePromise = new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            const handleLoad = () => {
              img.removeEventListener('load', handleLoad);
              img.removeEventListener('error', handleError);
              resolve();
            };
            const handleError = () => {
              img.removeEventListener('load', handleLoad);
              img.removeEventListener('error', handleError);
              console.warn('Image failed to load for screenshot:', img.src);
              resolve(); // Continue even if image fails
            };
            img.addEventListener('load', handleLoad);
            img.addEventListener('error', handleError);
          }
        });
        
        imagePromises.push(imagePromise);
      });

      // Wait for all images to load or fail, but don't wait too long
      await Promise.race([
        Promise.all(imagePromises),
        new Promise(resolve => setTimeout(resolve, 3000)) // 3 second timeout
      ]);

      // Get element's actual dimensions
      const rect = element.getBoundingClientRect();
      const elementWidth = rect.width;
      const elementHeight = rect.height;

      // Use html-to-image toBlob for faster capture without document.write
      const blob = await toBlob(element as HTMLElement, {
        width: elementWidth,
        height: elementHeight,
        pixelRatio: 1.5, // Good quality
        backgroundColor: 'transparent',
        skipAutoScale: true, // Important: don't auto-scale
        cacheBust: false, // Disable cache bust for better performance
        filter: (node) => {
          // Filter out UI elements that shouldn't be in the screenshot
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const classList = element.classList;
            const tagName = element.tagName?.toLowerCase();
            
            return !(
              classList?.contains('react-flow__controls') ||
              classList?.contains('react-flow__attribution') ||
              classList?.contains('react-flow__minimap') ||
              classList?.contains('react-flow__background') ||
              tagName === 'button' ||
              element.getAttribute('data-testid') === 'rf__controls' ||
              element.getAttribute('class')?.includes('controls')
            );
          }
          return true;
        }
      });

      if (!blob) {
        throw new Error('Failed to generate image blob');
      }

      // Convert blob to data URL
      const screenshotDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return screenshotDataUrl;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Failed to capture screenshot after all retries');
}

/**
 * Capture network visualization screenshot specifically for airdrop announcements
 * Optimized for speed with html-to-image
 */
export async function captureAirdropNetworkScreenshot(): Promise<string> {
  // Try multiple selectors to find the React Flow container
  const selectors = [
    '#airdrop-network-visualization',
    '.airdrop-react-flow-container', 
    '.react-flow',
    '[data-testid="rf__wrapper"]'
  ];
  
  let targetSelector = null;
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      targetSelector = selector;
      break;
    }
  }
  
  if (!targetSelector) {
    throw new Error('Could not find React Flow container with any selector');
  }
  
  return captureElementScreenshot(targetSelector, {
    delay: 200, // Even faster delay
    retries: 1, // Single retry for speed
    waitForReactFlow: true
  });
}
