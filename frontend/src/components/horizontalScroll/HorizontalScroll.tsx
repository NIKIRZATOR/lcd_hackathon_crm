import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import styles from './HorizontalScroll.module.scss';

type HorizontalScrollProps = {
  children: ReactNode;
  className?: string;
};

const HorizontalScroll = ({ children, className }: HorizontalScrollProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = container;

    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [children]);

  const handleScrollLeft = () => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    container.scrollBy({
      left: -container.clientWidth * 0.8,
      behavior: 'smooth',
    });
  };

  const handleScrollRight = () => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    container.scrollBy({
      left: container.clientWidth * 0.8,
      behavior: 'smooth',
    });
  };
  return (
    <div
      className={[
        styles.scroll,
        canScrollLeft && styles['scroll--fade-left'],
        canScrollRight && styles['scroll--fade-right'],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div ref={scrollRef} className={styles.scroll__content} onScroll={updateScrollState}>
        {children}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          className={`${styles.scroll__arrow} ${styles['scroll__arrow--left']}`}
          onClick={handleScrollLeft}
          aria-label="Прокрутить влево"
        >
          <LeftOutlined />
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          className={`${styles.scroll__arrow} ${styles['scroll__arrow--right']}`}
          onClick={handleScrollRight}
          aria-label="Прокрутить вправо"
        >
          <RightOutlined />
        </button>
      )}
    </div>
  );
};

export default HorizontalScroll;
