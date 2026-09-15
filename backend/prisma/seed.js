/**
 * Safe Demo User, Hospital, Department, Doctor, Patient & Encounter Seed Script
 * Phase 10: Connected Institutional Framework (ESM)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding safe institutional database records...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Hospital: District Civil Hospital, Pune
  const hospital = await prisma.hospital.upsert({
    where: { code: 'HOSP-PUNE-01' },
    update: {
      name: 'District Civil Hospital, Pune',
      location: 'Aundh, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      isActive: true,
    },
    create: {
      code: 'HOSP-PUNE-01',
      name: 'District Civil Hospital, Pune',
      location: 'Aundh, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      isActive: true,
    },
  });
  console.log('[Seed] Hospital ready:', hospital.name);

  // 2. Departments
  const generalDept = await prisma.department.upsert({
    where: {
      hospitalId_code: {
        hospitalId: hospital.id,
        code: 'GEN-MED-01',
      },
    },
    update: {
      name: 'General Medicine',
      opdType: 'GENERAL',
      roomNumber: 'OPD Room 3',
      isActive: true,
    },
    create: {
      hospitalId: hospital.id,
      code: 'GEN-MED-01',
      name: 'General Medicine',
      opdType: 'GENERAL',
      roomNumber: 'OPD Room 3',
      isActive: true,
    },
  });

  const ayushDept = await prisma.department.upsert({
    where: {
      hospitalId_code: {
        hospitalId: hospital.id,
        code: 'AYU-KAYA-01',
      },
    },
    update: {
      name: 'Ayurvedic OPD / Kayachikitsa',
      opdType: 'AYUSH',
      roomNumber: 'OPD Room 7',
      isActive: true,
    },
    create: {
      hospitalId: hospital.id,
      code: 'AYU-KAYA-01',
      name: 'Ayurvedic OPD / Kayachikitsa',
      opdType: 'AYUSH',
      roomNumber: 'OPD Room 7',
      isActive: true,
    },
  });

  const orthoDept = await prisma.department.upsert({
    where: {
      hospitalId_code: {
        hospitalId: hospital.id,
        code: 'ORTHO-01',
      },
    },
    update: {
      name: 'Orthopaedics OPD',
      opdType: 'SPECIALTY',
      roomNumber: 'OPD Room 12',
      isActive: true,
    },
    create: {
      hospitalId: hospital.id,
      code: 'ORTHO-01',
      name: 'Orthopaedics OPD',
      opdType: 'SPECIALTY',
      roomNumber: 'OPD Room 12',
      isActive: true,
    },
  });

  const pediatricsDept = await prisma.department.upsert({
    where: {
      hospitalId_code: {
        hospitalId: hospital.id,
        code: 'PEDI-01',
      },
    },
    update: {
      name: 'Pediatrics OPD',
      opdType: 'SPECIALTY',
      roomNumber: 'OPD Room 5',
      isActive: true,
    },
    create: {
      hospitalId: hospital.id,
      code: 'PEDI-01',
      name: 'Pediatrics OPD',
      opdType: 'SPECIALTY',
      roomNumber: 'OPD Room 5',
      isActive: true,
    },
  });
  console.log('[Seed] Departments ready: General Medicine, AYUSH, Orthopaedics, Pediatrics');

  // 3. Doctor 1: Dr. Priya Deshmukh (General Medicine)
  const doctorUser1 = await prisma.user.upsert({
    where: { email: 'doctor@medikiosk.local' },
    update: {},
    create: {
      email: 'doctor@medikiosk.local',
      passwordHash,
      role: 'DOCTOR',
    },
  });

  const doctor1 = await prisma.doctor.upsert({
    where: { userId: doctorUser1.id },
    update: {
      hospitalId: hospital.id,
      departmentId: generalDept.id,
      name: 'Dr. Priya Deshmukh',
      specialization: 'General Medicine',
      qualification: 'MBBS, MD (General Medicine)',
      registrationNo: 'DOC-8942',
      roomNumber: 'OPD Room 3',
      isActive: true,
    },
    create: {
      userId: doctorUser1.id,
      hospitalId: hospital.id,
      departmentId: generalDept.id,
      name: 'Dr. Priya Deshmukh',
      specialization: 'General Medicine',
      qualification: 'MBBS, MD (General Medicine)',
      registrationNo: 'DOC-8942',
      roomNumber: 'OPD Room 3',
      isActive: true,
    },
  });
  console.log('[Seed] Doctor 1 ready:', doctor1.name);

  // 4. Doctor 2: Dr. Rajendra Joshi (AYUSH / Kayachikitsa)
  const doctorUser2 = await prisma.user.upsert({
    where: { email: 'ayush.doctor@medikiosk.local' },
    update: {},
    create: {
      email: 'ayush.doctor@medikiosk.local',
      passwordHash,
      role: 'DOCTOR',
    },
  });

  const doctor2 = await prisma.doctor.upsert({
    where: { userId: doctorUser2.id },
    update: {
      hospitalId: hospital.id,
      departmentId: ayushDept.id,
      name: 'Dr. Rajendra Joshi',
      specialization: 'Kayachikitsa / Ayurveda',
      qualification: 'BAMS, MD (Ayurveda - Kayachikitsa)',
      registrationNo: 'DOC-AYUSH-01',
      roomNumber: 'OPD Room 7',
      isActive: true,
    },
    create: {
      userId: doctorUser2.id,
      hospitalId: hospital.id,
      departmentId: ayushDept.id,
      name: 'Dr. Rajendra Joshi',
      specialization: 'Kayachikitsa / Ayurveda',
      qualification: 'BAMS, MD (Ayurveda - Kayachikitsa)',
      registrationNo: 'DOC-AYUSH-01',
      roomNumber: 'OPD Room 7',
      isActive: true,
    },
  });
  console.log('[Seed] Doctor 2 ready:', doctor2.name);

  // 5. Doctor 3: Dr. Neha Kulkarni (Pediatrics)
  const doctorUser3 = await prisma.user.upsert({
    where: { email: 'pedi.doctor@medikiosk.local' },
    update: {},
    create: {
      email: 'pedi.doctor@medikiosk.local',
      passwordHash,
      role: 'DOCTOR',
    },
  });

  const doctor3 = await prisma.doctor.upsert({
    where: { userId: doctorUser3.id },
    update: {
      hospitalId: hospital.id,
      departmentId: pediatricsDept.id,
      name: 'Dr. Neha Kulkarni',
      specialization: 'Pediatrics',
      qualification: 'MBBS, MD (Pediatrics), DCH',
      registrationNo: 'DOC-PEDI-01',
      roomNumber: 'OPD Room 5',
      isActive: true,
    },
    create: {
      userId: doctorUser3.id,
      hospitalId: hospital.id,
      departmentId: pediatricsDept.id,
      name: 'Dr. Neha Kulkarni',
      specialization: 'Pediatrics',
      qualification: 'MBBS, MD (Pediatrics), DCH',
      registrationNo: 'DOC-PEDI-01',
      roomNumber: 'OPD Room 5',
      isActive: true,
    },
  });
  console.log('[Seed] Doctor 3 ready:', doctor3.name);

  // 6. Doctor 4: Dr. Arjun Patil (Orthopaedics)
  const doctorUser4 = await prisma.user.upsert({
    where: { email: 'ortho.doctor@medikiosk.local' },
    update: {},
    create: {
      email: 'ortho.doctor@medikiosk.local',
      passwordHash,
      role: 'DOCTOR',
    },
  });

  const doctor4 = await prisma.doctor.upsert({
    where: { userId: doctorUser4.id },
    update: {
      hospitalId: hospital.id,
      departmentId: orthoDept.id,
      name: 'Dr. Arjun Patil',
      specialization: 'Orthopaedics',
      qualification: 'MBBS, MS (Orthopaedics)',
      registrationNo: 'DOC-ORTHO-01',
      roomNumber: 'OPD Room 12',
      isActive: true,
    },
    create: {
      userId: doctorUser4.id,
      hospitalId: hospital.id,
      departmentId: orthoDept.id,
      name: 'Dr. Arjun Patil',
      specialization: 'Orthopaedics',
      qualification: 'MBBS, MS (Orthopaedics)',
      registrationNo: 'DOC-ORTHO-01',
      roomNumber: 'OPD Room 12',
      isActive: true,
    },
  });
  console.log('[Seed] Doctor 4 ready:', doctor4.name);

  // 7. Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@medikiosk.local' },
    update: {},
    create: {
      email: 'admin@medikiosk.local',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('[Seed] Admin user ready:', adminUser.email);

  // 8. Demo Seed Patient 1 (Aarav Sharma - General Medicine Case)
  const demoPatient1 = await prisma.patient.upsert({
    where: { patientIdentifier: 'DEMO-PAT-001' },
    update: {
      fullName: 'Aarav Sharma',
      ageYears: 42,
      gender: 'MALE',
      hospitalUhid: 'UHID-2026-001',
      phone: '+919876543210',
      preferredLanguage: 'MR',
    },
    create: {
      patientIdentifier: 'DEMO-PAT-001',
      firstName: 'Aarav',
      lastName: 'Sharma',
      fullName: 'Aarav Sharma',
      dateOfBirth: new Date('1984-05-15'),
      ageYears: 42,
      gender: 'MALE',
      phone: '+919876543210',
      hospitalUhid: 'UHID-2026-001',
      preferredLanguage: 'MR',
      medicalHistory: ['Hypertension', 'Type 2 Diabetes'],
      surgicalHistory: ['Appendectomy (2018)'],
      familyHistory: 'Father had heart disease',
    },
  });

  // Demo Encounter 1: Assigned to Dr. Priya Deshmukh (General Medicine)
  const demoEncounter1 = await prisma.encounter.upsert({
    where: { id: 'demo-enc-gm-001' },
    update: { attendingDoctorId: doctor1.id },
    create: {
      id: 'demo-enc-gm-001',
      patientId: demoPatient1.id,
      hospitalId: hospital.id,
      departmentId: generalDept.id,
      attendingDoctorId: doctor1.id,
      tokenNumber: 'GM-001',
      opdMode: 'GENERAL',
      visitType: 'WALK_IN',
      status: 'WAITING',
      triageTier: 'NORMAL',
    },
  });

  // Demo Patient 2: AYUSH Case (Meera Joshi) -> Dr. Rajendra Joshi
  const demoPatient2 = await prisma.patient.upsert({
    where: { patientIdentifier: 'DEMO-PAT-002' },
    update: {
      fullName: 'Meera Joshi',
      ageYears: 38,
      gender: 'FEMALE',
      hospitalUhid: 'UHID-2026-002',
      phone: '+919876543211',
      preferredLanguage: 'MR',
    },
    create: {
      patientIdentifier: 'DEMO-PAT-002',
      firstName: 'Meera',
      lastName: 'Joshi',
      fullName: 'Meera Joshi',
      dateOfBirth: new Date('1988-08-20'),
      ageYears: 38,
      gender: 'FEMALE',
      phone: '+919876543211',
      hospitalUhid: 'UHID-2026-002',
      preferredLanguage: 'MR',
      medicalHistory: ['Chronic Acidity', 'Mild Vata imbalance'],
    },
  });

  const demoEncounter2 = await prisma.encounter.upsert({
    where: { id: 'demo-enc-ayu-001' },
    update: { attendingDoctorId: doctor2.id },
    create: {
      id: 'demo-enc-ayu-001',
      patientId: demoPatient2.id,
      hospitalId: hospital.id,
      departmentId: ayushDept.id,
      attendingDoctorId: doctor2.id,
      tokenNumber: 'AYU-001',
      opdMode: 'AYUSH',
      visitType: 'WALK_IN',
      status: 'WAITING',
      triageTier: 'NORMAL',
    },
  });

  // Demo Patient 3: Pediatric Case (Master Aryan More) -> Dr. Neha Kulkarni
  const demoPatient3 = await prisma.patient.upsert({
    where: { patientIdentifier: 'DEMO-PAT-003' },
    update: {
      fullName: 'Master Aryan More',
      ageYears: 6,
      gender: 'MALE',
      hospitalUhid: 'UHID-2026-003',
      phone: '+919876543212',
      preferredLanguage: 'MR',
    },
    create: {
      patientIdentifier: 'DEMO-PAT-003',
      firstName: 'Aryan',
      lastName: 'More',
      fullName: 'Master Aryan More',
      dateOfBirth: new Date('2020-03-10'),
      ageYears: 6,
      gender: 'MALE',
      phone: '+919876543212',
      hospitalUhid: 'UHID-2026-003',
      preferredLanguage: 'MR',
      medicalHistory: [],
    },
  });

  const demoEncounter3 = await prisma.encounter.upsert({
    where: { id: 'demo-enc-pedi-001' },
    update: { attendingDoctorId: doctor3.id },
    create: {
      id: 'demo-enc-pedi-001',
      patientId: demoPatient3.id,
      hospitalId: hospital.id,
      departmentId: pediatricsDept.id,
      attendingDoctorId: doctor3.id,
      tokenNumber: 'PED-001',
      opdMode: 'SPECIALTY',
      visitType: 'WALK_IN',
      status: 'WAITING',
      triageTier: 'NORMAL',
    },
  });

  // Demo Patient 4: Orthopaedics Case (Suresh Kadam - Knee Injury) -> Dr. Arjun Patil
  const demoPatient4 = await prisma.patient.upsert({
    where: { patientIdentifier: 'DEMO-PAT-004' },
    update: {
      fullName: 'Suresh Kadam',
      ageYears: 54,
      gender: 'MALE',
      hospitalUhid: 'UHID-2026-004',
      phone: '+919876543213',
      preferredLanguage: 'MR',
    },
    create: {
      patientIdentifier: 'DEMO-PAT-004',
      firstName: 'Suresh',
      lastName: 'Kadam',
      fullName: 'Suresh Kadam',
      dateOfBirth: new Date('1972-11-12'),
      ageYears: 54,
      gender: 'MALE',
      phone: '+919876543213',
      hospitalUhid: 'UHID-2026-004',
      preferredLanguage: 'MR',
      medicalHistory: ['Right Knee Osteoarthritis'],
    },
  });

  const demoEncounter4 = await prisma.encounter.upsert({
    where: { id: 'demo-enc-ortho-001' },
    update: { attendingDoctorId: doctor4.id },
    create: {
      id: 'demo-enc-ortho-001',
      patientId: demoPatient4.id,
      hospitalId: hospital.id,
      departmentId: orthoDept.id,
      attendingDoctorId: doctor4.id,
      tokenNumber: 'ORT-001',
      opdMode: 'SPECIALTY',
      visitType: 'WALK_IN',
      status: 'WAITING',
      triageTier: 'NORMAL',
    },
  });

  console.log('[Seed] Demo Encounters ready: GM-001, AYU-001, PED-001, ORT-001');
  console.log('[Seed] Institutional seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed] Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
