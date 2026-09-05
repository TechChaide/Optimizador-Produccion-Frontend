import React, { useState } from 'react';
import { useLogs } from '@/context/LogContext';

const ResizableLogsTerminal: React.FC = () => {
  const { logs } = useLogs();
  const [height, setHeight] = useState(200);

  const handleResize = (e: MouseEvent) => {
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight > 100 && newHeight < window.innerHeight - 100) {
      setHeight(newHeight);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${height}px`,
        backgroundColor: '#1e1e1e',
        color: '#ffffff',
        overflowY: 'auto',
        borderTop: '2px solid #333',
        resize: 'vertical',
      }}
    >
      <div
        style={{
          height: '10px',
          cursor: 'row-resize',
          backgroundColor: '#333',
        }}
        onMouseDown={() => {
          document.addEventListener('mousemove', handleResize);
          document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', handleResize);
          });
        }}
      />
      <pre style={{ padding: '10px', fontSize: '12px' }}>
        {logs.map((log, index) => (
          <div key={index}>{log.message}</div>
        ))}
      </pre>
    </div>
  );
};

export default ResizableLogsTerminal;