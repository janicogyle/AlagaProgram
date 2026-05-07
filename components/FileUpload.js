'use client';

import { useState, useRef } from 'react';
import styles from './FileUpload.module.css';

const documentTypes = {
  prescription: { label: 'Prescription', accept: '.pdf,.jpg,.jpeg,.png' },
  officialReceipt: { label: 'Official Receipt', accept: '.pdf,.jpg,.jpeg,.png' },
  validId: { label: 'Valid ID', accept: '.pdf,.jpg,.jpeg,.png' },
  confinementCert: { label: 'Certificate of Confinement', accept: '.pdf,.jpg,.jpeg,.png' },
  deathCert: { label: 'Death Certificate', accept: '.pdf,.jpg,.jpeg,.png' },
  other: { label: 'Other Documents', accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx' },
};

export default function FileUpload({ 
  files = [], 
  onChange, 
  documentType = 'other',
  multiple = true,
  label,
  required = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeErrors, setSizeErrors] = useState({});
  const inputRef = useRef(null);
  const docConfig = documentTypes[documentType] || documentTypes.other;
  const MAX_FILE_SIZE = 2 * 1024 * 1024;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles) => {
    const errors = {};
    const validFiles = [];
    
    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE) {
        errors[file.name] = `File exceeds 2MB limit (${formatFileSize(file.size)})`;
      } else {
        validFiles.push(file);
      }
    }
    
    setSizeErrors(errors);
    
    if (validFiles.length > 0) {
      if (multiple) {
        onChange([...files, ...validFiles]);
      } else {
        onChange(validFiles.slice(0, 1));
      }
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  const getFileIcon = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFilePreview = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  return (
    <div className={styles.fileUploadContainer}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      
      {Object.keys(sizeErrors).length > 0 && (
        <div className={styles.sizeWarning}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div className={styles.sizeWarningText}>
            {Object.entries(sizeErrors).map(([name, error]) => (
              <div key={name}>{error}</div>
            ))}
          </div>
        </div>
      )}
      
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          onChange={handleFileSelect}
          accept={docConfig.accept}
          className={styles.hiddenInput}
        />
        <div className={styles.dropZoneContent}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className={styles.dropText}>
            <span>Drag and drop files here, or </span>
            <span className={styles.browseLink}>browse</span>
          </p>
          <p className={styles.hint}>Supported: PDF, JPG, PNG · Max 2MB</p>
          <p className={styles.hint}>Please upload files up to 2MB only.</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((file, index) => {
            const preview = getFilePreview(file);
            return (
              <div key={index} className={styles.fileItem}>
                <div className={styles.filePreview}>
                  {preview ? (
                    <img src={preview} alt={file.name} className={styles.previewImage} />
                  ) : (
                    <div className={styles.fileIconWrapper}>
                      {getFileIcon(file)}
                    </div>
                  )}
                </div>
                <div className={styles.fileDetails}>
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className={styles.removeBtn}
                  aria-label="Remove file"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
