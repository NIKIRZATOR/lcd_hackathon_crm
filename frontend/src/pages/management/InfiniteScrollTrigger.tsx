import { Spin } from 'antd';
import { useEffect, useRef } from 'react';

import styles from './InfiniteScrollTrigger.module.scss';

type InfiniteScrollTriggerProps = {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
};

const InfiniteScrollTrigger = ({ hasMore, loading, onLoadMore }: InfiniteScrollTriggerProps) => {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !hasMore || loading) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: '240px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return (
    <div ref={targetRef} className={styles.trigger}>
      {hasMore && <Spin size="small" />}
    </div>
  );
};

export default InfiniteScrollTrigger;
