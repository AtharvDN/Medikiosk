/**
 * Encounter Controller — MediKiosk (Phase 10)
 * Manages institutional patient visits, relational verification, and token allocation.
 */

import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Generate formal institutional OPD token (e.g. GM-001, AYU-014, OPD-027)
 */
async function generateOpdToken(hospitalId, department, opdMode) {
  let prefix = 'OPD';
  const deptCode = (department.code || '').toUpperCase();
  const deptType = (department.opdType || opdMode || '').toUpperCase();

  if (deptType === 'AYUSH' || deptCode.includes('AYU')) {
    prefix = 'AYU';
  } else if (deptCode.includes('GEN') || deptCode.includes('MED')) {
    prefix = 'GM';
  } else if (deptCode.includes('ORTH')) {
    prefix = 'ORT';
  } else if (deptCode.includes('PED')) {
    prefix = 'PED';
  }

  // Count encounters created today for this department to sequence tokens cleanly
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await prisma.encounter.count({
    where: {
      hospitalId,
      departmentId: department.id,
      createdAt: { gte: todayStart },
    },
  });

  let seq = todayCount + 1;
  let candidateToken = `${prefix}-${String(seq).padStart(3, '0')}`;

  // Ensure uniqueness
  while (await prisma.encounter.findFirst({ where: { hospitalId, tokenNumber: candidateToken } })) {
    seq++;
    candidateToken = `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  return candidateToken;
}

export const encounterController = {
  /**
   * POST /api/encounters
   * Creates a formal OPD encounter prior to clinical intake.
   */
  async createEncounter(req, res, next) {
    try {
      const {
        patientId,
        hospitalId,
        departmentId,
        doctorId = null,
        opdMode = 'GENERAL',
        visitType = 'WALK_IN',
        triageTier = 'NORMAL',
        priorityReason = null,
      } = req.body;

      if (!patientId) {
        throw new AppError(400, 'patientId is required to create an encounter', 'MISSING_PATIENT_ID');
      }
      if (!hospitalId) {
        throw new AppError(400, 'hospitalId is required to create an encounter', 'MISSING_HOSPITAL_ID');
      }
      if (!departmentId) {
        throw new AppError(400, 'departmentId is required to create an encounter', 'MISSING_DEPARTMENT_ID');
      }

      // Relational Integrity Validation (Section 40)
      const [patient, hospital, department] = await Promise.all([
        prisma.patient.findUnique({ where: { id: patientId } }),
        prisma.hospital.findUnique({ where: { id: hospitalId } }),
        prisma.department.findUnique({ where: { id: departmentId } }),
      ]);

      if (!patient) {
        throw new AppError(404, `Patient not found with ID: ${patientId}`, 'PATIENT_NOT_FOUND');
      }
      if (!hospital) {
        throw new AppError(404, `Hospital not found with ID: ${hospitalId}`, 'HOSPITAL_NOT_FOUND');
      }
      if (!department) {
        throw new AppError(404, `Department not found with ID: ${departmentId}`, 'DEPARTMENT_NOT_FOUND');
      }

      // Validate Department belongs to Hospital
      if (department.hospitalId !== hospital.id) {
        throw new AppError(400, 'Department does not belong to the specified Hospital facility', 'INVALID_DEPARTMENT_HOSPITAL_RELATION');
      }

      // Validate Doctor if provided
      let resolvedDoctor = null;
      if (doctorId) {
        resolvedDoctor = await prisma.doctor.findUnique({
          where: { id: doctorId },
        });

        if (!resolvedDoctor) {
          throw new AppError(404, `Doctor not found with ID: ${doctorId}`, 'DOCTOR_NOT_FOUND');
        }

        // Validate Doctor belongs to Department or Hospital
        if (resolvedDoctor.departmentId && resolvedDoctor.departmentId !== department.id) {
          throw new AppError(400, 'Doctor is not assigned to the selected Department', 'DOCTOR_DEPARTMENT_MISMATCH');
        }
      }

      // Determine effective OPD Mode
      const effectiveOpdMode = department.opdType === 'AYUSH' ? 'AYUSH' : opdMode;

      // Generate institutional token
      const tokenNumber = await generateOpdToken(hospital.id, department, effectiveOpdMode);

      // Create Encounter
      const encounter = await prisma.encounter.create({
        data: {
          patientId: patient.id,
          hospitalId: hospital.id,
          departmentId: department.id,
          attendingDoctorId: resolvedDoctor?.id || null,
          tokenNumber,
          opdMode: effectiveOpdMode,
          visitType,
          status: 'REGISTERED',
          triageTier,
          priorityReason,
        },
        include: {
          patient: true,
          hospital: true,
          department: true,
          attendingDoctor: true,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: encounter.id,
          encounterId: encounter.id,
          tokenNumber: encounter.tokenNumber,
          status: encounter.status,
          opdMode: encounter.opdMode,
          visitType: encounter.visitType,
          triageTier: encounter.triageTier,
          patient: {
            id: encounter.patient.id,
            name: encounter.patient.fullName || `${encounter.patient.firstName} ${encounter.patient.lastName}`.trim(),
            identifier: encounter.patient.patientIdentifier,
          },
          hospital: {
            id: encounter.hospital.id,
            name: encounter.hospital.name,
            code: encounter.hospital.code,
          },
          department: {
            id: encounter.department.id,
            name: encounter.department.name,
            code: encounter.department.code,
            roomNumber: encounter.department.roomNumber,
          },
          attendingDoctor: encounter.attendingDoctor
            ? {
                id: encounter.attendingDoctor.id,
                name: encounter.attendingDoctor.name,
                specialization: encounter.attendingDoctor.specialization,
              }
            : null,
          createdAt: encounter.createdAt,
        },
        message: 'OPD Encounter and token created successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/encounters/:id
   */
  async getEncounter(req, res, next) {
    try {
      const { id } = req.params;

      const encounter = await prisma.encounter.findUnique({
        where: { id },
        include: {
          patient: true,
          hospital: true,
          department: true,
          attendingDoctor: true,
          clinicalSessions: {
            orderBy: { createdAt: 'desc' },
            include: {
              responses: true,
              facts: true,
              documents: true,
            },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
          },
          reviews: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!encounter) {
        throw new AppError(404, 'Encounter not found', 'ENCOUNTER_NOT_FOUND');
      }

      res.status(200).json({
        success: true,
        data: encounter,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/encounters/:id/cancel
   * Patient cancels an uncompleted OPD encounter.
   * Disallows cancellation if IN_CONSULTATION or COMPLETED.
   */
  async cancelEncounter(req, res, next) {
    try {
      const { id } = req.params;

      const encounter = await prisma.encounter.findUnique({
        where: { id },
        include: { patient: true, department: true },
      });

      if (!encounter) {
        throw new AppError(404, 'Encounter not found', 'ENCOUNTER_NOT_FOUND');
      }

      if (encounter.status === 'IN_CONSULTATION' || encounter.status === 'COMPLETED') {
        throw new AppError(400, `Cannot cancel encounter that is already ${encounter.status.replace(/_/g, ' ')}.`, 'CANCELLATION_NOT_ALLOWED');
      }

      if (encounter.status === 'CANCELLED') {
        return res.status(200).json({
          success: true,
          data: encounter,
          message: 'Encounter is already cancelled',
        });
      }

      // Soft cancel
      const updated = await prisma.encounter.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
        include: {
          patient: true,
          department: true,
          hospital: true,
        },
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'OPD encounter cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};
