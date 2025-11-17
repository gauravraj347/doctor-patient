# Pearl API - Quick Testing Guide

This guide provides step-by-step instructions to test all API endpoints using Postman.

---

## Setup

1. **Start the server**:
```bash
npm run start:dev
```

2. **Ensure PostgreSQL is running** with database `doctor-patient`

3. **Base URL**: `http://localhost:3000/api/v1`

---

## Quick Test Scenarios

### Scenario 1: Complete Patient Journey

#### Step 1: Patient Signup
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient1@test.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "patient",
    "phone": "+1234567890",
    "dateOfBirth": "1990-01-15",
    "address": "123 Main St"
  }'
```

**Expected Response**: 
- Status: 201
- Message: "Signup successful. Please verify your email with the OTP sent."
- **Check console logs for OTP code**

#### Step 2: Verify OTP
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient1@test.com",
    "otp": "REPLACE_WITH_OTP_FROM_CONSOLE"
  }'
```

**Expected Response**:
- Status: 200
- Returns: user object, accessToken, refreshToken
- **Save the accessToken for next requests**

#### Step 3: Search for Doctors
```bash
curl -X GET "http://localhost:3000/api/v1/doctors?available=true"
```

**Expected Response**:
- Status: 200
- Returns: Array of available doctors
- **Save a doctorId for booking**

#### Step 4: Check Doctor's Available Slots
```bash
curl -X GET "http://localhost:3000/api/v1/doctors/DOCTOR_ID_HERE/available-slots?date=2025-11-20"
```

**Expected Response**:
- Status: 200
- Returns: Available slots for the date
- **Save a slotId (for wave) or note the schedule type**

#### Step 5: Book Appointment
```bash
curl -X POST http://localhost:3000/api/v1/appointments/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PATIENT_TOKEN" \
  -d '{
    "doctorId": "DOCTOR_ID_HERE",
    "patientId": "YOUR_PATIENT_ID",
    "slotId": "SLOT_ID_HERE",
    "appointmentDate": "2025-11-20"
  }'
```

**Expected Response**:
- Status: 201
- Message: "Appointment confirmed successfully"
- Returns: appointment details with token number

#### Step 6: View My Appointments
```bash
curl -X GET http://localhost:3000/api/v1/appointments/my-appointments \
  -H "Authorization: Bearer YOUR_PATIENT_TOKEN"
```

**Expected Response**:
- Status: 200
- Returns: Array of your appointments

#### Step 7: Cancel Appointment
```bash
curl -X POST http://localhost:3000/api/v1/appointments/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PATIENT_TOKEN" \
  -d '{
    "appointmentId": "APPOINTMENT_ID_HERE",
    "reason": "Testing cancellation"
  }'
```

**Expected Response**:
- Status: 200
- Message: "Appointment cancelled successfully"

---

### Scenario 2: Complete Doctor Journey

#### Step 1: Doctor Signup
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor1@test.com",
    "password": "password123",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "doctor",
    "phone": "+1234567890",
    "specialization": "Cardiology",
    "licenseNumber": "MD12345"
  }'
```

**Check console for OTP**

#### Step 2: Verify OTP
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor1@test.com",
    "otp": "REPLACE_WITH_OTP_FROM_CONSOLE"
  }'
```

**Save the doctorToken and doctorId**

#### Step 3: Create Schedule (Wave Type)
```bash
curl -X POST http://localhost:3000/api/v1/doctors/me/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -d '{
    "scheduleType": "wave",
    "consultingStartTime": "09:00:00",
    "consultingEndTime": "17:00:00",
    "slotDuration": 30,
    "capacityPerSlot": 5
  }'
```

**Expected Response**:
- Status: 201
- Returns: Created schedule details

#### Step 4: Create Time Slots (Bulk)
```bash
curl -X POST http://localhost:3000/api/v1/doctors/me/time-slots/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -d '[
    {
      "weekday": "monday",
      "startTime": "09:00:00",
      "endTime": "09:30:00",
      "isAvailable": true
    },
    {
      "weekday": "monday",
      "startTime": "09:30:00",
      "endTime": "10:00:00",
      "isAvailable": true
    },
    {
      "weekday": "monday",
      "startTime": "10:00:00",
      "endTime": "10:30:00",
      "isAvailable": true
    },
    {
      "weekday": "tuesday",
      "startTime": "09:00:00",
      "endTime": "09:30:00",
      "isAvailable": true
    }
  ]'
```

**Expected Response**:
- Status: 201
- Returns: Array of created time slots

#### Step 5: View My Profile
```bash
curl -X GET http://localhost:3000/api/v1/doctors/me/profile \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN"
```

**Expected Response**:
- Status: 200
- Returns: Complete doctor profile with schedule and time slots

#### Step 6: Update Profile
```bash
curl -X PUT http://localhost:3000/api/v1/doctors/me/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -d '{
    "specialization": "Cardiology & Internal Medicine",
    "address": "456 New Medical Center, Downtown"
  }'
```

**Expected Response**:
- Status: 200
- Returns: Updated doctor profile

#### Step 7: View My Time Slots
```bash
curl -X GET http://localhost:3000/api/v1/doctors/me/time-slots \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN"
```

**Expected Response**:
- Status: 200
- Returns: Array of all time slots

#### Step 8: Update Time Slot Availability
```bash
curl -X PUT http://localhost:3000/api/v1/doctors/me/time-slots/SLOT_ID_HERE \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -d '{
    "isAvailable": false
  }'
```

**Expected Response**:
- Status: 200
- Returns: Updated time slot

---

### Scenario 3: Stream Scheduling

#### Step 1: Doctor Creates Stream Schedule
```bash
curl -X POST http://localhost:3000/api/v1/doctors/me/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -d '{
    "scheduleType": "stream",
    "consultingStartTime": "09:00:00",
    "consultingEndTime": "17:00:00",
    "totalCapacity": 50
  }'
```

**Expected Response**:
- Status: 201
- Returns: Stream schedule (no time slots needed)

#### Step 2: Patient Books Stream Appointment
```bash
curl -X POST http://localhost:3000/api/v1/appointments/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PATIENT_TOKEN" \
  -d '{
    "doctorId": "DOCTOR_ID_HERE",
    "patientId": "YOUR_PATIENT_ID",
    "appointmentDate": "2025-11-20"
  }'
```

**Note**: No slotId needed for stream scheduling

**Expected Response**:
- Status: 201
- Returns: Appointment with auto-calculated reporting time


## Validation Rules

### Email
- Must be valid email format
- Must be unique

### Password
- Minimum 6 characters

### Phone
- Optional but recommended
- Any format accepted

### Time Format
- Must be HH:MM:SS (24-hour format)
- Example: "09:00:00", "17:30:00"

### Date Format
- Must be YYYY-MM-DD
- Example: "2025-11-20"

### Weekday
- Lowercase: monday, tuesday, wednesday, thursday, friday, saturday, sunday

### Role
- Lowercase: patient, doctor

### Schedule Type
- Lowercase: wave, stream


### OTP Generation
```
============================================================
[OTP GENERATED] 2025-11-17T10:00:00.000Z
Email: patient1@test.com
OTP Code: 123456
Expires At: 2025-11-17T10:10:00.000Z
============================================================
```



**Thanks**
