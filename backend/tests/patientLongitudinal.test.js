import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('MediKiosk Phase 10B Longitudinal Patient Record & Timeline Test Suite', () => {
  let testPatient = null;
  let testEncounter1 = null;
  let testEncounter2 = null;
  let testSession1 = null;
  let testSession2 = null;
  let doctorToken = '';

  beforeAll(async () => {
    await prisma.$connect();

    // 1. Authenticate doctor
    const loginRes = await request(app).post('/api/doctor/auth/login').send({
      employeeId: 'DOC-8942',
      password: 'demoPassword123',
    });
    doctorToken = loginRes.body?.data?.token || '';
    const doctorHospitalId = loginRes.body?.data?.doctor?.hospitalId;

    // 2. Find or create hospital matching doctor scope
    let hospital = null;
    if (doctorHospitalId) {
      hospital = await prisma.hospital.findUnique({ where: { id: doctorHospitalId } });
    }
    if (!hospital) {
      hospital = await prisma.hospital.findFirst();
    }
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: {
          code: 'TEST-HOSP-10B',
          name: 'AIIA Integrative Hospital',
          city: 'New Delhi',
          state: 'Delhi',
        },
      });
    }

    let dept = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          hospitalId: hospital.id,
          code: 'TEST-AYU-10B',
          name: 'Ayurvedic Medicine & Panchakarma',
          opdType: 'AYUSH',
          roomNumber: 'OPD-12',
        },
      });
    }

    // 3. Register a test patient with known medical history
    const uniquePhone = `987${Date.now().toString().slice(-7)}`;
    const regRes = await request(app)
      .post('/api/patients')
      .send({
        fullName: 'Ananya Rao',
        ageYears: 34,
        gender: 'FEMALE',
        phone: uniquePhone,
        abhaId: `ananya.${Date.now()}@abdm`,
        address: 'Delhi NCR Area',
        preferredLanguage: 'MR',
        medicalHistory: ['HYPERTENSION'],
        surgicalHistory: ['APPENDECTOMY_2019'],
        personalHistory: { diet: 'Vegetarian', sleep: 'Irregular' },
      });

    expect(regRes.status).toBe(201);
    testPatient = regRes.body.data;

    // 4. Create Historical Encounter 1 (e.g. 2 months ago: Viral fever)
    testEncounter1 = await prisma.encounter.create({
      data: {
        patientId: testPatient.id,
        hospitalId: hospital.id,
        departmentId: dept.id,
        tokenNumber: 'AYU-T101',
        opdMode: 'AYUSH',
        status: 'COMPLETED',
        triageTier: 'NORMAL',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    });

    testSession1 = await prisma.clinicalSession.create({
      data: {
        encounterId: testEncounter1.id,
        patientId: testPatient.id,
        language: 'mr',
        opdMode: 'AYUSH',
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    });

    // Add complaint fact for encounter 1
    await prisma.clinicalFact.create({
      data: {
        sessionId: testSession1.id,
        concept: 'symptom.fever',
        attribute: 'duration',
        value: '3 days',
        status: 'PRESENT',
        source: 'PATIENT_TOUCH',
      },
    });

    // Add prescription document for encounter 1
    await prisma.medicalDocument.create({
      data: {
        sessionId: testSession1.id,
        fileName: 'ayush_prescription_may.pdf',
        documentType: 'PRESCRIPTION',
        fileSizeBytes: 1240000,
        ocrText: 'Sudarshan Vati 1 tab BD. Paracetamol 500mg SOS.',
        processingStatus: 'PROCESSED',
        confidence: 0.96,
        extractedData: {
          medications: [
            { name: 'Sudarshan Vati', dosage: '1 tab BD' },
            { name: 'Paracetamol', dosage: '500mg SOS' },
          ],
        },
      },
    });

    // 5. Create Current Encounter 2 (Today: Headache)
    testEncounter2 = await prisma.encounter.create({
      data: {
        patientId: testPatient.id,
        hospitalId: hospital.id,
        departmentId: dept.id,
        tokenNumber: 'AYU-T104',
        opdMode: 'AYUSH',
        status: 'WAITING',
        triageTier: 'NORMAL',
        createdAt: new Date(),
      },
    });

    testSession2 = await prisma.clinicalSession.create({
      data: {
        encounterId: testEncounter2.id,
        patientId: testPatient.id,
        language: 'mr',
        opdMode: 'AYUSH',
        status: 'COMPLETED',
        createdAt: new Date(),
      },
    });

    // Add complaint fact for encounter 2 (Headache, separate from old fever!)
    await prisma.clinicalFact.create({
      data: {
        sessionId: testSession2.id,
        concept: 'symptom.pain.head',
        attribute: 'location',
        value: 'head',
        status: 'PRESENT',
        source: 'PATIENT_VOICE',
      },
    });

    // Add lab document for encounter 2
    await prisma.medicalDocument.create({
      data: {
        sessionId: testSession2.id,
        fileName: 'cbc_report_sept.pdf',
        documentType: 'LAB_REPORT',
        fileSizeBytes: 2400000,
        ocrText: 'Complete Blood Count. Haemoglobin: 10.4 g/dL. Platelets: 2.4 Lakhs.',
        processingStatus: 'PROCESSED',
        confidence: 0.98,
        extractedData: {
          investigations: [
            { test: 'Haemoglobin', result: '10.4 g/dL', referenceRange: '12.0 - 15.0', status: 'critical' },
            { test: 'Platelets', result: '2.4 Lakhs', referenceRange: '1.5 - 4.5', status: 'normal' },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testSession1?.id) {
      await prisma.clinicalFact.deleteMany({ where: { sessionId: testSession1.id } });
      await prisma.medicalDocument.deleteMany({ where: { sessionId: testSession1.id } });
      await prisma.clinicalSession.delete({ where: { id: testSession1.id } }).catch(() => {});
    }
    if (testSession2?.id) {
      await prisma.clinicalFact.deleteMany({ where: { sessionId: testSession2.id } });
      await prisma.medicalDocument.deleteMany({ where: { sessionId: testSession2.id } });
      await prisma.clinicalSession.delete({ where: { id: testSession2.id } }).catch(() => {});
    }
    if (testEncounter1?.id) await prisma.encounter.delete({ where: { id: testEncounter1.id } }).catch(() => {});
    if (testEncounter2?.id) await prisma.encounter.delete({ where: { id: testEncounter2.id } }).catch(() => {});
    if (testPatient?.id) await prisma.patient.delete({ where: { id: testPatient.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('1. GET /api/patients/:id/dashboard returns patient profile, active token, and metrics', async () => {
    const res = await request(app).get(`/api/patients/${testPatient.id}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.patient.name).toBe('Ananya Rao');
    expect(data.patient.abha).toContain('@abdm');
    expect(data.upcomingConsultation).toBeDefined();
    expect(data.upcomingConsultation.token).toBe('AYU-T104');
    expect(data.metrics.totalVisits).toBe(2);
    expect(data.metrics.totalDocuments).toBe(2);
  });

  it('2. GET /api/patients/:id/history preserves both encounters without merging symptoms', async () => {
    const res = await request(app).get(`/api/patients/${testPatient.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const history = res.body.data.history;
    expect(history.length).toBe(2);

    // Verify encounter 1 and encounter 2 have separate distinct complaints
    const token104 = history.find(h => h.token === 'AYU-T104');
    const token101 = history.find(h => h.token === 'AYU-T101');

    expect(token104).toBeDefined();
    expect(token101).toBeDefined();

    // Check that historical fever did NOT overwrite current head pain
    expect(token104.chiefComplaint).toContain('HEAD');
    expect(token101.chiefComplaint).toContain('FEVER');
  });

  it('3. GET /api/patients/:id/documents gathers all cross-encounter records', async () => {
    const res = await request(app).get(`/api/patients/${testPatient.id}/documents`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const docs = res.body.data.documents;
    expect(docs.length).toBe(2);

    const prescription = docs.find(d => d.type === 'Prescription');
    const labReport = docs.find(d => d.type === 'Lab Report');

    expect(prescription).toBeDefined();
    expect(labReport).toBeDefined();
    expect(labReport.highlights.some(h => h.includes('Haemoglobin'))).toBe(true);
  });

  it('4. GET /api/patients/:id/summary displays genuine data without fake values', async () => {
    const res = await request(app).get(`/api/patients/${testPatient.id}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const summary = res.body.data;
    expect(summary.patient.name).toBe('Ananya Rao');

    // Unrecorded vitals must be null, not fake static numbers!
    expect(summary.vitals.bp).toBeNull();
    expect(summary.vitals.heartRate).toBeNull();

    // Medications should include extracted Sudarshan Vati
    expect(summary.medications.some(m => m.name.includes('Sudarshan'))).toBe(true);

    // Labs should include real extracted Haemoglobin
    expect(summary.labs.some(l => l.test === 'Haemoglobin')).toBe(true);
  });

  it('5. POST /api/patients/:id/vitals allows recording genuine vitals', async () => {
    const vitalsPayload = {
      bp: '120/80',
      heartRate: '72',
      spo2: '99',
      temp: '98.6',
      respRate: '16',
      weight: '58',
      height: '162',
      bmi: '22.1',
    };

    const res = await request(app).post(`/api/patients/${testPatient.id}/vitals`).send(vitalsPayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify vitals now appear in summary
    const summaryRes = await request(app).get(`/api/patients/${testPatient.id}/summary`);
    expect(summaryRes.body.data.vitals.bp).toBe('120/80');
    expect(summaryRes.body.data.vitals.heartRate).toBe('72');
    expect(summaryRes.body.data.vitals.spo2).toBe('99');
  });

  it('6. GET /api/patients/:id/timeline derives chronological longitudinal events', async () => {
    const res = await request(app).get(`/api/patients/${testPatient.id}/timeline`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const events = res.body.data.events;
    expect(events.length).toBeGreaterThanOrEqual(4);

    // Events must include longitudinal medical history, NOT technical software logs
    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('PAST_SURGERY');
    expect(eventTypes).toContain('CHRONIC_CONDITION');
    expect(eventTypes).toContain('MEDICAL_DOCUMENT');
    expect(eventTypes).toContain('CURRENT_CONSULTATION');
    expect(eventTypes).not.toContain('PATIENT_REGISTERED');

    // Chronological order verification: current consultation first, then descending
    expect(events[0].isCurrent).toBe(true);
  });

  it('7. GET /api/doctor/patients/:id/workspace includes vitals, labs, prior encounters and timeline', async () => {
    const res = await request(app)
      .get(`/api/doctor/patients/${testEncounter2.id}/workspace`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const ws = res.body.data;
    expect(ws.patient.name).toBe('Ananya Rao');
    expect(ws.vitals.bp).toBe('120/80');
    expect(ws.labs.some(l => l.test === 'Haemoglobin')).toBe(true);
    expect(ws.priorEncounters.length).toBeGreaterThanOrEqual(1);
    expect(ws.longitudinalTimeline.length).toBeGreaterThanOrEqual(4);
  });

  it('8. GET /api/doctor/patients/:id/timeline allows physician longitudinal review', async () => {
    const res = await request(app)
      .get(`/api/doctor/patients/${testPatient.id}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events.length).toBeGreaterThanOrEqual(4);
  });
});
