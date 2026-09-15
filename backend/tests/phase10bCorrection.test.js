import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { storageService } from '../src/services/storageService.js';

describe('MediKiosk Phase 10B Corrections & Clinical Workspace Suite', () => {
  let testPatient = null;
  let testEncounter = null;
  let doctorToken = '';
  let uploadedDocId = '';

  beforeAll(async () => {
    await prisma.$connect();

    // 1. Authenticate Doctor
    const loginRes = await request(app).post('/api/doctor/auth/login').send({
      employeeId: 'DOC-8942',
      password: 'demoPassword123',
    });
    doctorToken = loginRes.body?.data?.token || '';

    // 2. Register Patient with authentic history (2015 Appendectomy, 2019 Fracture, 2022 Chronic condition)
    const uniquePhone = `982${Date.now().toString().slice(-7)}`;
    const regRes = await request(app)
      .post('/api/patients')
      .send({
        fullName: 'Vikramaditya Shinde',
        ageYears: 42,
        gender: 'MALE',
        phone: uniquePhone,
        preferredLanguage: 'HI',
        surgicalHistory: [
          { surgeryName: 'Appendectomy', approximateYear: '2015', hospital: 'AIIA Pune', notes: 'Uncomplicated laparoscopic appendectomy' },
        ],
        medicalHistory: [
          { condition: 'Hypertension', approximateYear: '2022', status: 'Managed on Amlodipine', notes: 'Stage 1 essential hypertension' },
        ],
        personalHistory: {
          diet: 'Mixed',
          injuries: [
            { bodySite: 'Right Forearm', approximateYear: '2019', treatmentStatus: 'Plaster cast applied, fully healed' },
          ],
        },
      });

    expect(regRes.status).toBe(201);
    testPatient = regRes.body.data;

    // 3. Create Current OPD Encounter (Presenting Complaint: Acute Knee Pain)
    const doc = await prisma.doctor.findFirst({ where: { registrationNo: 'DOC-8942' }, include: { hospital: true, department: true } });
    const hospital = doc?.hospital || (await prisma.hospital.findFirst({ where: { code: 'HOSP-PUNE-01' } })) || (await prisma.hospital.findFirst());
    const dept = doc?.department || (await prisma.department.findFirst({ where: { hospitalId: hospital.id } })) || (await prisma.department.findFirst());

    testEncounter = await prisma.encounter.create({
      data: {
        patientId: testPatient.id,
        hospitalId: hospital.id,
        departmentId: dept.id,
        tokenNumber: 'GM-P10B',
        opdMode: 'GENERAL',
        status: 'WAITING',
        triageTier: 'NORMAL',
      },
    });

    const sess = await prisma.clinicalSession.create({
      data: {
        encounterId: testEncounter.id,
        patientId: testPatient.id,
        language: 'hi',
        opdMode: 'GENERAL',
        status: 'IN_PROGRESS',
      },
    });

    // Record symptom.pain.knee
    await prisma.clinicalFact.create({
      data: {
        sessionId: sess.id,
        concept: 'symptom.pain.knee',
        attribute: 'location',
        value: 'Right knee joint',
        status: 'PRESENT',
        source: 'PATIENT_TOUCH',
      },
    });
  });

  afterAll(async () => {
    if (uploadedDocId && testPatient) {
      await storageService.deleteDocumentFile(testPatient.id, uploadedDocId);
    }
  });

  it('1. POST /api/patients/:id/documents physically stores original PDF/image on disk', async () => {
    // Minimal 1x1 base64 PNG image
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const uploadRes = await request(app)
      .post(`/api/patients/${testPatient.id}/documents`)
      .send({
        fileName: 'historical_prescription_2018.png',
        mimeType: 'image/png',
        fileBase64: samplePngBase64,
        documentType: 'PRESCRIPTION',
        documentDate: '2018-05-12',
        documentYear: '2018',
        notes: 'Issued by Dr. Sharma for knee strain',
        source: 'PATIENT_UPLOAD',
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.success).toBe(true);
    uploadedDocId = uploadRes.body.data.id;
    expect(uploadedDocId).toBeDefined();

    // Verify physical file exists in storage
    const fileInfo = await storageService.getDocumentFile(testPatient.id, uploadedDocId);
    expect(fileInfo).not.toBeNull();
    expect(fs.existsSync(fileInfo.filePath)).toBe(true);
  });

  it('2. GET /api/documents/:id/file serves original physical file with correct mime type', async () => {
    const fileRes = await request(app).get(`/api/documents/${uploadedDocId}/file`);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers['content-type']).toContain('image/png');
    expect(fileRes.headers['content-disposition']).toContain('inline');
  });

  it('3. GET /api/documents/:id/download serves file with attachment header', async () => {
    const dlRes = await request(app).get(`/api/documents/${uploadedDocId}/download`);
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers['content-disposition']).toContain('attachment');
  });

  it('4. POST /api/doctor/patients/:id/vitals records physician vitals and computes BMI', async () => {
    const vitalsRes = await request(app)
      .post(`/api/doctor/patients/${testEncounter.id}/vitals`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        bp: '128/82',
        heartRate: '76',
        spo2: '99',
        temp: '98.4',
        respRate: '16',
        weight: '70',
        height: '175',
      });

    expect(vitalsRes.status).toBe(200);
    expect(vitalsRes.body.success).toBe(true);
    const vitals = vitalsRes.body.data.vitals;
    expect(vitals.source).toBe('PHYSICIAN');
    expect(vitals.bmi).toBe('22.9'); // 70 / (1.75^2) = 22.857 -> 22.9
  });

  it('5. POST /api/doctor/patients/:id/examination records structured clinical findings', async () => {
    const examRes = await request(app)
      .post(`/api/doctor/patients/${testEncounter.id}/examination`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        general: {
          appearance: 'Alert, ambulating with slight limp on right leg',
          hydration: 'Normal',
          pallor: 'Absent',
          edema: 'Mild localized swelling over right prepatellar area, no generalized edema',
        },
        systemic: {
          musculoskeletal: 'Right knee joint: tenderness over medial joint line, range of motion 0-110 degrees, McMurray negative',
        },
        notes: 'Clinical impression consistent with prepatellar bursitis or minor ligament strain. Advised resting, cold compress, and analgesics.',
        clinicalImpression: 'Right knee soft-tissue strain / bursitis',
      });

    expect(examRes.status).toBe(200);
    expect(examRes.body.success).toBe(true);
    expect(examRes.body.data.examination.notes).toContain('prepatellar bursitis');
  });

  it('6. Consultation workflow transitions correctly: WAITING -> IN_CONSULTATION -> EXAMINATION_IN_PROGRESS -> EXAMINATION_COMPLETED -> REVIEW -> SIGNED_OFF -> COMPLETED', async () => {
    const states = [
      'IN_CONSULTATION',
      'EXAMINATION_IN_PROGRESS',
      'EXAMINATION_COMPLETED',
      'REVIEW',
      'SIGNED_OFF',
      'COMPLETED',
    ];

    for (const st of states) {
      const statusRes = await request(app)
        .post(`/api/doctor/patients/${testEncounter.id}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: st });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe(st);
    }
  });

  it('7. GET /api/doctor/patients/:id/workspace separates relevant past history from today presenting complaint', async () => {
    const wsRes = await request(app)
      .get(`/api/doctor/patients/${testEncounter.id}/workspace`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(wsRes.status).toBe(200);
    const ws = wsRes.body.data;

    // Past history
    expect(ws.relevantPastHistory).toBeDefined();
    expect(ws.relevantPastHistory.surgicalHistory.length).toBeGreaterThanOrEqual(1);
    expect(ws.relevantPastHistory.surgicalHistory[0].surgeryName).toBe('Appendectomy');

    // Current encounter complaint is Knee pain, NOT Appendectomy
    expect(ws.currentEncounter.complaint).toContain('KNEE');
    expect(ws.currentEncounter.complaint).not.toContain('APPENDECTOMY');

    // Physical examination is populated
    expect(ws.physicalExamination).toBeDefined();
    expect(ws.physicalExamination.source).toBe('PHYSICIAN');

    // Timeline only has authentic medical history, NOT technical runtime events
    const timelineTypes = ws.timeline.map((e) => e.type);
    expect(timelineTypes).toContain('PAST_SURGERY');
    expect(timelineTypes).toContain('CHRONIC_CONDITION');
    expect(timelineTypes).toContain('FRACTURE_TRAUMA');
    expect(timelineTypes).toContain('MEDICAL_DOCUMENT');
    expect(timelineTypes).toContain('CURRENT_CONSULTATION');
    expect(timelineTypes).not.toContain('PATIENT_REGISTERED');
    expect(timelineTypes).not.toContain('CLINICAL_INTAKE_COMPLETED');

    // System audit exists separately
    expect(ws.systemAudit).toBeDefined();
    expect(ws.systemAudit.length).toBeGreaterThan(0);
  });
});
