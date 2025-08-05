'use client';

import { useEffect, useRef } from 'react';

export default function ChatPage() {
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chatRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.src = 'https://chat.peakd.com/stlib.js';
    script.async = true;

    let widget: any = null;

    script.onload = () => {
      const StWidget = (window as any).StWidget;
      if (typeof StWidget === 'function') {
        widget = new StWidget('https://chat.peakd.com/t/hive-173115/0');
        widget.properties = {
          allow_resize: true,
          use_dark_mode: false,
        };
        widget.setStyle({
          width: '100%',
          height: '600px',
        });
        const element = typeof widget.render === 'function' ? widget.render() : widget;
        container.appendChild(element);
      }
    };

    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (container) {
        container.innerHTML = '';
      }
      widget = null;
    };
  }, []);

  return <div ref={chatRef} />;
}

