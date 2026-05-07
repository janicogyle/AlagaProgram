'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Button, Modal } from '@/components';
import styles from './page.module.css';
import { assistanceData } from '@/lib/assistanceData';
import {
  buildRequirementsMap,
  getRequirementsForType,
  getLocalBudgetsMap,
  getLocalRequirementsMap,
  isMissingRequirementsColumn,
  saveLocalBudget,
  saveLocalRequirements,
} from '@/lib/assistanceRequirements';
import { supabase } from '@/lib/supabaseClient';

const isBudgetsUnavailable = (err) => {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('assistance_budgets') &&
    (msg.includes('schema cache') ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table') ||
      msg.includes('column') ||
      msg.includes('relation'))
  );
};

export default function GuidelinesPage() {
  const [budgets, setBudgets] = useState({});
  const [requirementsByType, setRequirementsByType] = useState({});
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, type: null, current: 0, next: 0 });
  const [editingRequirementsType, setEditingRequirementsType] = useState(null);
  const [requirementsDraft, setRequirementsDraft] = useState([]);
  const [requirementsSaving, setRequirementsSaving] = useState(false);

  const getAuthHeaders = async () => {
    if (!supabase) throw new Error('Supabase client not initialized.');

    const { data, error } = await supabase.auth.getSession();
    let session = data?.session;

    const isExpired = session?.expires_at ? session.expires_at * 1000 <= Date.now() + 5000 : false;
    if (!error && session && !isExpired) {
      return { Authorization: `Bearer ${session.access_token}` };
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    session = refreshData?.session;
    if (refreshError || !session) throw new Error('Not authenticated. Please log in again.');

    return { Authorization: `Bearer ${session.access_token}` };
  };

  const humanizeBudgetError = (err) => {
    const msg = String(err?.message || err || '');
    const lower = msg.toLowerCase();

    if (lower.includes('forbidden') || lower.includes('only admin')) {
      return 'Only Admin accounts can edit budget ceilings.';
    }

    if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
      return 'Your session expired. Please log in again.';
    }

    if (lower.includes('duplicate key value violates unique constraint')) {
      return 'This assistance type already exists in the budget table. Please refresh and try again.';
    }

    return msg || 'Something went wrong. Please try again.';
  };

  const formatPeso = (value) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('adminUser') : null;
      const user = raw ? JSON.parse(raw) : null;
      setIsAdmin(user?.role === 'Admin');
    } catch {
      setIsAdmin(false);
    }

    const loadBudgets = async () => {
      try {
        if (!supabase) {
          throw new Error('Database client not available');
        }
        let usedFallback = false;
        let { data, error } = await supabase
          .from('assistance_budgets')
          .select('assistance_type, ceiling, requirements');

        if (error && isMissingRequirementsColumn(error)) {
          const fallback = await supabase
            .from('assistance_budgets')
            .select('assistance_type, ceiling');
          data = fallback.data;
          error = fallback.error;
          usedFallback = true;
        }

        if (error) {
          console.warn('Error loading assistance budgets', error.message);
          if (isBudgetsUnavailable(error)) {
            setBudgets(getLocalBudgetsMap());
            setRequirementsByType(getLocalRequirementsMap());
            return;
          }
          setStatus({
            type: 'error',
            message: 'Failed to load assistance budget ceilings. Please refresh the page or try again later.',
          });
          return;
        }

        if (data) {
          const map = {};
          data.forEach((row) => {
            const ceiling = Number(row.ceiling);
            if (row.assistance_type && Number.isFinite(ceiling)) {
              map[row.assistance_type] = ceiling;
            }
          });
          setBudgets(map);
          setRequirementsByType(
            usedFallback ? getLocalRequirementsMap() : buildRequirementsMap(data),
          );
        }
      } catch (err) {
        if (isBudgetsUnavailable(err)) {
          setBudgets(getLocalBudgetsMap());
          setRequirementsByType(getLocalRequirementsMap());
        } else {
          console.warn('Unexpected error loading assistance budgets', err);
          setStatus({
            type: 'error',
            message: 'Failed to load assistance budget ceilings. Please refresh the page or try again later.',
          });
        }
      } finally {
        setLoadingBudgets(false);
      }
    };

    loadBudgets();
  }, []);

  const getCeilingFor = (title) => {
    const override = budgets[title];
    if (typeof override === 'number') return override;
    return assistanceData[title]?.ceiling ?? 0;
  };

  const getRequirementsFor = (title) => getRequirementsForType(title, requirementsByType);

  const openEditModal = (title) => {
    if (!isAdmin) {
      setStatus({ type: 'error', message: 'Only Admin accounts can edit budget ceilings.' });
      return;
    }

    const current = getCeilingFor(title);
    setEditingType(title);
    setEditValue(String(current));
  };

  const openRequirementsModal = (title) => {
    if (!isAdmin) {
      setStatus({ type: 'error', message: 'Only Admin accounts can edit requirements.' });
      return;
    }

    const requirements = getRequirementsFor(title);
    setEditingRequirementsType(title);
    setRequirementsDraft(requirements.length ? requirements : ['']);
  };

  const closeRequirementsModal = () => {
    if (requirementsSaving) return;
    setEditingRequirementsType(null);
    setRequirementsDraft([]);
  };

  const closeEditModal = () => {
    if (saving) return;
    setConfirmState({ open: false, type: null, current: 0, next: 0 });
    setEditingType(null);
    setEditValue('');
  };

  const applyBudgetChange = async ({ type, current, next }) => {
    if (!type) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders();

      const response = await fetch('/api/assistance-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ assistanceType: type, ceiling: next }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        const errorMessage = payload?.error || `Failed to update budget ceiling for ${type}.`;
        if (payload?.code === 'ASSISTANCE_BUDGETS_TABLE_MISSING' || isBudgetsUnavailable(errorMessage)) {
          saveLocalBudget(type, next);
          setBudgets((prev) => ({
            ...prev,
            [type]: next,
          }));
          setStatus({
            type: 'success',
            message: `Budget ceiling saved locally: ${type} (${formatPeso(current)} → ${formatPeso(next)}).`,
          });
          setConfirmState({ open: false, type: null, current: 0, next: 0 });
          closeEditModal();
          return;
        }
        setConfirmState({ open: false, type: null, current: 0, next: 0 });
        setStatus({
          type: 'error',
          message: humanizeBudgetError(errorMessage),
        });
        return;
      }

      setBudgets((prev) => ({
        ...prev,
        [type]: next,
      }));

      setStatus({
        type: 'success',
        message: `Budget ceiling updated: ${type} (${formatPeso(current)} → ${formatPeso(next)}).`,
      });

      setConfirmState({ open: false, type: null, current: 0, next: 0 });
      closeEditModal();
    } catch (err) {
      setConfirmState({ open: false, type: null, current: 0, next: 0 });
      setStatus({ type: 'error', message: humanizeBudgetError(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!editingType) return;

    if (!isAdmin) {
      setStatus({ type: 'error', message: 'Only Admin accounts can edit budget ceilings.' });
      return;
    }

    const parsed = Number(editValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setStatus({
        type: 'error',
        message: 'Please enter a valid non-negative amount for the budget ceiling.',
      });
      return;
    }

    const current = getCeilingFor(editingType);
    if (parsed === current) {
      setStatus({
        type: 'error',
        message: 'The new amount is the same as the current budget ceiling.',
      });
      return;
    }

    setConfirmState({ open: true, type: editingType, current, next: parsed });
  };

  const handleSaveRequirements = async () => {
    if (!editingRequirementsType) return;

    if (!isAdmin) {
      setStatus({ type: 'error', message: 'Only Admin accounts can edit requirements.' });
      return;
    }

    const nextRequirements = requirementsDraft.map((item) => String(item || '').trim()).filter(Boolean);
    const currentCeiling = getCeilingFor(editingRequirementsType);

    setRequirementsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/assistance-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          assistanceType: editingRequirementsType,
          ceiling: currentCeiling,
          requirements: nextRequirements,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        const errorMessage = payload?.error || 'Failed to update requirements.';
        if (payload?.code === 'ASSISTANCE_BUDGETS_TABLE_MISSING' || isBudgetsUnavailable(errorMessage)) {
          saveLocalRequirements(editingRequirementsType, nextRequirements);
          setRequirementsByType((prev) => ({
            ...prev,
            [editingRequirementsType]: nextRequirements,
          }));
          setStatus({
            type: 'success',
            message: `Requirements saved locally for ${editingRequirementsType}.`,
          });
          closeRequirementsModal();
          return;
        }
        setStatus({
          type: 'error',
          message: humanizeBudgetError(errorMessage),
        });
        return;
      }

      setRequirementsByType((prev) => ({
        ...prev,
        [editingRequirementsType]: nextRequirements,
      }));
      setStatus({
        type: 'success',
        message: `Requirements updated for ${editingRequirementsType}.`,
      });
      closeRequirementsModal();
    } catch (err) {
      setStatus({ type: 'error', message: humanizeBudgetError(err) });
    } finally {
      setRequirementsSaving(false);
    }
  };

  const updateRequirementLine = (index, value) => {
    setRequirementsDraft((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const addRequirementLine = () => {
    setRequirementsDraft((prev) => [...prev, '']);
  };

  const removeRequirementLine = (index) => {
    setRequirementsDraft((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [''];
    });
  };

  return (
    <div className={styles.guidelinesPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>ALAGA Program Guidelines</h1>
        <p className={styles.pageSubtitle}>Requirements and budget ceilings for social services assistance</p>
      </div>

      {status && (
        <div
          className={`${styles.statusBanner} ${
            status.type === 'success'
              ? styles.statusBannerSuccess
              : styles.statusBannerError
          }`}
          role="alert"
        >
          {status.message}
        </div>
      )}

      <div className={styles.content}>
        {/* Requirements Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Requirements Checklist
          </h2>

          <div className={styles.requirementsGrid}>
            {Object.entries(assistanceData)
              .filter(([title]) => title !== 'Others')
              .map(([title, data]) => {
              const effectiveCeiling = getCeilingFor(title);

              const requirements = getRequirementsFor(title);

              return (
                <Card key={title} className={styles.requirementCard}>
                  <div className={styles.cardHeader}>
                    <div
                      className={styles.cardIcon}
                      style={{ backgroundColor: data.iconBg, color: data.iconColor }}
                    >
                      {data.icon}
                    </div>
                    <h3 className={styles.cardTitle}>{title}</h3>
                  </div>
                  <ul className={styles.checkList}>
                    {requirements.length ? (
                      requirements.map((req, i) => (
                        <li key={i}>
                          <span>{req}</span>
                        </li>
                      ))
                    ) : (
                      <li className={styles.emptyRequirement}>No requirements set.</li>
                    )}
                  </ul>
                  <div className={styles.cardFooter}>
                    <div className={styles.ceilingInfo}>
                      <span className={styles.ceilingLabel}>Budget Ceiling:</span>
                      <span className={styles.ceilingAmount}>
                        {new Intl.NumberFormat('en-PH', {
                          style: 'currency',
                          currency: 'PHP',
                        }).format(effectiveCeiling)}
                      </span>
                    </div>
                    {isAdmin ? (
                      <div className={styles.cardActions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => openRequirementsModal(title)}
                          disabled={loadingBudgets || requirementsSaving}
                        >
                          Edit Requirements
                        </Button>
                        <Button
                          variant="outline"
                          size="small"
                          onClick={() => openEditModal(title)}
                          disabled={loadingBudgets}
                        >
                          Edit Budget
                        </Button>
                      </div>
                    ) : (
                      <span style={{ color: '#6b7280', fontSize: 12 }}>Admin only</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Process Flow Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20V10" />
              <path d="M18 20V4" />
              <path d="M6 20V16" />
            </svg>
            Process Flow
          </h2>
          <p className={styles.sectionDescription}>
            Follow these steps to request assistance from the ALAGA program.
          </p>
          <div className={styles.flow}>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Registration</h3>
              <p className={styles.stepDescription}>
                New residents must be registered in the system. Go to the
                <Link href="/admin/registration" className={styles.link}>
                  Registration Page
                </Link>.
              </p>
            </div>
            <div className={styles.flowConnector}>→</div>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Request Submission</h3>
              <p className={styles.stepDescription}>
                Submit an assistance request with all required documents at the barangay hall.
              </p>
            </div>
            <div className={styles.flowConnector}>→</div>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>Verification</h3>
              <p className={styles.stepDescription}>
                The submitted documents and request details will be verified by authorized personnel.
              </p>
            </div>
            <div className={styles.flowConnector}>→</div>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>4</div>
              <h3 className={styles.stepTitle}>Approval & Disbursement</h3>
              <p className={styles.stepDescription}>
                Once approved, the assistance amount will be disbursed to the beneficiary.
              </p>
            </div>
          </div>
        </section>
      </div>

      <Modal
        isOpen={Boolean(editingType)}
        onClose={closeEditModal}
        title={editingType ? `Update Budget Ceiling – ${editingType}` : ''}
        size="small"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeEditModal}
              disabled={saving || confirmState.open}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBudget}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editingType && (
          <div className={styles.editModalBody}>
            <p className={styles.editWarning}>
              Changing this budget ceiling will immediately apply to new assistance requests
              and any administrative reports that rely on the current ceilings. Make sure
              this change has been reviewed and approved.
            </p>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="budgetCeilingInput">
                New budget ceiling (PHP)
              </label>
              <input
                id="budgetCeilingInput"
                type="number"
                min="0"
                step="1"
                className={styles.editInput}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editingRequirementsType)}
        onClose={closeRequirementsModal}
        title={editingRequirementsType ? `Edit Requirements – ${editingRequirementsType}` : ''}
        size="medium"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeRequirementsModal}
              disabled={requirementsSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRequirements}
              disabled={requirementsSaving}
            >
              {requirementsSaving ? 'Saving…' : 'Save Requirements'}
            </Button>
          </>
        }
      >
        {editingRequirementsType && (
          <div className={styles.editModalBody}>
            <p className={styles.editWarning}>
              Update the requirements list below. Each field is saved as a separate checklist item.
            </p>
            <div className={styles.editField}>
              <label className={styles.editLabel}>
                Requirements
              </label>
              <div className={styles.requirementsEditor}>
                {requirementsDraft.map((value, index) => (
                  <div key={`${index}-${editingRequirementsType}`} className={styles.requirementRow}>
                    <input
                      type="text"
                      className={styles.requirementInput}
                      value={value}
                      onChange={(e) => updateRequirementLine(index, e.target.value)}
                      placeholder={`Requirement ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => removeRequirementLine(index)}
                      disabled={requirementsDraft.length <= 1}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  onClick={addRequirementLine}
                  className={styles.addRequirementBtn}
                >
                  Add Requirement
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!confirmState.open}
        onClose={() => {
          if (saving) return;
          setConfirmState({ open: false, type: null, current: 0, next: 0 });
        }}
        title="Confirm budget change"
        size="small"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmState({ open: false, type: null, current: 0, next: 0 })}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => applyBudgetChange(confirmState)}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </>
        }
      >
        <div className={styles.editModalBody}>
          <p style={{ margin: 0, color: '#374151', lineHeight: 1.45 }}>
            Are you sure you want to change the budget ceiling for <strong>{confirmState.type}</strong>?
          </p>
          <div style={{ display: 'grid', gap: 6, fontSize: 14, color: '#374151' }}>
            <div>
              Current: <strong>{formatPeso(confirmState.current)}</strong>
            </div>
            <div>
              New: <strong>{formatPeso(confirmState.next)}</strong>
            </div>
          </div>
          <p className={styles.editWarning} style={{ margin: 0 }}>
            This will affect future validations and administrative reports that rely on the current ceilings.
          </p>
        </div>
      </Modal>
    </div>
  );
}
