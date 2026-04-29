// NEW VERSION OF: app/api/admin/import/route.ts
// REPLACEMENT INSTRUCTIONS:
// 1) ENSURE IMPORT at top of file: import { createServerClient } from '@/lib/supabaseServer';
// 2) REPLACE Line 551 (supabase initialization) with the code below
// 3) REPLACE Lines 678-813 (attendee import logic) with the code below

// ============================================================================
// REPLACE LINE 551 (initialize supabase):
// FROM: const supabase = createServerClient();
// ============================================================================
    const supabase = createServerClient();

// ============================================================================
// REPLACE THE ENTIRE SECTION BELOW (from line 678 onwards)
// ============================================================================

    // 5) ใช้ EVENT_ID จาก env เป็นค่าเริ่มต้น
    const envEventId = (process.env.EVENT_ID ?? '').trim();
    if (!envEventId) {
      return NextResponse.json(
        { ok: false, message: 'ยังไม่ได้ตั้งค่า EVENT_ID ใน Environment' },
        { status: 500 },
      );
    }

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', envEventId)
      .maybeSingle();

    if (eventError || !eventRow) {
      return NextResponse.json(
        { ok: false, message: 'EVENT_ID ไม่ถูกต้อง หรือไม่พบ event' },
        { status: 400 },
      );
    }

    const eventId = eventRow.id as string;

    // 6) Prepare attendee data as JSONB array for transaction function
    const attendeeDataForTransaction = prepared.map((row) => ({
      court_id: row.court_id,
      name_prefix: row.name_prefix,
      full_name: row.full_name,
      phone: row.phone,
      organization: row.organization,
      job_position: row.job_position,
      province: row.province,
      region: row.region,
      qr_image_url: row.qr_image_url,
      slip_url: row.slip_url,
      food_type: row.food_type,
      travel_mode: row.travel_mode,
      travel_other: row.travel_other,
      coordinator_prefix_other: row.coordinator_prefix_other,
      coordinator_name: row.coordinator_name,
      coordinator_phone: row.coordinator_phone,
      hotel_name: row.hotel_name,
      ticket_token: row.ticket_token,
    }));

    // 7) Prepare checkin data as JSONB array
    const checkinDataForTransaction = prepared.flatMap((row) => {
      const items: Array<{
        ticket_token: string;
        round: number;
        checked_in_at: string;
      }> = [];

      if (row.checkin_round1_at) {
        items.push({
          ticket_token: row.ticket_token,
          round: 1,
          checked_in_at: row.checkin_round1_at,
        });
      }
      if (row.checkin_round2_at) {
        items.push({
          ticket_token: row.ticket_token,
          round: 2,
          checked_in_at: row.checkin_round2_at,
        });
      }
      if (row.checkin_round3_at) {
        items.push({
          ticket_token: row.ticket_token,
          round: 3,
          checked_in_at: row.checkin_round3_at,
        });
      }

      return items;
    });

    // 8) ATOMIC TRANSACTION: Call the PostgreSQL function
    // This function ensures that either:
    // - ALL attendees and checkins are inserted successfully, OR
    // - NOTHING is inserted (automatic rollback on any error)
    const { data: transactionResult, error: transactionError } = await supabase.rpc(
      'import_attendees_with_checkins',
      {
        p_event_id: eventId,
        p_attendee_data: attendeeDataForTransaction,
        p_checkin_data: checkinDataForTransaction,
      }
    );

    // 9) Check transaction result
    if (transactionError) {
      console.error('IMPORT TRANSACTION ERROR', {
        code: transactionError.code,
        message: transactionError.message,
        details: transactionError,
      });

      return NextResponse.json(
        {
          ok: false,
          message: `นำเข้าข้อมูลล้มเหลว - ทั้งหมดถูก Rollback เพื่อความปลอดภัย`,
          errorDetails: transactionError.message,
          importedCount: 0,
          totalRows: prepared.length,
        },
        { status: 500 }
      );
    }

    // 10) Validate transaction result structure
    if (!transactionResult || !Array.isArray(transactionResult) || transactionResult.length === 0) {
      console.error('IMPORT TRANSACTION: Invalid response structure', transactionResult);

      return NextResponse.json(
        {
          ok: false,
          message: 'นำเข้าข้อมูลล้มเหลว - ไม่สามารถดำเนินการได้',
          importedCount: 0,
        },
        { status: 500 }
      );
    }

    const result = transactionResult[0];

    // 11) Check if transaction succeeded
    if (!result.success) {
      const errorMessage = result.error_message || 'Unknown error occurred';
      const failedRowIdx = result.failed_row_index;
      const failedValue = result.failed_value;

      console.error('IMPORT TRANSACTION FAILED', {
        errorMessage,
        failedRowIndex: failedRowIdx,
        failedValue,
      });

      // Build detailed error message
      let userMessage = `นำเข้าข้อมูลล้มเหลว (ทั้งหมดถูก Rollback): ${errorMessage}`;
      if (failedRowIdx !== null && failedRowIdx !== undefined) {
        // Row index is 0-based from the array, but Excel rows are 1-based with header
        const excelRowNumber = failedRowIdx + 2; // +1 for 0-index, +1 for header row
        userMessage += ` (ที่แถวที่ ${excelRowNumber})`;
      }
      if (failedValue) {
        userMessage += ` [${failedValue}]`;
      }

      return NextResponse.json(
        {
          ok: false,
          message: userMessage,
          errorCode: 'TRANSACTION_FAILED',
          failedRowNumber: failedRowIdx !== null ? failedRowIdx + 2 : undefined,
          failedValue: failedValue,
          importedCount: 0,
          totalRows: prepared.length,
        },
        { status: 422 }
      );
    }

    // 12) Success!
    const importedCount = result.imported_count ?? prepared.length;

    console.log('IMPORT TRANSACTION SUCCESS', {
      eventId,
      importedCount,
      totalRows: prepared.length,
      checkinsProcessed: checkinDataForTransaction.length,
    });

    return NextResponse.json({
      ok: true,
      imported: importedCount,
      message: `นำเข้าข้อมูลสำเร็จ ${importedCount} รายการ`,
      totalRows: prepared.length,
      checkinRecords: checkinDataForTransaction.length,
    });

  } catch (err) {
    console.error('IMPORT ROUTE ERROR', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดระหว่างการประมวลผลไฟล์',
        errorDetails:
          process.env.NODE_ENV === 'development'
            ? err instanceof Error
              ? err.message
              : String(err)
            : undefined,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// END OF REPLACEMENT
// ============================================================================
