import { useEffect, useRef } from 'react';

import styles from './UniversityTabBar.module.scss';

type UniversityTabItem = {
  key: string;
  label: string;
};

type UniversityTabBarProps = {
  items: UniversityTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

const UniversityTabBar = ({ items, activeKey, onChange }: UniversityTabBarProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return undefined;

    const onWheel = (event: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      node.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={scrollerRef}
      className={styles.scroller}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const node = scrollerRef.current;
        if (!node) return;
        dragRef.current = { active: true, moved: false, startX: event.clientX, scrollLeft: node.scrollLeft };
      }}
      onPointerMove={(event) => {
        const node = scrollerRef.current;
        const drag = dragRef.current;
        if (!node || !drag.active) return;
        const delta = event.clientX - drag.startX;
        if (Math.abs(delta) < 6) return;
        drag.moved = true;
        node.scrollLeft = drag.scrollLeft - delta;
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
      onPointerCancel={() => {
        dragRef.current.active = false;
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={item.key === activeKey ? styles.tabActive : styles.tab}
          aria-current={item.key === activeKey ? 'page' : undefined}
          onClick={() => {
            if (dragRef.current.moved) {
              dragRef.current.moved = false;
              return;
            }
            onChange(item.key);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default UniversityTabBar;

