'use client';

import { useEffect, useRef, useState } from 'react';

export default function ChatPage() {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log(msg);
    setDebug((d) => [...d, msg]);
  };

  useEffect(() => {
    const container = chatRef.current;
    if (!container) {
      log('No container found');
      return;
    }

    let widget: any = null;
    const scripts: HTMLScriptElement[] = [];

    const loadScript = (src: string) =>
      new Promise<HTMLScriptElement>((resolve, reject) => {
        log(`Loading script: ${src}`);
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => {
          log(`Loaded script: ${src}`);
          resolve(s);
        };
        s.onerror = (e) => {
          log(`Failed to load script: ${src}`);
          reject(e);
        };
        document.body.appendChild(s);
        scripts.push(s);
      });

    loadScript('https://chat.peakd.com/stlib.js')
      .then(() => loadScript('https://chat.peakd.com/stwidget.js'))
      .then(() => {
        log('Attempting to create StWidget');
        const StWidget = (window as any).StWidget;
        if (typeof StWidget === 'function') {
          widget = new StWidget('https://chat.peakd.com/t/hive-173115/0');
          widget.setProperties({
            allow_resize: true,
            use_dark_mode: false,
          });
          const element = widget.createElement('100%', '600px', false, false);
          container.appendChild(element);
          log('Widget appended to container');
        } else {
          log('StWidget not available on window');
        }
      })
      .catch((e) => {
        log(`Error initializing widget: ${e}`);
      });

    return () => {
      scripts.forEach((s) => s.parentNode?.removeChild(s));
      container.innerHTML = '';
      if (widget) {
        widget.cleanup();
        widget = null;
        log('Widget cleaned up');
      }
    };
  }, []);

  return (
    <div className="p-4">
      <div ref={chatRef} />
      <pre className="mt-4 text-xs whitespace-pre-wrap">
        {debug.join('\n')}
      </pre>
    </div>
  );
}

