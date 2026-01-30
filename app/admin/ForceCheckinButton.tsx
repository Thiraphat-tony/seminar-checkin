'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ForceCheckinButtonProps = {
  attendeeId: string;
  hasSlip: boolean;
  action: 'checkin' | 'uncheckin';
  label: string;
  isCheckedIn: boolean;
};

type RoundChoice = 'auto' | '1' | '2' | '3' | 'all';

export default function ForceCheckinButton({
  attendeeId,
  hasSlip,
  action,
  label,
  isCheckedIn,
}: ForceCheckinButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCalling, setIsCalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [roundChoice, setRoundChoice] = useState<RoundChoice>('auto');

  const isLoading = isCalling || isPending;

  const handleForceCheckin = async () => {
    setMessage(null);
    setMessageType('success');

    // เช็คว่าเป็นการยกเลิกลงทะเบียนแล้วแต่ผู้เข้าร่วมยังไม่ได้ลงทะเบียน
    if (action === 'uncheckin' && !isCheckedIn) {
      setMessage('ผู้เข้าร่วมยังไม่ได้ลงทะเบียน ดังนั้นไม่สามารถยกเลิกลงทะเบียนได้');
      setMessageType('error');
      return;
    }

    if (action === 'uncheckin' && roundChoice === 'all') {
      const ok = window.confirm('ต้องการยกเลิกลงทะเบียนทุกช่วงของผู้เข้าร่วมรายนี้ใช่หรือไม่?');
      if (!ok) return;
    }

    // ถ้าอยากเตือนกรณียังไม่มีสลิป
    if (!hasSlip) {
      const ok = window.confirm(
        'ยังไม่พบสลิปแนบในระบบ ต้องการลงทะเบียนแทนผู้เข้าร่วมรายนี้หรือไม่?'
      );
      if (!ok) return;
    }

    try {
      setIsCalling(true);

      const payload: { attendeeId: string; action: 'checkin' | 'uncheckin'; round?: number | 'all' } = {
        attendeeId,
        action,
      };
      if (action === 'uncheckin' && roundChoice !== 'auto') {
        payload.round = roundChoice === 'all' ? 'all' : Number(roundChoice);
      }

      const res = await fetch('/api/admin/force-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.success) {
        setMessage(data.message || 'ลงทะเบียนแทนไม่สำเร็จ');
        setMessageType('error');
        return;
      }

      setMessage(data.message || 'ลงทะเบียนแทนเรียบร้อย');
      setMessageType('success');

      const shouldRefresh =
        action === 'checkin'
          ? data.alreadyCheckedIn !== true
          : data.alreadyUnchecked !== true;

      if (shouldRefresh) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err) {
      console.error('force checkin button error', err);
      setMessage('เกิดข้อผิดพลาดขณะลงทะเบียนแทน');
      setMessageType('error');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="admin-forcecheckin">
      {action === 'uncheckin' && (
        <div className="admin-forcecheckin__round">
          <label className="admin-forcecheckin__round-label" htmlFor={`round-${attendeeId}`}>
            ยกเลิกรอบ
          </label>
          <select
            id={`round-${attendeeId}`}
            className="admin-filters__select admin-forcecheckin__round-select"
            value={roundChoice}
            onChange={(event) => setRoundChoice(event.target.value as RoundChoice)}
            disabled={isLoading}
          >
            <option value="auto">อัตโนมัติ (รอบที่เปิดอยู่)</option>
            <option value="1">รอบ 1</option>
            <option value="2">รอบ 2</option>
            <option value="3">รอบ 3</option>
            <option value="all">ยกเลิกทั้งหมด</option>
          </select>
        </div>
      )}
      <button
        type="button"
        className="admin-forcecheckin__button"
        onClick={handleForceCheckin}
        disabled={isLoading}
        data-action={action}
        data-no-slip={!hasSlip}
        data-loading={isLoading}
      >
        {isLoading ? 'กำลังลงทะเบียน…' : label}
      </button>
      {message && (
        <p 
          className="admin-forcecheckin__message" 
          data-type={messageType}
          title={message}
        >
          {message}
        </p>
      )}
    </div>
  );
}
