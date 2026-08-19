import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

type DragStart = {
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function useDraggableModal(active: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<DragStart | null>(null);

  useEffect(() => {
    if (!active) setOffset({ x: 0, y: 0 });
  }, [active]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = dragStart.current;
      if (!start) return;
      setOffset({
        x: Math.min(start.maxX, Math.max(start.minX, start.offsetX + event.clientX - start.pointerX)),
        y: Math.min(start.maxY, Math.max(start.minY, start.offsetY + event.clientY - start.pointerY)),
      });
    };
    const stop = () => {
      dragStart.current = null;
      document.body.classList.remove('is-dragging-modal');
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.classList.remove('is-dragging-modal');
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    const modal = event.currentTarget.parentElement;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
      minX: offset.x - rect.left,
      maxX: offset.x + window.innerWidth - rect.right,
      minY: offset.y - rect.top,
      maxY: offset.y + window.innerHeight - rect.bottom,
    };
    document.body.classList.add('is-dragging-modal');
    event.preventDefault();
  };

  return {
    dragHandleProps: { onPointerDown },
    dragStyle: { '--modal-drag-x': `${offset.x}px`, '--modal-drag-y': `${offset.y}px` } as CSSProperties,
  };
}
