# CODE AUDIT ACTION PLAN
## Seminar Check-in System - Security & Stability Fixes

**Generated**: April 24, 2026
**Status**: 4 Critical Fixes Applied, 16 Remaining

---

## ✅ COMPLETED TODAY

### Fixed Issues:
1. ✅ **Token Hashing Security Flaw** - `app/api/checkin/route.ts:134`
   - Added explicit null check in `timingSafeTokenMatch()`
   - Prevents forged tokens when stored token is missing

2. ✅ **Unvalidated Attendee Lookup** - `app/api/upload-slip/route.ts:83`
   - Added error check for missing attendees
   - Returns 404 instead of silent failure

3. ✅ **JSON Parse Error** - `app/admin/AdminBulkSlipModal.tsx:50`
   - Added try/catch around `response.json()`
   - Validates response structure before using

4. ✅ **Type Safety in Error Handling** - `app/admin/AdminBulkSlipModal.tsx:77`
   - Replaced `catch (err: any)` with proper type checking
   - Better error messages for users

---

## 🚨 CRITICAL PRIORITY (P0) - Complete This Week

### [ ] 1. Add CSRF Protection to All API Routes
**Impact**: Prevents cross-site request forgery attacks
**Time Estimate**: 3-4 hours
**Files to Update**:
- All routes in `app/api/**` (POST, PUT, DELETE methods)
- Add CSRF token validation middleware

**Implementation**:
```bash
# Create new CSRF utility
touch lib/csrf.ts
# Add CSRF token to all forms in components
# Update API routes to validate tokens
```

**Files Affected**: ~15 API routes

---

### [ ] 2. Add Transaction Rollback to Import Operations
**Impact**: Prevents database inconsistency
**Time Estimate**: 2-3 hours
**File**: `app/api/admin/import/route.ts`
**Issue**: Lines 681-760
**Risk**: Partial data import if checkin insertion fails

**Options**:
- Option A: Use Supabase RPC with transaction
- Option B: Implement rollback mechanism in Node.js
- Option C: Split into separate operations with validation

**Recommendation**: Use Supabase RPC approach (safest)

---

### [ ] 3. Validate Storage URL in Upload-Slip
**Impact**: Prevents broken/invalid slip URLs
**Time Estimate**: 30 minutes
**File**: `app/api/upload-slip/route.ts`
**Lines**: 115-119
**Current**: No validation of generated public URL

**Fix**:
```typescript
const slipUrl = publicUrlData?.publicUrl;
if (!slipUrl || !slipUrl.startsWith('https://')) {
  return NextResponse.json({
    success: false,
    message: 'Storage URL validation failed'
  }, { status: 500 });
}
```

---

### [ ] 4. Input Validation in Import Route
**Impact**: Prevents data corruption and injection attacks
**Time Estimate**: 4-5 hours
**File**: `app/api/admin/import/route.ts`
**Lines**: 594-650
**Issue**: Excel cells read without validation

**Add Validation Function**:
- Max length checks per field
- Phone number format validation
- Prevent SQL/XSS injection patterns
- Type validation (string, number, date)

**Files to Update**: 1 (import/route.ts)

---

## ⚠️ HIGH PRIORITY (P1) - Complete In 2 Weeks

### [ ] 5. Fix Race Conditions in RegisterUserPageClient
**Impact**: Prevents state inconsistency
**Time Estimate**: 2 hours
**File**: `app/registeruser/RegisterUserPageClient.tsx`
**Lines**: 282-387
**Issue**: Multiple useEffect hooks without proper cancellation

**Fix**: Use AbortController and single combined effect

---

### [ ] 6. Prevent Duplicate Ticket Tokens
**Impact**: Prevents data corruption across events
**Time Estimate**: 1 hour
**File**: `app/api/admin/import/route.ts`
**Line**: 707

**Add Check**:
```typescript
// Before upsert, check for duplicates in this event
const existingTokens = await supabase
  .from('attendees')
  .select('ticket_token')
  .eq('event_id', eventId)
  .in('ticket_token', slice.map(r => r.ticket_token));

if (existingTokens.data?.length > 0) {
  return NextResponse.json({
    ok: false,
    message: 'Duplicate ticket tokens detected'
  }, { status: 400 });
}
```

---

### [ ] 7. Fix Async State Updates in AttendeePageClient
**Impact**: Eliminates React memory leak warnings
**Time Estimate**: 1 hour
**File**: `app/attendee/[ticket_token]/AttendeePageClient.tsx`

**Add AbortController cleanup**

---

### [ ] 8. Generic Error Handling in RegisterUser Route
**Impact**: Better error diagnosis and handling
**Time Estimate**: 30 minutes
**File**: `app/api/registeruser/route.ts`
**Lines**: 612-620

---

### [ ] 9. Validate Phone Normalization
**Impact**: Prevents storing invalid phone numbers
**Time Estimate**: 30 minutes
**File**: `app/api/registeruser/route.ts`
**Lines**: 554-579

---

## 💡 MEDIUM PRIORITY (P2) - Complete Next Sprint

### [ ] 10-15: Medium Severity Issues
- Type safety improvements
- AbortController in all fetch calls
- String parsing robustness
- Additional validations

**Total Time**: 2-3 hours

---

## 📋 TESTING CHECKLIST

After each fix, verify:

### Token Security (Fix #1):
- [ ] Test with invalid/missing stored token
- [ ] Verify empty token doesn't match
- [ ] Test timing-safe comparison still works

### CSRF Protection (Fix #2):
- [ ] Create test for missing CSRF token
- [ ] Create test for invalid CSRF token
- [ ] Verify legitimate requests still work
- [ ] Test form submission includes token

### Transaction Rollback (Fix #3):
- [ ] Test successful import end-to-end
- [ ] Test with invalid checkin data → verify attendees not inserted
- [ ] Test with invalid attendee data → verify entire batch fails
- [ ] Verify partial imports don't occur

### URL Validation (Fix #4):
- [ ] Test with valid URL
- [ ] Test with malformed URL
- [ ] Test with non-HTTPS URL
- [ ] Verify slip can be downloaded

### Input Validation (Fix #5):
- [ ] Test with max length fields
- [ ] Test with special characters
- [ ] Test with HTML/SQL injection attempts
- [ ] Test with valid data still imports

### Race Condition (Fix #6):
- [ ] Rapid component mount/unmount
- [ ] Navigate away during data loading
- [ ] Verify no React warnings in console
- [ ] Verify state consistent

### Async Cleanup (Fix #7):
- [ ] Unmount component mid-fetch
- [ ] No "memory leak" warnings
- [ ] No dangling requests to backend

---

## 🔐 SECURITY IMPACT SUMMARY

| Fix | Security Benefit | CVSS Impact |
|-----|------------------|-------------|
| #1: Token Hash | Prevent token forgery | Critical |
| #2: CSRF | Prevent unauthorized actions | High |
| #3: Transactions | Data consistency | High |
| #4: URL Validation | Resource availability | Medium |
| #5: Input Validation | Prevent injection attacks | High |
| #6: Duplicate Tokens | Data integrity | High |

---

## 📊 EFFORT BREAKDOWN

| Category | Hours | Priority |
|----------|-------|----------|
| CSRF Protection | 3-4 | P0 |
| Transactions | 2-3 | P0 |
| Validations | 5-6 | P0-P1 |
| Race Conditions | 3-4 | P1 |
| Other Medium | 2-3 | P2 |
| **Total** | **15-20** | — |

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### Week 1 (5-6 hours):
1. Add CSRF protection (most impactful)
2. Fix transaction rollback
3. Add input validation

### Week 2 (3-4 hours):
4. Fix race conditions
5. Prevent duplicate tokens
6. Improve error handling

### Week 3 (3-4 hours):
7. Fix async cleanup
8. Additional validations
9. Type safety improvements

---

## ✨ QUICK WINS (Already Completed)

These were quick fixes with high impact:
- ✅ Token hashing security (30 min)
- ✅ Attendee validation (30 min)
- ✅ JSON parse error handling (30 min)
- ✅ Type safety in errors (20 min)

**Time Saved**: 1.5 hours of security vulnerabilities eliminated

---

## 📝 NOTES

- All fixes maintain backward compatibility
- No database schema changes required
- Existing APIs continue to work
- New validations are non-breaking
- CSRF tokens can be added transparently to forms

---

## 🚀 POST-FIX TASKS

1. **Add automated security tests**
   - CSRF token validation tests
   - Input injection tests
   - Transaction rollback tests

2. **Add monitoring/logging**
   - Log all validation failures
   - Monitor CSRF rejection rates
   - Track import errors

3. **Documentation**
   - Update API docs with CSRF requirement
   - Document validation rules
   - Add examples for form submissions

4. **Performance check**
   - Ensure extra validation doesn't slow uploads
   - Monitor import operation times
   - Check database query performance

