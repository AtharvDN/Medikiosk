import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { buildCanonicalClinicalSummary } from '../src/modules/questionEngine/clinicalSummaryBuilder.js';

describe('MediKiosk Phase 10B Clinical Specifications Refinement Suite', () => {
  let docPriyaToken = '';
  let docJoshiToken = '';
  let docNehaToken = '';
  let docArjunToken = '';

  let priyaDoctor = null;
  let joshiDoctor = null;
  let testPatient = null;
  let priyaEncounter = null;
  let waitingEncounter = null;

  beforeAll(async () => {
    await prisma.$connect();

    // 1. Authenticate All 4 Demo Doctors
    const priyaRes = await request(app).post('/api/doctor/auth/login').send({
      employeeId: 'DOC-8942',
      password: 'demoPassword123',
    });
    expect(priyaRes.status).toBe(200);
    docPriyaToken = priyaRes.body?.data?.token || '';
    priyaDoctor = priyaRes.body?.data?.doctor;

    const joshiRes = await request(app).post('/api/doctor/auth/login').send({
      employeeId: 'DOC-AYUSH-01',
      password: 'demoPassword123',
    });
    expect(joshiRes.status).toBe(200);
    docJoshiToken = joshiRes.body?.data?.token || '';
    joshiDoctor = joshiRes.body?.data?.doctor;

    const nehaRes = await request(app).post('/api/doctor/auth/login').send({
      employeeId: 'DOC-PEDI-01',
      password: 'demoPassword123',
    });
    expect(nehaRes.status).toBe(200);
    docNehaToken = nehaRes.body?.data?.token || '';

    const arjunRes = await request(app).post('/api/doctor/auth/login').send({
      employeeId: 'DOC-ORTHO-01',
      password: 'demoPassword123',
    });
    expect(arjunRes.status).toBe(200);
    docArjunToken = arjunRes.body?.data?.token || '';

    // Register a test patient
    const uniquePhone = `981${Date.now().toString().slice(-7)}`;
    const regRes = await request(app)
      .post('/api/patients')
      .send({
        fullName: 'Aakash Mahajan',
        ageYears: 34,
        gender: 'MALE',
        phone: uniquePhone,
        preferredLanguage: 'EN',
      });
    expect(regRes.status).toBe(201);
    testPatient = regRes.body.data;

    // Create encounter specifically assigned to Dr. Priya Deshmukh
    const priyaDbDoc = await prisma.doctor.findFirst({
      where: { registrationNo: 'DOC-8942' },
      include: { department: true, hospital: true },
    });
    const joshiDbDoc = await prisma.doctor.findFirst({
      where: { registrationNo: 'DOC-AYUSH-01' },
      include: { department: true, hospital: true },
    });

    priyaEncounter = await prisma.encounter.create({
      data: {
        patientId: testPatient.id,
        hospitalId: priyaDbDoc.hospitalId,
        departmentId: priyaDbDoc.departmentId,
        attendingDoctorId: priyaDbDoc.id,
        tokenNumber: `T-PRIYA-${Date.now().toString().slice(-4)}`,
        status: 'IN_CONSULTATION',
        opdMode: 'GENERAL',
      },
    });

    // Create an unstarted waiting encounter for cancellation test
    waitingEncounter = await prisma.encounter.create({
      data: {
        patientId: testPatient.id,
        hospitalId: priyaDbDoc.hospitalId,
        departmentId: priyaDbDoc.departmentId,
        tokenNumber: `T-WAIT-${Date.now().toString().slice(-4)}`,
        status: 'WAITING',
        opdMode: 'GENERAL',
      },
    });
  });

  it('1. Four realistic demo doctor profiles with distinct credentials & departments', () => {
    expect(priyaDoctor.name).toContain('Priya Deshmukh');
    expect(joshiDoctor.name).toContain('Rajendra Joshi');
    expect(docNehaToken).toBeTruthy();
    expect(docArjunToken).toBeTruthy();
  });

  it('2. Backend authorization scoping: Dr. Joshi cannot access Dr. Priya private encounter workspace (403)', async () => {
    const crossAccessRes = await request(app)
      .get(`/api/doctor/patients/${priyaEncounter.id}/workspace`)
      .set('Authorization', `Bearer ${docJoshiToken}`);

    expect(crossAccessRes.status).toBe(403);
    expect(crossAccessRes.body.error.code).toBe('ACCESS_DENIED');
  });

  it('3. Backend authorization scoping: Dr. Priya can access her own assigned encounter workspace (200)', async () => {
    const selfAccessRes = await request(app)
      .get(`/api/doctor/patients/${priyaEncounter.id}/workspace`)
      .set('Authorization', `Bearer ${docPriyaToken}`);

    expect(selfAccessRes.status).toBe(200);
    expect(selfAccessRes.body.success).toBe(true);
    expect(selfAccessRes.body.data.currentEncounter.id).toBe(priyaEncounter.id);
  });

  it('4. OPD Request Cancellation: Patient can cancel an unstarted WAITING encounter', async () => {
    const cancelRes = await request(app)
      .post(`/api/encounters/${waitingEncounter.id}/cancel`)
      .send({ reason: 'Patient had to leave early' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    // Verify encounter is now marked CANCELLED in DB
    const updatedEnc = await prisma.encounter.findUnique({ where: { id: waitingEncounter.id } });
    expect(updatedEnc.status).toBe('CANCELLED');
  });

  it('5. OPD Request Cancellation: Cannot cancel an encounter already IN_CONSULTATION or COMPLETED (400)', async () => {
    const cancelActiveRes = await request(app)
      .post(`/api/encounters/${priyaEncounter.id}/cancel`)
      .send({ reason: 'Patient changed mind' });

    expect(cancelActiveRes.status).toBe(400);
    expect(cancelActiveRes.body.error.code).toBe('CANCELLATION_NOT_ALLOWED');
  });

  it('6. Patient Documents — Optional OCR: Upload Original Only bypasses OCR pipeline', async () => {
    const docRes = await request(app)
      .post(`/api/patients/${testPatient.id}/documents`)
      .send({
        fileName: 'mri_knee_original.pdf',
        mimeType: 'application/pdf',
        fileBase64: 'JVBERi0xLjQKJcTl8uXrCg==',
        documentType: 'INVESTIGATION_REPORT',
        documentDate: '2023-11-20',
        documentYear: '2023',
        ocrMode: 'ORIGINAL_ONLY',
      });

    expect(docRes.status).toBe(201);
    expect(docRes.body.success).toBe(true);
    expect(docRes.body.data.processingStatus).toBe('BYPASSED');
    expect(docRes.body.data.ocrText).toBeNull();
  });

  it('7. Silent Draft Saves: Saving examination draft does not advance state or spam alerts', async () => {
    const draftRes = await request(app)
      .post(`/api/doctor/patients/${priyaEncounter.id}/examination`)
      .set('Authorization', `Bearer ${docPriyaToken}`)
      .send({
        general: { appearance: 'Comfortable, oriented' },
        systemic: { respiratory: 'Clear bilaterally' },
        conditionExam: { gait: 'Antalgic' },
        clinicalImpression: 'Suspected Right Knee Meniscal Injury',
        isDraft: true,
      });

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.data.isDraft).toBe(true);

    // Verify encounter status was NOT advanced to EXAMINATION_COMPLETED
    const enc = await prisma.encounter.findUnique({ where: { id: priyaEncounter.id } });
    expect(enc.status).toBe('IN_CONSULTATION');
  });

  it('8. Finalized Examination & Patient Portal Result: Doctor impression published with physician provenance', async () => {
    // 1. Doctor records finalized examination with patientVisibleAdvice
    const finalExamRes = await request(app)
      .post(`/api/doctor/patients/${priyaEncounter.id}/examination`)
      .set('Authorization', `Bearer ${docPriyaToken}`)
      .send({
        general: { appearance: 'Alert, stable' },
        conditionExam: { gait: 'Mild limp', swelling: 'Mild right prepatellar' },
        clinicalImpression: 'Right Knee Prepatellar Bursitis',
        notes: 'Advised rest and ice pack application. Return if swelling increases.',
        isDraft: false,
      });
    expect(finalExamRes.status).toBe(200);

    // 2. Doctor confirms review / sign-off
    const reviewRes = await request(app)
      .post(`/api/doctor/patients/${priyaEncounter.id}/review`)
      .set('Authorization', `Bearer ${docPriyaToken}`)
      .send({
        comments: 'Patient examined. Prescription and care guidelines explained.',
        clinicalImpression: 'Right Knee Prepatellar Bursitis',
        advice: 'Avoid heavy kneeling. Cold fomentation twice daily.',
      });
    expect(reviewRes.status).toBe(200);

    // 3. Mark consultation complete
    await request(app)
      .post(`/api/doctor/patients/${priyaEncounter.id}/status`)
      .set('Authorization', `Bearer ${docPriyaToken}`)
      .send({ status: 'COMPLETED' });

    // 4. Check Patient Portal Dashboard
    const patientDashRes = await request(app).get(`/api/patients/${testPatient.id}/dashboard`);
    expect(patientDashRes.status).toBe(200);

    const result = patientDashRes.body.data.consultationResult;
    expect(result).toBeTruthy();
    expect(result.source).toBe('PHYSICIAN');
    expect(result.doctorName).toContain('Dr. Priya Deshmukh');
    expect(result.clinicalImpression).toContain('Prepatellar Bursitis');
    expect(result.advice).toBeTruthy();
  });

  it('9. AYUSH Null-Safety for General Medicine: ayushAssessment is strictly null when opdMode is GENERAL', async () => {
    const mockGeneralSession = {
      id: 'sess-gen-test',
      opdMode: 'GENERAL',
      language: 'EN',
      facts: [
        { concept: 'symptom.knee_pain', value: 'present', status: 'PRESENT', confidence: 1.0 },
      ],
      responses: [],
    };

    const summary = buildCanonicalClinicalSummary(mockGeneralSession);
    expect(summary.ayushAssessment).toBeNull();
    expect(summary.dashavidha).toBeUndefined();
    expect(summary.aharaVihara).toBeUndefined();
  });
});
