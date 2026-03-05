'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { maskPhone } from '@/lib/maskPhone';

import ForceCheckinButton from './ForceCheckinButton';
import AdminDeleteButton from './AdminDeleteButton';
import AdminSlipUploadButton from './AdminSlipUploadButton';
import AdminSlipClearButton from './AdminSlipClearButton';
import type { AdminAttendeeRow } from './types';

type AdminAttendeeTableClientProps = {
  attendees: AdminAttendeeRow[];
  from: number;
};

const JOB_POSITION_LABELS: Record<string, string> = {
  chief_judge: 'ผู้พิพากษาหัวหน้าศาล',
  associate_judge: 'ผู้พิพากษาสมทบ',
  '????????????????????': 'ผู้พิพากษาหัวหน้าศาล',
  '??????????????': 'ผู้พิพากษาสมทบ',
};

const TRAVEL_MODE_LABELS: Record<string, string> = {
  car: 'รถยนต์ส่วนบุคคล',
  van: 'รถตู้',
  bus: 'รถบัส',
  train: 'รถไฟ',
  plane: 'เครื่องบิน',
  motorcycle: 'รถจักรยานยนต์',
  other: 'อื่น ๆ',
};

function formatDateTime(isoString: string | null) {
  if (!isoString) return '-';
  try {
    return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleString('th-TH');
  }
}

function formatFoodType(foodType: string | null): string {
  switch (foodType) {
    case 'normal':
      return 'ทั่วไป';
    case 'no_pork':
      return 'ไม่ทานหมู';
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'vegan':
      return 'เจ / วีแกน';
    case 'halal':
      return 'ฮาลาล';
    case 'seafood_allergy':
      return 'แพ้อาหารทะเล';
    case 'other':
      return 'อื่น ๆ';
    case null:
    case '':
    default:
      return 'ไม่ระบุ';
  }
}

function formatJobPosition(jobPosition: string | null): string {
  if (!jobPosition) return '-';
  const trimmed = jobPosition.trim();
  if (!trimmed) return '-';
  return JOB_POSITION_LABELS[trimmed] ?? trimmed;
}

function formatTravelMode(mode: string | null, other: string | null): string {
  if (!mode) return '-';
  const trimmed = mode.trim();
  if (!trimmed) return '-';
  const label = TRAVEL_MODE_LABELS[trimmed] ?? trimmed;
  if (trimmed === 'other') {
    const extra = (other ?? '').trim();
    return extra ? `${label}: ${extra}` : label;
  }
  return label;
}

function formatRegion(region: number | null): string {
  if (region === null || Number.isNaN(region)) return '-';
  if (region === 0) return 'ศาลเยาวชนและครอบครัวกลาง';
  return `ภาค ${region}`;
}

export default function AdminAttendeeTableClient({
  attendees,
  from,
}: AdminAttendeeTableClientProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const attendeeIds = useMemo(() => attendees.map((attendee) => attendee.id), [attendees]);

  const attendeesById = useMemo(
    () => new Map(attendees.map((attendee) => [attendee.id, attendee])),
    [attendees],
  );

  const selectedIdsOnPage = useMemo(
    () => selectedIds.filter((id) => attendeesById.has(id)),
    [selectedIds, attendeesById],
  );

  const selectedSet = useMemo(() => new Set(selectedIdsOnPage), [selectedIdsOnPage]);
  const selectedCount = selectedIdsOnPage.length;

  const allSelected = attendeeIds.length > 0 && attendeeIds.every((id) => selectedSet.has(id));
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const selectedAttendee =
    selectedCount === 1 ? attendeesById.get(selectedIdsOnPage[0] ?? '') ?? null : null;

  const canEditSelected =
    selectedCount > 1 || (selectedCount === 1 && Boolean(selectedAttendee?.ticket_token));

  function handleToggleRow(id: string) {
    setSelectedIds((prev) => {
      const validPrev = prev.filter((value) => attendeesById.has(value));
      return validPrev.includes(id)
        ? validPrev.filter((value) => value !== id)
        : [...validPrev, id];
    });
  }

  function handleToggleAll(checked: boolean) {
    setSelectedIds(checked ? attendeeIds : []);
  }

  function handleEditSelected() {
    if (selectedCount <= 0) return;

    if (selectedCount === 1) {
      if (!selectedAttendee?.ticket_token) return;
      router.push(`/admin/attendee/${selectedAttendee.ticket_token}`);
      return;
    }

    const params = new URLSearchParams();
    params.set('ids', selectedIdsOnPage.join(','));
    router.push(`/admin/attendees/edit?${params.toString()}`);
  }

  function handleClearSelection() {
    setSelectedIds([]);
  }

  return (
    <>
      <div className="admin-table__bulkbar">
        <div className="admin-table__bulkmeta">เลือกแล้ว {selectedCount} รายการ</div>
        <div className="admin-table__bulkactions">
          <button
            type="button"
            className="admin-table__bulkbtn"
            onClick={() => handleToggleAll(!allSelected)}
            disabled={attendeeIds.length === 0}
          >
            {allSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมดหน้านี้'}
          </button>
          <button
            type="button"
            className="admin-table__bulkbtn"
            onClick={handleClearSelection}
            disabled={selectedCount === 0}
          >
            ล้างที่เลือก
          </button>
          <button
            type="button"
            className="admin-table__bulkbtn admin-table__bulkbtn--primary"
            onClick={handleEditSelected}
            disabled={!canEditSelected}
            title={
              selectedCount === 0
                ? 'เลือกผู้เข้าร่วมอย่างน้อย 1 รายการ'
                : selectedCount === 1
                  ? 'แก้ไขข้อมูลผู้เข้าร่วมรายนี้'
                  : `แก้ไขผู้เข้าร่วม ${selectedCount} รายการ`
            }
          >
            แก้ไขรายการที่เลือก
          </button>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr className="admin-table__head-row">
            <th className="admin-table__select-col">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="admin-table__check"
                checked={allSelected}
                onChange={(event) => handleToggleAll(event.target.checked)}
                aria-label="เลือกผู้เข้าร่วมทั้งหมดในหน้านี้"
              />
            </th>
            <th>#</th>
            <th>ชื่อ - นามสกุล</th>
            <th>หน่วยงาน</th>
            <th>ภาค/ศาลกลาง</th>
            <th>ตำแหน่ง</th>
            <th>ผู้ประสานงาน</th>
            <th>โรงแรม</th>
            <th>การเดินทาง</th>
            <th>สลิป</th>
            <th>ลงทะเบียน</th>
            <th>ประเภทอาหาร</th>
            <th>จัดการ</th>
          </tr>
        </thead>

        <tbody>
          {attendees.length === 0 ? (
            <tr>
              <td colSpan={13} className="admin-table__empty">
                ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา
              </td>
            </tr>
          ) : (
            attendees.map((attendee, idx) => {
              const hasSlip = Boolean(attendee.slip_url);
              const isChecked = Boolean(attendee.checked_in_at);
              const foodLabel = formatFoodType(attendee.food_type);
              const namePrefix = (attendee.name_prefix ?? '').trim();
              const fullName = (attendee.full_name ?? '').trim();
              const displayName =
                namePrefix || fullName
                  ? `${namePrefix ? `${namePrefix} ` : ''}${fullName}`.trim()
                  : '-';
              const isSelected = selectedSet.has(attendee.id);

              return (
                <tr key={attendee.id ?? idx} className={isSelected ? 'admin-table__row--selected' : ''}>
                  <td className="admin-table__select-col">
                    <input
                      type="checkbox"
                      className="admin-table__check"
                      checked={isSelected}
                      onChange={() => handleToggleRow(attendee.id)}
                      aria-label={`เลือกผู้เข้าร่วม ${displayName}`}
                    />
                  </td>

                  <td>{from + idx + 1}</td>

                  <td>
                    <div>{displayName}</div>
                    <div>
                      <small>{maskPhone(attendee.phone)}</small>
                    </div>
                  </td>

                  <td>
                    <div>{attendee.organization || '-'}</div>
                    <div>
                      <small>{attendee.province || '-'}</small>
                    </div>
                  </td>

                  <td>{formatRegion(attendee.region)}</td>
                  <td>{formatJobPosition(attendee.job_position)}</td>

                  <td>
                    <div>{attendee.coordinator_name || '-'}</div>
                    <div>
                      <small>{maskPhone(attendee.coordinator_phone)}</small>
                    </div>
                  </td>

                  <td>{attendee.hotel_name || '-'}</td>
                  <td>{formatTravelMode(attendee.travel_mode, attendee.travel_other)}</td>

                  <td>
                    <div className="admin-table__slip-cell">
                      {hasSlip ? (
                        <span className="admin-pill admin-pill--blue">มีสลิป</span>
                      ) : (
                        <span className="admin-pill admin-pill--muted">ไม่มี</span>
                      )}
                    </div>
                  </td>

                  <td>
                    {isChecked ? (
                      <div className="admin-table__checkin">
                        <span className="admin-pill admin-pill--green">ลงทะเบียนแล้ว</span>
                        <span className="admin-table__checkin-time" suppressHydrationWarning>
                          {formatDateTime(attendee.checked_in_at)}
                        </span>
                      </div>
                    ) : (
                      <div className="admin-table__checkin">
                        <span className="admin-pill admin-pill--warning">ยังไม่ลงทะเบียน</span>
                      </div>
                    )}
                  </td>

                  <td>
                    <span className="admin-pill admin-pill--food">{foodLabel}</span>
                  </td>

                  <td>
                    <details>
                      <summary className="admin-link-edit">จัดการ</summary>

                      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                        <a
                          href={`/admin/attendee/${attendee.ticket_token}`}
                          className="admin-link-edit"
                        >
                          แก้ไขข้อมูล
                        </a>

                        {hasSlip ? (
                          <a
                            href={attendee.slip_url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="admin-link-edit"
                          >
                            ดูสลิป
                          </a>
                        ) : (
                          <span className="admin-pill admin-pill--muted">ไม่มีสลิป</span>
                        )}

                        {isChecked ? (
                          <ForceCheckinButton
                            attendeeId={attendee.id}
                            action="uncheckin"
                            label="ยกเลิกลงทะเบียน"
                            isCheckedIn={isChecked}
                            hasSlip={hasSlip}
                          />
                        ) : (
                          <ForceCheckinButton
                            attendeeId={attendee.id}
                            action="checkin"
                            label="ลงทะเบียน"
                            isCheckedIn={isChecked}
                            hasSlip={hasSlip}
                          />
                        )}

                        {hasSlip ? (
                          <AdminSlipClearButton attendeeId={attendee.id} />
                        ) : (
                          <AdminSlipUploadButton attendeeId={attendee.id} />
                        )}

                        <AdminDeleteButton attendeeId={attendee.id} fullName={attendee.full_name} />
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </>
  );
}
