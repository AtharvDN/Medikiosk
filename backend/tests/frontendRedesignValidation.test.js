import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

describe('MediKiosk Phase 10B Frontend Redesign Validation Suite', () => {
  it('1. Router registers all 5 longitudinal patient screens and bottom nav', () => {
    const routerContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/router.js'), 'utf-8');
    expect(routerContent).toContain('renderPatientDashboardScreen');
    expect(routerContent).toContain('renderPatientHistoryScreen');
    expect(routerContent).toContain('renderPatientRecordsScreen');
    expect(routerContent).toContain('renderPatientSummaryScreen');
    expect(routerContent).toContain('renderPatientProfileScreen');
    expect(routerContent).toContain('patient-bottom-nav');
    expect(routerContent).toContain('patientDashboard');
    expect(routerContent).toContain('patientHistory');
    expect(routerContent).toContain('patientRecords');
    expect(routerContent).toContain('patientSummary');
    expect(routerContent).toContain('patientProfile');
  });

  it('2. Patient Dashboard screen renders primary action and secondary services', () => {
    const dashContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/screens/patientDashboard.js'), 'utf-8');
    expect(dashContent).toContain('renderPatientDashboardScreen');
    expect(dashContent).toContain('btn-record-my-case');
    expect(dashContent).toContain('card-primary-action');
    expect(dashContent).toContain('patient-welcome-banner');
    expect(dashContent).toContain('consultation-card');
    expect(dashContent).toContain('card-patient-history');
    expect(dashContent).toContain('card-patient-records');
    expect(dashContent).toContain('card-patient-summary');
    expect(dashContent).toContain('card-patient-profile');
  });

  it('3. Patient History screen displays separate encounters and detailed modal', () => {
    const histContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/screens/patientHistory.js'), 'utf-8');
    expect(histContent).toContain('renderPatientHistoryScreen');
    expect(histContent).toContain('getPatientHistory');
    expect(histContent).toContain('history-modal');
  });

  it('4. Patient Records screen displays cross-encounter documents and category filtering', () => {
    const recContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/screens/patientRecords.js'), 'utf-8');
    expect(recContent).toContain('renderPatientRecordsScreen');
    expect(recContent).toContain('getPatientDocuments');
    expect(recContent).toContain('filter-all');
    expect(recContent).toContain('filter-prescriptions');
    expect(recContent).toContain('filter-labs');
  });

  it('5. Patient Summary screen implements Digital Health Passport with Zero Fake Data', () => {
    const sumContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/screens/patientSummary.js'), 'utf-8');
    expect(sumContent).toContain('renderPatientSummaryScreen');
    expect(sumContent).toContain('getPatientSummary');
    expect(sumContent).toContain('Not recorded');
    expect(sumContent).toContain('summary-vitals-container');
    expect(sumContent).toContain('summary-allergies-list');
    expect(sumContent).toContain('summary-medications-list');
  });

  it('6. Patient Profile screen implements Personal Information and Consent toggles', () => {
    const profContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/screens/patientProfile.js'), 'utf-8');
    expect(profContent).toContain('renderPatientProfileScreen');
    expect(profContent).toContain('consent-ocr-checkbox');
    expect(profContent).toContain('consent-abdm-checkbox');
    expect(profContent).toContain('btn-save-consent');
    expect(profContent).toContain('btn-exit-kiosk-session');
  });

  it('7. Landing screen renders reference hero layout and dual CTAs', () => {
    const landingContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/screens/landing.js'), 'utf-8');
    expect(landingContent).toContain('renderLandingScreen');
    expect(landingContent).toContain('btn-landing-patient');
    expect(landingContent).toContain('btn-landing-doctor');
    expect(landingContent).toContain('SMART HOSPITAL KIOSK');
    expect(landingContent).toContain('btn-lang-en');
    expect(landingContent).toContain('btn-lang-hi');
    expect(landingContent).toContain('btn-lang-mr');
  });

  it('8. Doctor Workspace implements complete 8-Tab layout matching reference design', () => {
    const wsContent = fs.readFileSync(path.join(FRONTEND_DIR, 'js/doctor/views/workspaceView.js'), 'utf-8');
    expect(wsContent).toContain('renderDoctorWorkspaceView');
    // Tabs verification
    expect(wsContent).toContain("'Overview'");
    expect(wsContent).toContain("'History'");
    expect(wsContent).toContain("'Vitals'");
    expect(wsContent).toContain("'Labs'");
    expect(wsContent).toContain("'Medications'");
    expect(wsContent).toContain("'AYUSH Assessment'");
    expect(wsContent).toContain("'Documents'");
    expect(wsContent).toContain("'Timeline'");
    // Content features verification
    expect(wsContent).toContain('ai-clinical-banner');
    expect(wsContent).toContain('doc-ws-signoff-btn');
    expect(wsContent).toContain('doc-ws-order-labs-btn');
    expect(wsContent).toContain('vitals-grid');
    expect(wsContent).toContain('vital-monitor-box');
    expect(wsContent).toContain('dasha-vidha-grid');
    expect(wsContent).toContain('btn-save-phys-vitals');
  });

  it('9. Design tokens and component classes exist in CSS', () => {
    const varsContent = fs.readFileSync(path.join(FRONTEND_DIR, 'css/variables.css'), 'utf-8');
    const compContent = fs.readFileSync(path.join(FRONTEND_DIR, 'css/components.css'), 'utf-8');

    expect(varsContent).toContain('--color-navy');
    expect(varsContent).toContain('--color-teal');
    expect(varsContent).toContain('--color-sky');

    expect(compContent).toContain('.patient-welcome-banner');
    expect(compContent).toContain('.card-primary-action');
    expect(compContent).toContain('.consultation-card');
    expect(compContent).toContain('.patient-actions-grid');
    expect(compContent).toContain('.dashboard-feature-card');
    expect(compContent).toContain('.patient-bottom-nav');
    expect(compContent).toContain('.vital-monitor-box');
    expect(compContent).toContain('.ai-clinical-banner');
    expect(compContent).toContain('.ayush-assessment-card');
    expect(compContent).toContain('.dasha-vidha-grid');
  });
});
