# COMPREHENSIVE CODE AUDIT REPORT
# Seminar Check-in System

**Date**: April 24, 2026
**Status**: 20 Issues Found (5 Critical, 7 High, 8 Medium/Low)

---

## CRITICAL ISSUES (Must Fix Immediately)

### 1. Missing Error Handling in Token Hashing
**File**: `app/api/checkin/route.ts`
**Line**: 134-138
**Severity**: CRITICAL
**Description**: The `timingSafeTokenMatch()` function hashes an empty string when the stored token is null/undefined. This could allow an attacker to forge tokens by sending an empty token that matches the hashed empty string.

**Current Code**:
```typescript
function timingSafeTokenMatch(token: string, stored: string | null | undefined): boolean {
  const provided = hashTokenBuffer(token);
  const storedHash = hashTokenBuffer(stored ?? '');  // ❌ Hashing empty string!
  return timingSafeEqual(provided, storedHash);
}
```

**Fixed Code**:
```typescript
function timingSafeTokenMatch(token: string, stored: string | null | undefined): boolean {
  // Early return if stored token is missing - definitely doesn't match
  if (!stored) {
    return false;
  }
  const provided = hashTokenBuffer(token);
  const storedHash = hashTokenBuffer(stored);
  return timingSafeEqual(provided, storedHash);
}
```

---

### 2. Missing CSRF Protection on All API Routes
**File**: All API routes in `app/api/**`
**Severity**: CRITICAL
**Description**: No CSRF token validation on any POST/PUT/DELETE operations. An attacker can perform admin operations by tricking authenticated users into visiting malicious sites.

**Fix**: Add CSRF middleware to all API routes. Create a new utility:

```typescript
// lib/csrf.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const CSRF_TOKEN_NAME = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = '__csrf_token';

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validateCSRFToken(req: NextRequest, token: string): boolean {
  // Get stored token from cookie
  const storedToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!storedToken) return false;
  
  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(storedToken)
  );
}
```

Apply to all POST/PUT/DELETE routes:
```typescript
export async function POST(req: NextRequest) {
  const csrfToken = req.headers.get(CSRF_TOKEN_NAME);
  if (!csrfToken || !validateCSRFToken(req, csrfToken)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }
  // ... rest of handler
}
```

---

### 3. No Transaction Rollback in Import Operations
**File**: `app/api/admin/import/route.ts`
**Lines**: 681-724, 727-760
**Severity**: CRITICAL
**Description**: If the attendee upsert succeeds but the checkin_rounds insertion fails, the database will have inconsistent data. No transaction wrapping these operations.

**Current Issue**:
- Line 681-724: Attendees are upserted
- If succeeds but checkin insertion fails later, partial import is committed

**Fix**: Implement transaction management:

```typescript
// Wrap both operations in a transaction
const { error: txError } = await supabase.rpc('import_attendees_with_checkins', {
  attendee_data: slice.map(row => ({...})),
  checkin_data: checkinSeed.slice(startIdx, endIdx),
  conflict_column: 'ticket_token',
});

if (txError) {
  console.error('IMPORT TRANSACTION ERROR', txError);
  // Entire batch rolled back
  return NextResponse.json({
    ok: false,
    message: 'Transaction rolled back due to error',
    detail: txError.message,
  }, { status: 500 });
}
```

Or implement Postgres function to handle transaction:
```sql
CREATE OR REPLACE FUNCTION import_attendees_with_checkins(
  attendee_data JSONB,
  checkin_data JSONB
) RETURNS void AS $$
BEGIN
  INSERT INTO attendees (...) SELECT ... FROM jsonb_to_recordset(attendee_data)
  ON CONFLICT (ticket_token) DO UPDATE SET ...;
  
  INSERT INTO attendee_checkins (...) SELECT ... FROM jsonb_to_recordset(checkin_data);
  
  -- If any error occurs, entire transaction rolls back
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql;
```

---

### 4. Unvalidated Null Check in Upload-Slip
**File**: `app/api/upload-slip/route.ts`
**Lines**: 83-90
**Severity**: CRITICAL
**Description**: The attendee lookup might return null (e.g., if attendee was deleted between bulk selection and upload). The code uses it without validation, resulting in silent failure with empty province name.

**Current Code**:
```typescript
const { data: attendee } = await supabase
  .from('attendees')
  .select('province')
  .eq('id', attendeeId)
  .single();  // Will return error if not found

const safeProvince = makeSafeFilename(attendee?.province ?? '');
```

**Fixed Code**:
```typescript
const { data: attendee, error: attendeeError } = await supabase
  .from('attendees')
  .select('province')
  .eq('id', attendeeId)
  .single();

if (attendeeError || !attendee) {
  console.error('upload-slip: attendee not found', attendeeError);
  return NextResponse.json(
    {
      success: false,
      message: 'ไม่พบข้อมูลผู้เข้าร่วม อาจถูกลบแล้ว',
    },
    { status: 404 }
  );
}

const safeProvince = makeSafeFilename(attendee.province ?? '');
```

---

### 5. Unvalidated URL in Storage Public Link
**File**: `app/api/upload-slip/route.ts`
**Lines**: 115-119
**Severity**: HIGH
**Description**: `getPublicUrl()` doesn't validate if the storage bucket exists or if the path is accessible. Could store invalid/broken URLs.

**Current Code**:
```typescript
const { data: publicUrlData } = supabase.storage
  .from('payments')
  .getPublicUrl(uploadData.path);

const slipUrl = publicUrlData.publicUrl;  // Could be invalid!
```

**Fixed Code**:
```typescript
const { data: publicUrlData } = supabase.storage
  .from('payments')
  .getPublicUrl(uploadData.path);

const slipUrl = publicUrlData?.publicUrl;

// Validate URL is valid
if (!slipUrl || !URL.canParse(slipUrl)) {
  console.error('upload-slip: invalid public URL generated', slipUrl);
  return NextResponse.json(
    {
      success: false,
      message: 'ไม่สามารถสร้าง URL สำหรับสลิป',
    },
    { status: 500 }
  );
}

// Verify it starts with expected storage domain
const storageOrigin = new URL(slipUrl).origin;
const expectedOrigin = process.env.SUPABASE_URL || '';
if (!storageOrigin.includes('supabaseusercontent.com')) {
  return NextResponse.json(
    {
      success: false,
      message: 'Storage URL validation failed',
    },
    { status: 500 }
  );
}
```

---

## HIGH SEVERITY ISSUES

### 6. Unhandled JSON Parse in AdminBulkSlipModal
**File**: `app/admin/AdminBulkSlipModal.tsx`
**Lines**: 50, 64
**Severity**: HIGH
**Description**: `response.json()` can throw if the response body is not valid JSON. No error handling for parse failures.

**Current Code**:
```typescript
const { slipUrl } = await uploadRes.json();  // ❌ Could throw!
```

**Fixed Code**:
```typescript
let uploadData: any;
try {
  uploadData = await uploadRes.json();
} catch (parseError) {
  console.error('Failed to parse upload response', parseError);
  setError('ไม่สามารถประมวลผลการตอบสนองจากเซิร์ฟเวอร์');
  setIsLoading(false);
  return;
}

if (!uploadData?.slipUrl) {
  setError('ไม่ได้รับ URL สลิปจากเซิร์ฟเวอร์');
  setIsLoading(false);
  return;
}

const { slipUrl } = uploadData;
```

---

### 7. Using `any` Type for Error Handling
**File**: `app/admin/AdminBulkSlipModal.tsx`
**Line**: 77
**Severity**: HIGH
**Description**: `catch (err: any)` loses type information and can hide bugs.

**Current Code**:
```typescript
catch (err: any) {
  setError(err?.message || 'เกิดข้อผิดพลาด');
}
```

**Fixed Code**:
```typescript
catch (err) {
  let errorMessage = 'เกิดข้อผิดพลาด';
  
  if (err instanceof Error) {
    errorMessage = err.message;
  } else if (typeof err === 'string') {
    errorMessage = err;
  }
  
  console.error('Bulk slip upload error:', err);
  setError(errorMessage);
}
```

---

### 8. Race Condition in RegisterUserPageClient Effects
**File**: `app/registeruser/RegisterUserPageClient.tsx`
**Lines**: 282-310, 349-387
**Severity**: HIGH
**Description**: Multiple useEffect hooks load data without proper dependency tracking. If the component state changes, the effects could fire in different orders, causing race conditions.

**Current Issues**:
- `loadCourts()` in one effect
- `checkRegistrationStatus()` in another
- No cleanup or cancellation mechanism
- State updates could occur after component unmount

**Fixed Code**:
```typescript
useEffect(() => {
  let isMounted = true;
  const controller = new AbortController();

  const loadData = async () => {
    try {
      // Load courts
      const courtsRes = await fetch('/api/courts', {
        signal: controller.signal,
      });
      if (!courtsRes.ok) throw new Error('Failed to load courts');
      const courtsData = await courtsRes.json();
      
      if (isMounted) {
        setCourts(courtsData || []);
      }

      // Load registration status
      const statusRes = await fetch('/api/registeruser/count', {
        signal: controller.signal,
      });
      if (!statusRes.ok) throw new Error('Failed to load status');
      const statusData = await statusRes.json();
      
      if (isMounted) {
        setIsRegistered(statusData.isRegistered);
        setRegistrationCount(statusData.count);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to load data:', err);
        if (isMounted) {
          setError(err.message);
        }
      }
    }
  };

  loadData();

  return () => {
    isMounted = false;
    controller.abort();
  };
}, []); // Load once on mount
```

---

### 9. Missing Input Validation in Import Route
**File**: `app/api/admin/import/route.ts`
**Lines**: 594-612, 620-650
**Severity**: HIGH
**Description**: Excel cell values are read directly without validation. Malicious Excel files could inject SQL, XSS, or cause data corruption.

**Fix**:
```typescript
function validateCellValue(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) return null;
  
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  
  // Validate length
  const MAX_LENGTHS: Record<string, number> = {
    name_prefix: 20,
    full_name: 100,
    phone: 20,
    organization: 200,
    job_position: 100,
    province: 50,
    coordinator_name: 100,
    hotel_name: 100,
  };
  
  const maxLen = MAX_LENGTHS[fieldName] || 200;
  if (stringValue.length > maxLen) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLen}`);
  }
  
  // No HTML/SQL in phone or identifiers
  if (fieldName === 'phone' && !/^[0-9\-+()]+$/.test(stringValue)) {
    throw new Error(`Invalid phone number format: ${stringValue}`);
  }
  
  // Prevent common injection patterns
  if (/[<>\"'\\;]/i.test(stringValue) && !fieldName.includes('note')) {
    throw new Error(`Invalid characters in ${fieldName}`);
  }
  
  return stringValue;
}

// Use in loop:
for (let col = 0; col < headers.length; col++) {
  const header = headers[col];
  const cellValue = sheet[`${columnLabel}${row}`]?.v;
  
  try {
    const validatedValue = validateCellValue(cellValue, header);
    prepared[idx][header] = validatedValue;
  } catch (err) {
    throw new Error(`Row ${row}, Column ${header}: ${err.message}`);
  }
}
```

---

### 10. Duplicate Ticket Token Across Events
**File**: `app/api/admin/import/route.ts`
**Line**: 707
**Severity**: HIGH
**Description**: The upsert uses `ticket_token` as conflict column, but doesn't validate that ticket_token is unique within the event. Could overwrite attendees from other events.

**Fixed Code**:
```typescript
// First, validate ticket_token uniqueness within this event
const existingTokens = await supabase
  .from('attendees')
  .select('id, ticket_token')
  .eq('event_id', eventId)
  .in('ticket_token', slice.map(r => r.ticket_token));

if (existingTokens.data && existingTokens.data.length > 0) {
  const duplicates = existingTokens.data.map(r => r.ticket_token);
  return NextResponse.json(
    {
      ok: false,
      message: `Found duplicate ticket tokens in this event: ${duplicates.join(', ')}`,
    },
    { status: 400 },
  );
}

// Safe to upsert now
const { error: insertError } = await supabase
  .from('attendees')
  .upsert(slice.map(row => ({
    event_id: eventId,
    ticket_token: row.ticket_token,
    // ... other fields
  })), { onConflict: 'event_id,ticket_token' }); // Conflict on composite key
```

---

## MEDIUM SEVERITY ISSUES

### 11. Race Condition in AttendeePageClient
**File**: `app/attendee/[ticket_token]/AttendeePageClient.tsx`
**Lines**: 172-176, 215-218
**Severity**: MEDIUM
**Description**: Async state updates after component unmount. React will warn about memory leaks.

**Fixed Code**:
```typescript
useEffect(() => {
  let isMounted = true;
  const controller = new AbortController();

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/attendee/${ticketToken}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to load status');
      const data = await res.json();
      
      if (isMounted) {
        setCheckinStatus(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        if (isMounted) {
          setError(err.message);
        }
      }
    }
  };

  loadStatus();

  return () => {
    isMounted = false;
    controller.abort();
  };
}, [ticketToken]);
```

---

### 12. Empty Update Validation Missing
**File**: `app/api/admin/update-attendee/route.ts`
**Lines**: 37-62, 141
**Severity**: MEDIUM
**Description**: Updates can be issued with no fields changed. Wastes database operations and could cause unexpected behavior.

**Fixed Code**:
```typescript
let updateData: Partial<AdminAttendeeRow> = {};

if (slip_url !== undefined) {
  updateData.slip_url = slip_url;
}
if (full_name !== undefined) {
  updateData.full_name = full_name;
}
// ... other fields

if (Object.keys(updateData).length === 0) {
  return NextResponse.json(
    { error: 'No fields provided to update' },
    { status: 400 }
  );
}

const { data, error } = await supabase
  .from('attendees')
  .update(updateData)
  .eq('id', id)
  .select()
  .single();
```

---

### 13. Unsafe Generic Error Catch
**File**: `app/api/registeruser/route.ts`
**Lines**: 612-620
**Severity**: MEDIUM
**Description**: Catches all errors generically without distinguishing between validation, database, or system errors.

**Fixed Code**:
```typescript
} catch (err) {
  console.error('Registration error:', err);
  
  let statusCode = 500;
  let message = 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
  
  if (err instanceof TypeError) {
    statusCode = 400;
    message = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
  } else if (err instanceof Error && err.message.includes('constraint')) {
    statusCode = 409;
    message = 'ข้อมูลนี้มีอยู่แล้วในระบบ';
  }
  
  return NextResponse.json({ error: message }, { status: statusCode });
}
```

---

### 14. Unvalidated Phone Number Normalization
**File**: `app/api/registeruser/route.ts`
**Lines**: 554-579
**Severity**: MEDIUM
**Description**: `phoneForStorage()` might return null for invalid inputs, but the code doesn't check before storing.

**Fixed Code**:
```typescript
const normalizedPhone = phoneForStorage(phone);
if (phone && !normalizedPhone) {
  console.warn('Failed to normalize phone:', phone);
  // Log but don't block - store original
  participantData.phone = phone;
} else {
  participantData.phone = normalizedPhone;
}
```

---

### 15. Using `any` Type in Force Checkin
**File**: `app/api/admin/force-checkin/route.ts`
**Line**: 119
**Severity**: MEDIUM
**Description**: Response cast to `any` without validation.

**Fixed Code**:
```typescript
interface CheckinRound {
  id: string;
  round: number;
  checked_in_at: string;
}

const existingRounds: CheckinRound[] = rows ?? [];
```

---

## LOW SEVERITY ISSUES

### 16. Alert() Used for Error Display
**File**: `app/registeruser/RegisterUserPageClient.tsx`
**Lines**: 599, 645
**Severity**: LOW
**Description**: Alert boxes are poor UX. Should show errors in UI instead.

**Fix**: Replace `alert()` calls with state-based error display (already implemented in component, but alert should be removed).

---

### 17. Unused Buffer Memory in Import
**File**: `app/api/admin/import/route.ts`
**Lines**: 568-570
**Severity**: LOW
**Description**: ArrayBuffer is created but never explicitly freed (not a real leak in JS, but could hint at inefficiency).

**Fix**: Process file in chunks instead of loading entire buffer:
```typescript
// Instead of:
const arrayBuffer = await file.arrayBuffer();

// Use:
const reader = new FileReader();
reader.onload = (e) => {
  const arrayBuffer = e.target?.result as ArrayBuffer;
  // Process in chunks
};
```

---

### 18. String Parsing Fragility
**File**: `app/registeruser/RegisterUserPageClient.tsx`
**Lines**: 432-447
**Severity**: LOW-MEDIUM
**Description**: Province extraction from organization name via regex is fragile and could fail silently.

**Fix**:
```typescript
function extractProvinceFromOrg(org: string): string | null {
  if (!org) return null;
  
  // More robust province extraction
  const provincePatterns = [
    /(?:ภาค|จังหวัด)\s*(\S+)/i,
    /\(([^)]+)\)/, // Extract from parentheses
    /^([^(]+)/, // First part before parentheses
  ];
  
  for (const pattern of provincePatterns) {
    const match = org.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}
```

---

### 19. No Abort Controller in Some Fetch Calls
**File**: Multiple components
**Severity**: LOW
**Description**: Some fetch calls don't use AbortController, making it harder to cancel on unmount.

**Fix**: Consistently use AbortController in all fetch-based effects.

---

### 20. Loose Type Checking in UI
**File**: Various component files
**Severity**: LOW
**Description**: Some optional chaining uses without null checks (`data?.field?.nested`).

**Fix**: Add proper null guards or use optional chaining consistently.

---

## SUMMARY TABLE

| # | Severity | Category | File | Issue | Priority |
|---|----------|----------|------|-------|----------|
| 1 | CRITICAL | Security | checkin/route.ts | Token hash empty string | P0 |
| 2 | CRITICAL | Security | All API routes | Missing CSRF protection | P0 |
| 3 | CRITICAL | Data Integrity | import/route.ts | No transaction rollback | P0 |
| 4 | CRITICAL | Error Handling | upload-slip/route.ts | Unvalidated null check | P0 |
| 5 | HIGH | Error Handling | upload-slip/route.ts | Unvalidated storage URL | P1 |
| 6 | HIGH | Error Handling | AdminBulkSlipModal.tsx | Unhandled JSON parse | P1 |
| 7 | HIGH | Type Safety | AdminBulkSlipModal.tsx | Using `any` for error | P1 |
| 8 | HIGH | Concurrency | RegisterUserPageClient.tsx | Race condition in effects | P1 |
| 9 | HIGH | Security | import/route.ts | No input validation | P1 |
| 10 | HIGH | Data Integrity | import/route.ts | Duplicate tokens | P1 |
| 11 | MEDIUM | Concurrency | AttendeePageClient.tsx | Async after unmount | P2 |
| 12 | MEDIUM | Validation | update-attendee/route.ts | Empty update allowed | P2 |
| 13 | MEDIUM | Error Handling | registeruser/route.ts | Generic catch block | P2 |
| 14 | MEDIUM | Validation | registeruser/route.ts | Unvalidated phone normalization | P2 |
| 15 | MEDIUM | Type Safety | force-checkin/route.ts | Using `any` type | P2 |
| 16 | LOW | UX | RegisterUserPageClient.tsx | alert() for errors | P3 |
| 17 | LOW | Memory | import/route.ts | Buffer not freed | P3 |
| 18 | LOW-MEDIUM | Robustness | RegisterUserPageClient.tsx | Fragile string parsing | P2 |
| 19 | LOW | Best Practice | Various | Missing AbortController | P3 |
| 20 | LOW | Type Safety | Various | Loose type checking | P3 |

---

## REMEDIATION PRIORITY

**P0 (Fix Today)**:
1. Add CSRF protection to all API routes
2. Fix token hashing bug in checkin route
3. Add transaction handling to import route
4. Validate attendee existence in upload-slip

**P1 (Fix This Week)**:
5. Validate storage URL
6. Fix JSON parse error handling
7. Fix type safety issues
8. Add race condition fixes
9. Add input validation to import

**P2 (Fix This Sprint)**:
11-15. Medium severity issues

**P3 (Backlog)**:
16-20. Low severity improvements

---

## SECURITY CHECKLIST

- [ ] CSRF tokens added to all state-changing endpoints
- [ ] Input validation on all user inputs
- [ ] SQL injection protection (using ORM - already done)
- [ ] XSS protection (using React safe rendering - already done)
- [ ] Authentication verified on all protected routes
- [ ] Rate limiting implemented
- [ ] Error messages don't leak sensitive info
- [ ] Sensitive data not logged
- [ ] Token comparison is timing-safe
- [ ] File uploads validated and scanned
- [ ] Database transactions for multi-step operations
- [ ] Race conditions eliminated with AbortController
- [ ] Memory leaks prevented with cleanup functions

