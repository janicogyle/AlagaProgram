'use client';

import { useEffect, useState } from 'react';
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
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (isOpen) setZoom(1);
  }, [isOpen, url]);

  const handleClose = () => {
    setZoom(1);
    onClose?.();
  };

  const zoomOut = () =>
    setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))));
  const zoomIn = () =>
    setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))));

  const renderAsImage = isLikelyImage(url, path);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="large"
      footer={<Button onClick={handleClose}>Close</Button>}
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
              <Button variant="secondary" size="small" onClick={() => setZoom(1)}>
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
