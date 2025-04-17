import { useEffect, useRef, type RefObject } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const userScrollingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      let lastScrollTop = 0;
      let scrollTimer: NodeJS.Timeout | null = null;

      // 初始滚动到底部
      end.scrollIntoView({ behavior: 'instant', block: 'end' });

      // 检测用户是否正在滚动
      const handleScroll = () => {
        if (!container) return;
        
        // 检测是否是用户手动滚动
        if (container.scrollTop !== lastScrollTop) {
          userScrollingRef.current = true;
          lastScrollTop = container.scrollTop;
          
          // 清除之前的计时器
          if (scrollTimer) clearTimeout(scrollTimer);
          
          // 设置新的计时器，1秒后认为用户已停止滚动
          scrollTimer = setTimeout(() => {
            userScrollingRef.current = false;
          }, 1000);
        }
      };

      container.addEventListener('scroll', handleScroll);

      // 观察DOM变化
      const observer = new MutationObserver(() => {
        // 只有在用户不滚动时自动滚动到底部
        if (!userScrollingRef.current) {
          end.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      return () => {
        observer.disconnect();
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimer) clearTimeout(scrollTimer);
      };
    }
  }, []);

  return [containerRef, endRef];
}
