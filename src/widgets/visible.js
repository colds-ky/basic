// @ts-check
import React from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * @param {{
 *  Component?: React.ElementType,
 *  onVisible?: () => void,
 *  onObscured?: () => void,
 *  rootMargin?: string;
 *  threshold?: number | number[];
 *  children?: React.ReactNode,
 *  className?: string
 * }} _
 */
export function Visible({ Component = 'div', onVisible, onObscured, rootMargin, threshold, children, ...rest }) {
  let [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting !== visible) {
        setVisible(visible = entry.isIntersecting);
        if (entry.isIntersecting)
          onVisible?.();
        else
          onObscured?.();
      }
    }, {
      rootMargin,
      threshold
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref.current]);

  return (
    <Component ref={ref} {...rest}>
      {children}
    </Component>
  );
}
