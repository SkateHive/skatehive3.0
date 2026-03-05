import React, { useState, useEffect, useRef, useMemo } from "react";
import markdownRenderer from "@/lib/markdown/MarkdownRenderer";
import SkateErrorBoundary from "./SkateErrorBoundary";
import { Skeleton } from "@chakra-ui/react";
import { observeHeicImages } from "@/lib/utils/heicImageFallback";

interface HiveMarkdownProps {
  markdown: string;
  className?: string;
  style?: React.CSSProperties;
  disableVideoAutoplay?: boolean;
  /** Keep iframes as-is without converting to video tags (simpler preview) */
  rawIframes?: boolean;
}

const HiveMarkdown: React.FC<HiveMarkdownProps> = ({
  markdown,
  className = "markdown-body",
  style,
  disableVideoAutoplay = false,
  rawIframes = false,
}) => {
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const lastProcessedRef = useRef<{ markdown: string; disableAutoplay: boolean; html: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Observe the container for HEIC images and convert them on the fly
  useEffect(() => {
    if (!containerRef.current || isLoading) return;
    return observeHeicImages(containerRef.current);
  }, [renderedHtml, isLoading]);

  useEffect(() => {
    // Skip full processing for rawIframes mode - handled by useMemo below
    if (rawIframes) {
      setIsLoading(false);
      return;
    }

    // Check if we've already processed this exact combination
    if (
      lastProcessedRef.current &&
      lastProcessedRef.current.markdown === markdown &&
      lastProcessedRef.current.disableAutoplay === disableVideoAutoplay
    ) {
      // Already processed, skip
      return;
    }

    let mounted = true;

    const processMarkdown = async () => {
      try {
        setIsLoading(true);

        // Full processing via markdownRenderer
        const rawHtml = await markdownRenderer(markdown);

        if (!mounted) return;

        // Post-process YouTube tags in the HTML
        const processYouTubeEmbeds = (html: string) => {
          return html.replace(
            /\[\[YOUTUBE:([a-zA-Z0-9_-]{11})\]\]/g,
            (_match, videoId) => {
              return `
              <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1rem 0;">
                <iframe
                  src="https://www.youtube.com/embed/${videoId}"
                  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
              `;
            }
          );
        };

        // Remove autoplay from videos if disabled
        const processVideoAutoplay = (html: string) => {
          if (!disableVideoAutoplay) return html;

          return html.replace(/<video([^>]*?)>/gi, (match) => {
            return match.replace(/\s+autoplay/gi, "").replace(/\s+muted/gi, "");
          });
        };

        // Process YouTube embeds then handle autoplay
        let processedHtml = processYouTubeEmbeds(rawHtml);
        processedHtml = processVideoAutoplay(processedHtml);

        // Store in cache AFTER processing is complete
        lastProcessedRef.current = {
          markdown,
          disableAutoplay: disableVideoAutoplay,
          html: processedHtml,
        };

        setRenderedHtml(processedHtml);
      } catch (error) {
        console.error("Error processing markdown:", error);
        setRenderedHtml("<pre>" + markdown + "</pre>");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    processMarkdown();

    return () => {
      mounted = false;
    };
  }, [markdown, disableVideoAutoplay, rawIframes]);

  // For rawIframes mode: render with stable iframe elements
  // Text content updates don't cause iframe reloads because iframes have stable keys
  const rawIframesContent = useMemo(() => {
    if (!rawIframes) return null;

    const parts: React.ReactNode[] = [];
    const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi;
    let match;
    let lastIndex = 0;
    let partIndex = 0;

    while ((match = iframeRegex.exec(markdown)) !== null) {
      // Add text before this iframe
      if (match.index > lastIndex) {
        const textBefore = markdown.slice(lastIndex, match.index);
        const processedText = textBefore
          .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:8px;" />')
          .replace(/\n/g, "<br />");
        const textKey = "text-" + partIndex;
        partIndex++;
        parts.push(
          <span key={textKey} dangerouslySetInnerHTML={{ __html: processedText }} />
        );
      }

      // Add iframe with stable key based on src
      const src = match[1];
      const iframeKey = "iframe-" + src;
      parts.push(
        <iframe
          key={iframeKey}
          src={src}
          style={{ maxWidth: "100%", borderRadius: "8px", aspectRatio: "16/9", width: "100%", height: "400px" }}
          frameBorder="0"
          allowFullScreen
        />
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last iframe
    if (lastIndex < markdown.length) {
      const textAfter = markdown.slice(lastIndex);
      const processedText = textAfter
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:8px;" />')
        .replace(/\n/g, "<br />");
      const textKey = "text-" + partIndex;
      parts.push(
        <span key={textKey} dangerouslySetInnerHTML={{ __html: processedText }} />
      );
    }

    return parts;
  }, [markdown, rawIframes]);

  if (isLoading && !rawIframes) {
    return (
      <SkateErrorBoundary>
        <div className={className} style={style}>
          <Skeleton height="20px" mb={2} />
          <Skeleton height="20px" mb={2} />
          <Skeleton height="15px" width="70%" />
        </div>
      </SkateErrorBoundary>
    );
  }

  // For rawIframes mode: use React elements to keep iframes stable
  if (rawIframes) {
    return (
      <SkateErrorBoundary>
        <div ref={containerRef} className={className} style={style}>
          {rawIframesContent}
        </div>
      </SkateErrorBoundary>
    );
  }

  return (
    <SkateErrorBoundary>
      <div
        ref={containerRef}
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </SkateErrorBoundary>
  );
};

export default React.memo(HiveMarkdown);
