import React, { useState, useEffect } from 'react';
import { Communication, User, VendorContact, Vendor } from '../../types';
import FormModal from '../FormModal';
import { FormInput, FormSelect } from '../FormInput';
import { t } from '../../utils/lang';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeComm: Communication | null;
  currentUser: User;
  users: User[];
  tempContacts: VendorContact[];
  editingVendor: Vendor;
  onSaveCommunication: (payload: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
}

export default function VendorCommunicationModal({
  isOpen,
  onClose,
  activeComm,
  currentUser,
  users,
  tempContacts,
  editingVendor,
  onSaveCommunication,
  onDeleteCommunication
}: Props) {
  const [newCommDate, setNewCommDate] = useState(new Date().toISOString().substring(0, 16));
  const [newCommType, setNewCommType] = useState<'action' | 'reminder' | 'task'>('action');
  const [newCommReminderTime, setNewCommReminderTime] = useState('');
  const [newCommContactId, setNewCommContactId] = useState('');
  const [newCommUserId, setNewCommUserId] = useState(currentUser.id);
  const [newCommComment, setNewCommComment] = useState('');
  const [newCommResponsibleUserId, setNewCommResponsibleUserId] = useState('');
  const [newCommTaskStatus, setNewCommTaskStatus] = useState('pending');
  const [commError, setCommError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (activeComm) {
        setNewCommDate(new Date(activeComm.date_time).toISOString().substring(0, 16));
        setNewCommType(activeComm.type);
        setNewCommReminderTime(activeComm.reminder_time ? new Date(activeComm.reminder_time).toISOString().substring(0, 16) : '');
        setNewCommContactId(activeComm.vendor_contact_id || '');
        setNewCommUserId(activeComm.user_id);
        setNewCommComment(activeComm.comment);
        setNewCommResponsibleUserId(activeComm.responsible_user_id || '');
        setNewCommTaskStatus(activeComm.task_status || 'pending');
      } else {
        setNewCommDate(new Date().toISOString().substring(0, 16));
        setNewCommType('action');
        setNewCommReminderTime('');
        const primary = tempContacts.find(c => c.is_default);
        if (primary) {
          setNewCommContactId(primary.id);
        } else if (tempContacts.length > 0) {
          setNewCommContactId(tempContacts[0].id);
        } else {
          setNewCommContactId('');
        }
        setNewCommUserId(currentUser.id);
        setNewCommComment('');
        setNewCommResponsibleUserId('');
        setNewCommTaskStatus('pending');
      }
      setCommError('');
    }
  }, [isOpen, activeComm, currentUser.id, tempContacts]);

  const handleSave = async () => {
    if (!editingVendor.id) {
      alert(t("Please save this supplier before logging communication records."));
      return;
    }
    if (!newCommComment.trim()) {
      setCommError(t("Log comment is required."));
      return;
    }
    setCommError('');
    
    const assignedUser = users.find(u => u.id === newCommUserId);
    const assignedContact = tempContacts.find(c => c.id === newCommContactId);

    const commPayload: Communication = {
      id: activeComm ? activeComm.id : '',
      date_time: new Date(newCommDate).toISOString(),
      type: newCommType,
      reminder_time: newCommType === 'reminder' && newCommReminderTime ? new Date(newCommReminderTime).toISOString() : undefined,
      user_id: newCommUserId,
      user_name: assignedUser ? assignedUser.name : currentUser.name,
      vendor_id: editingVendor.id,
      vendor_name: editingVendor.trade_name,
      vendor_contact_id: newCommContactId,
      vendor_contact_name: assignedContact ? assignedContact.name : 'Direct Interaction',
      comment: newCommComment.trim(),
      responsible_user_id: newCommType === 'task' ? (newCommResponsibleUserId || undefined) : undefined,
      responsible_user_name: newCommType === 'task' ? (users.find(u => u.id === newCommResponsibleUserId)?.name || '') : undefined,
      task_status: newCommType === 'task' ? newCommTaskStatus : undefined
    };

    try {
      await onSaveCommunication(commPayload);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={activeComm ? t("Edit Communication") : t("New Communication")}
      maxWidthClass="max-w-md"
      onCancel={onClose}
      onDelete={activeComm && onDeleteCommunication ? () => {
          onDeleteCommunication(activeComm.id);
          onClose();
      } : undefined}
      deleteLabel={t("Delete")}
      onSave={handleSave}
      saveLabel={activeComm ? t("Save Communication") : t("Add Communication")}
    >
      <div className="space-y-4">
        <FormInput
          label={t("Date & Time *")}
          type="datetime-local"
          value={newCommDate}
          onChange={(e) => setNewCommDate(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormSelect
            label={t("Type *")}
            value={newCommType}
            onChange={(e) => setNewCommType(e.target.value as any)}
          >
            <option value="action">{t("Action")}</option>
            <option value="reminder">{t("Reminder")}</option>
            <option value="task">{t("Task")}</option>
          </FormSelect>

          <FormSelect
            label={t("User Rep *")}
            value={newCommUserId}
            onChange={(e) => setNewCommUserId(e.target.value)}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </FormSelect>
        </div>

        {newCommType === 'task' && (
          <div className="grid grid-cols-2 gap-3">
            <FormSelect
              label={t("Responsible User *")}
              value={newCommResponsibleUserId}
              onChange={(e) => setNewCommResponsibleUserId(e.target.value)}
            >
              <option value="">{t("Select Employee")}</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </FormSelect>

            <FormSelect
              label={t("Task Status *")}
              value={newCommTaskStatus}
              onChange={(e) => setNewCommTaskStatus(e.target.value)}
            >
              <option value="pending">{t("Pending")}</option>
              <option value="in_progress">{t("In Progress")}</option>
              <option value="completed">{t("Completed")}</option>
            </FormSelect>
          </div>
        )}

        {newCommType === 'reminder' && (
          <FormInput
            label={t("Reminder Due Time *")}
            type="datetime-local"
            value={newCommReminderTime}
            onChange={(e) => setNewCommReminderTime(e.target.value)}
          />
        )}

        <FormSelect
          label={t("Supplier")}
          value={newCommContactId}
          onChange={(e) => setNewCommContactId(e.target.value)}
        >
          <option value="">{t("Direct / No contact selected")}</option>
          {tempContacts.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.position})
            </option>
          ))}
        </FormSelect>

        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left text-gray-400">{t("Notes / Discussion Content *")}</span>
          <textarea
            rows={4}
            placeholder={t("Discussed pricing rate terms / Scheduled upcoming grease pickup...")}
            value={newCommComment}
            onChange={(e) => {
              setNewCommComment(e.target.value);
              if (commError) setCommError('');
            }}
            className="block w-full px-3.5 py-4 md:py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900 font-sans"
          />
          {commError && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left">{commError}</p>
          )}
        </div>
      </div>
    </FormModal>
  );
}
