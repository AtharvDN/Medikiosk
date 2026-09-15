import { Router } from 'express';
import { patientController } from '../controllers/patient.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

import { documentController } from '../controllers/document.controller.js';

export const patientRouter = Router();

// Public / Kiosk Patient Onboarding & Search Endpoints
patientRouter.post('/', patientController.registerOrUpdatePatient);
patientRouter.get('/search', patientController.searchPatients);

// Patient Longitudinal Record & Portal Endpoints (Phase 10B)
patientRouter.get('/:id/dashboard', patientController.getPatientDashboard);
patientRouter.get('/:id/history', patientController.getPatientHistory);
patientRouter.post('/:id/history', patientController.updatePatientHistory);
patientRouter.get('/:id/documents', documentController.getPatientDocuments);
patientRouter.post('/:id/documents', documentController.uploadPatientDocument);
patientRouter.get('/:id/summary', patientController.getPatientSummary);
patientRouter.get('/:id/timeline', patientController.getPatientTimeline);
patientRouter.get('/:id/profile', patientController.getPatientProfile);
patientRouter.post('/:id/vitals', patientController.recordPatientVitals);

// Basic Patient by ID
patientRouter.get('/:id', patientController.getPatientById);

// Protected Patient Dashboard (Legacy Backward Compatibility)
patientRouter.get('/dashboard', authenticateToken, requireRole('PATIENT'), (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Welcome to Patient Dashboard',
      patientId: req.user.patientId,
    },
  });
});
