'use client';

import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { isLikelyImage } from '@/lib/documentPreview';
import styles from './DocumentPreviewModal.module.css';

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  url = '',
  path = '',
  title = 'Document Preview',
}) {
  const zoomKey = isOpen ? url : '';
  const [zoomState, setZoomState] = useState({ key: zoomKey, value: 1 });
  const zoom = zoomState.key === zoomKey ? zoomState.value : 1;
  const updateZoom = (updater) => {
    setZoomState((current) => ({
      key: zoomKey,
      value: typeof updater === 'function' ? updater(current.key === zoomKey ? current.value : 1) : updater,
    }));
  };

  const handleClose = () => {
    updateZoom(1);
    onClose?.();
  };

  const zoomOut = () =>
    updateZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))));
  const zoomIn = () =>
    updateZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))));

  const renderAsImage = isLikelyImage(url, path);

  const handlePrint = () => {
    if (!url) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const safeTitle = String(title || 'Document Preview').replace(/[<>&]/g, '');
    const safeUrl = JSON.stringify(url).replace(/</g, '\\u003c');
    const printContent = renderAsImage
      ? `<img id="print-target" alt="Document preview" />`
      : `<iframe id="print-target" title="Document preview"></iframe>`;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safeTitle}</title>
          <style>
            html,
            body {
              margin: 0;
              min-height: 100%;
              background: #fff;
            }

            body {
              display: flex;
              align-items: center;
              justify-content: center;
            }

            img {
              display: block;
              max-width: 100%;
              max-height: 100vh;
              object-fit: contain;
            }

            iframe {
              display: block;
              width: 100vw;
              height: 100vh;
              border: 0;
            }

            @media print {
              html,
              body {
                width: 100%;
                height: 100%;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            const target = document.getElementById('print-target');
            target.addEventListener('load', () => {
              window.focus();
              window.print();
            });
            target.src = ${safeUrl};
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="large"
      footer={
        <>
          {url && (
            <Button onClick={handlePrint}>
              Print
            </Button>
          )}
          <Button onClick={handleClose}>Close</Button>
        </>
      }
    >
      {url ? (
        <div className={styles.shell}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <Button variant="secondary" size="small" onClick={zoomOut}>
                -
              </Button>
              <Button variant="secondary" size="small" onClick={zoomIn}>
                +
              </Button>
              <Button variant="secondary" size="small" onClick={() => updateZoom(1)}>
                Reset
              </Button>
            </div>
            <div className={styles.toolbarRight}>
              <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
            </div>
          </div>
          <div className={styles.viewport}>
            <div
              className={styles.scaled}
              style={{ transform: `scale(${zoom})` }}
            >
              {renderAsImage ? (
                <img
                  src={url}
                  alt="Document preview"
                  className={styles.image}
                />
              ) : (
                <iframe
                  src={url}
                  title="Document preview"
                  className={styles.frame}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className={styles.empty}>No document available for preview.</p>
      )}
    </Modal>
  );
}
