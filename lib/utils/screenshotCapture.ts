import { toBlob } from 'html-to-image';

async function waitForReactFlowReady(selector: string, timeout: number = 8000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (!element) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    const nodes = element.querySelectorAll('.react-flow__node');
    const viewport = element.querySelector('.react-flow__viewport');

    if (nodes.length > 0 && viewport) {
      let properlyPositioned = 0;
      let visibleNodes = 0;

      nodes.forEach((node) => {
        const htmlNode = node as HTMLElement;
        const transform = htmlNode.style.transform;
        const nodeRect = htmlNode.getBoundingClientRect();

        if (transform && !transform.includes('translate(0px, 0px)')) {
          properlyPositioned++;
        }

        if (nodeRect.width > 0 && nodeRect.height > 0) {
          visibleNodes++;
        }
      });

      if (properlyPositioned >= nodes.length * 0.8 && visibleNodes >= nodes.length * 0.8) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('React Flow did not become ready within timeout period');
}

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

      if (waitForReactFlow) {
        await waitForReactFlowReady(elementSelector);
      }

      await new Promise(resolve => setTimeout(resolve, delay));

      const images = element.querySelectorAll('img');
      const imagePromises: Promise<void>[] = [];

      images.forEach((img) => {
        if (!img.crossOrigin) {
          img.crossOrigin = 'anonymous';
        }

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
              resolve();
            };
            img.addEventListener('load', handleLoad);
            img.addEventListener('error', handleError);
          }
        });

        imagePromises.push(imagePromise);
      });

      await Promise.race([
        Promise.all(imagePromises),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);

      const rect = element.getBoundingClientRect();
      const elementWidth = rect.width;
      const elementHeight = rect.height;

      const blob = await toBlob(element as HTMLElement, {
        width: elementWidth,
        height: elementHeight,
        pixelRatio: 1.5,
        backgroundColor: 'transparent',
        skipAutoScale: true,
        cacheBust: false,
        filter: (node) => {
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Failed to capture screenshot after all retries');
}

export async function captureAirdropNetworkScreenshot(): Promise<string> {
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
    delay: 200,
    retries: 1,
    waitForReactFlow: true
  });
}
