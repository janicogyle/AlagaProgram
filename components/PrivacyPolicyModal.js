'use client';

import Modal from './Modal';
import Button from './Button';
import LegalContent from './LegalContent';
import styles from './PrivacyPolicyModal.module.css';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Privacy Notice"
      size="large"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <LegalContent type="privacy" styles={styles} />
    </Modal>
  );
}
