import React, { useState, useRef, useEffect } from 'react';

interface SplitPaneProps {
  leftElement: React.ReactNode;
  rightElement: React.ReactNode;
  initialSplitPercentage?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  leftElement,
  rightElement,
  initialSplitPercentage = 45
}) => {
  const [splitPercentage, setSplitPercentage] = useState(initialSplitPercentage);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Boundaries: restrict resizing to range [20%, 80%] to prevent breaking layouts
    if (newPercentage >= 20 && newPercentage <= 80) {
      setSplitPercentage(newPercentage);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="d-flex w-100 flex-grow-1 position-relative"
      style={{ overflow: 'hidden', height: 'calc(100vh - 80px)' }}
    >
      {/* Left Pane (Question Specifications) */}
      <div
        style={{
          width: `${splitPercentage}%`,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        {leftElement}
      </div>

      {/* Draggable Splitter Divider */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '8px',
          cursor: 'col-resize',
          backgroundColor: '#e2e8f0',
          position: 'relative',
          userSelect: 'none',
          zIndex: 10,
          transition: 'background-color 0.2s',
          borderLeft: '1px solid #cbd5e1',
          borderRight: '1px solid #cbd5e1'
        }}
        className="splitter-bar"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#3b82f6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#e2e8f0';
        }}
      />

      {/* Right Pane (Jupyter Console Workspace) */}
      <div
        style={{
          width: `${100 - splitPercentage}%`,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        {rightElement}
      </div>
    </div>
  );
};
