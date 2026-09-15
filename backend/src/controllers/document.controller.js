/**
 * Medical Document Controller (Phase 7 & Phase 10B)
 * Handles physical document storage, OCR processing, clinical information extraction,
 * metadata persistence, and controlled file viewing/downloading.
 */

import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { ocrService } from '../modules/document/ocrService.js';
import { documentExtractionService } from '../modules/document/documentExtractionService.js';
import { storageService } from '../services/storageService.js';
import { AppError } from '../middleware/errorHandler.js';

export const documentController = {
  /**
   * POST /api/patients/:patientId/documents
   * Ingests a historical or new patient document, stores original file on disk,
   * runs OCR, extracts entities, and saves metadata.
   */
  async uploadPatientDocument(req, res, next) {
    try {
      const patientId = req.params.patientId || req.params.id;
      const {
        fileBase64,
        fileName = 'document.pdf',
        mimeType = 'application/pdf',
        fileSizeBytes = 0,
        documentType = 'OTHER',
        documentDate = null,
        documentYear = null,
        notes = '',
        source = 'PATIENT_UPLOAD',
        ocrMode = 'ANALYZE', // 'ANALYZE' | 'ORIGINAL_ONLY'
        bypassOcr = false,
      } = req.body;

      if (!fileBase64) {
        throw new AppError(400, 'File content (base64) is required', 'MISSING_FILE_DATA');
      }

      const isOriginalOnly = ocrMode === 'ORIGINAL_ONLY' || Boolean(bypassOcr);

      // 1. Verify patient exists
      const patient = await prisma.patient.findFirst({
        where: {
          OR: [
            { id: patientId },
            { patientIdentifier: patientId },
            { hospitalUhid: patientId },
            { abhaId: patientId },
            { phone: patientId },
          ],
        },
        include: {
          encounters: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { clinicalSessions: true },
          },
          clinicalSessions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!patient) {
        throw new AppError(404, 'Patient not found', 'PATIENT_NOT_FOUND');
      }

      // 2. Find or create an active clinical session for foreign key
      let sessionId = null;
      let encounterId = null;

      if (patient.encounters?.[0]?.clinicalSessions?.[0]) {
        sessionId = patient.encounters[0].clinicalSessions[0].id;
        encounterId = patient.encounters[0].id;
      } else if (patient.clinicalSessions?.[0]) {
        sessionId = patient.clinicalSessions[0].id;
      } else {
        const newSession = await prisma.clinicalSession.create({
          data: {
            patientId: patient.id,
            language: patient.preferredLanguage?.toLowerCase() || 'hi',
            opdMode: 'GENERAL',
            status: 'IN_PROGRESS',
          },
        });
        sessionId = newSession.id;
      }

      const documentId = crypto.randomUUID();

      // 3. Persist original physical file on local private disk
      const storageResult = await storageService.saveDocumentFile({
        patientId: patient.id,
        documentId,
        fileName,
        fileBase64,
      });

      // 4. Perform OCR layout and raw text extraction only if not ORIGINAL_ONLY
      let ocrText = null;
      let ocrConfidence = 1.0;
      let extractedInfo = {};
      let processingStatus = isOriginalOnly ? 'BYPASSED' : 'PROCESSED';

      if (!isOriginalOnly) {
        try {
          const ocrPromise = ocrService.processDocument({
            base64File: fileBase64,
            mimeType,
            fileName,
          });

          const ocrResult = await Promise.race([
            ocrPromise,
            new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
          ]);

          if (ocrResult?.success && ocrResult?.ocrText) {
            ocrText = ocrResult.ocrText;
            ocrConfidence = ocrResult.confidence || 0.95;
            extractedInfo = documentExtractionService.extract(
              ocrResult.ocrText,
              documentType,
              ocrResult.lines || []
            );
          }
        } catch (ocrErr) {
          console.warn('[DocUpload] OCR processing warning:', ocrErr.message);
        }
      }

      // Format document date/year
      let parsedDate = null;
      if (documentDate) {
        try {
          parsedDate = new Date(documentDate).toISOString();
        } catch {
          parsedDate = null;
        }
      }

      const finalExtracted = {
        ...extractedInfo,
        patientId: patient.id,
        encounterId,
        storagePath: storageResult.filePath,
        relativePath: storageResult.relativePath,
        documentDate: parsedDate,
        documentYear: documentYear || (parsedDate ? new Date(parsedDate).getFullYear().toString() : null),
        source,
        notes,
        ocrMode: isOriginalOnly ? 'ORIGINAL_ONLY' : 'ANALYZE',
        ocrStatus: processingStatus,
        viewUrl: `/api/documents/${documentId}/file`,
        downloadUrl: `/api/documents/${documentId}/download`,
      };

      // 5. Save structured record in database
      const docRecord = await prisma.medicalDocument.create({
        data: {
          id: documentId,
          sessionId,
          documentType: extractedInfo.documentType || documentType || 'OTHER',
          fileName: storageResult.fileName,
          fileSizeBytes: storageResult.fileSizeBytes || fileSizeBytes,
          mimeType,
          ocrText,
          extractedData: finalExtracted,
          confidence: ocrConfidence,
          processingStatus,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: docRecord.id,
          documentId: docRecord.id,
          patientId: patient.id,
          sessionId: docRecord.sessionId,
          documentType: docRecord.documentType,
          fileName: docRecord.fileName,
          fileSizeBytes: docRecord.fileSizeBytes,
          mimeType: docRecord.mimeType,
          ocrText: docRecord.ocrText,
          extractedData: docRecord.extractedData,
          confidence: docRecord.confidence,
          processingStatus: docRecord.processingStatus,
          createdAt: docRecord.createdAt,
          viewUrl: `/api/documents/${docRecord.id}/file`,
          downloadUrl: `/api/documents/${docRecord.id}/download`,
        },
        message: 'Original medical document stored physically and processed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/clinical/sessions/:id/documents
   * Session-scoped intake upload (Phase 7 Section 6, 8, 9).
   */
  async uploadDocument(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const {
        fileBase64,
        fileName = 'document.jpg',
        mimeType = 'image/jpeg',
        fileSizeBytes = 0,
        documentType = 'OTHER',
        ocrMode = 'ANALYZE',
        bypassOcr = false,
      } = req.body;

      const isOriginalOnly = ocrMode === 'ORIGINAL_ONLY' || Boolean(bypassOcr);

      // 1. Verify session exists in database
      const dbSession = await prisma.clinicalSession.findUnique({
        where: { id: sessionId },
        include: { patient: true },
      });

      if (!dbSession) {
        throw new AppError(404, 'Clinical session not found', 'SESSION_NOT_FOUND');
      }

      const documentId = crypto.randomUUID();
      const patientId = dbSession.patientId || dbSession.patient?.id || 'session-uploads';

      // 2. Persist original file on disk
      let storageResult = null;
      if (fileBase64) {
        try {
          storageResult = await storageService.saveDocumentFile({
            patientId,
            documentId,
            fileName,
            fileBase64,
          });
        } catch (sErr) {
          console.warn('[DocUpload] Storage warning:', sErr.message);
        }
      }

      // 3. Perform OCR layout and raw text extraction only if not ORIGINAL_ONLY
      let ocrText = null;
      let ocrConfidence = 1.0;
      let extractedInfo = {};
      let processingStatus = isOriginalOnly ? 'BYPASSED' : 'PROCESSED';

      if (!isOriginalOnly) {
        const ocrResult = await ocrService.processDocument({
          base64File: fileBase64,
          mimeType,
          fileName,
        });

        if (!ocrResult.success) {
          return res.status(200).json({
            success: false,
            error: ocrResult.error,
            message: ocrResult.message || "We couldn't read this document clearly. Please try another image.",
            data: {
              processingStatus: 'FAILED',
              sessionId,
              fileName,
            },
          });
        }

        ocrText = ocrResult.ocrText;
        ocrConfidence = ocrResult.confidence || 0.95;
        extractedInfo = documentExtractionService.extract(
          ocrResult.ocrText,
          documentType,
          ocrResult.lines || []
        );
      }

      const finalExtracted = {
        ...extractedInfo,
        patientId: dbSession.patientId || null,
        storagePath: storageResult?.filePath || null,
        relativePath: storageResult?.relativePath || null,
        ocrMode: isOriginalOnly ? 'ORIGINAL_ONLY' : 'ANALYZE',
        ocrStatus: processingStatus,
        viewUrl: `/api/documents/${documentId}/file`,
        downloadUrl: `/api/documents/${documentId}/download`,
      };

      // 5. Persist structured record
      const docRecord = await prisma.medicalDocument.create({
        data: {
          id: documentId,
          sessionId,
          documentType: extractedInfo.documentType || documentType || 'OTHER',
          fileName: storageResult?.fileName || fileName,
          fileSizeBytes: fileSizeBytes || storageResult?.fileSizeBytes || 0,
          mimeType,
          ocrText,
          extractedData: finalExtracted,
          confidence: ocrConfidence,
          processingStatus,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: docRecord.id,
          sessionId: docRecord.sessionId,
          documentType: docRecord.documentType,
          fileName: docRecord.fileName,
          fileSizeBytes: docRecord.fileSizeBytes,
          mimeType: docRecord.mimeType,
          ocrText: docRecord.ocrText,
          extractedData: docRecord.extractedData,
          confidence: docRecord.confidence,
          processingStatus: docRecord.processingStatus,
          createdAt: docRecord.createdAt,
          viewUrl: `/api/documents/${docRecord.id}/file`,
          downloadUrl: `/api/documents/${docRecord.id}/download`,
        },
        message: 'Medical document processed and structured successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/patients/:patientId/documents
   * Lists all medical documents associated with the given patient across all visits.
   */
  async getPatientDocuments(req, res, next) {
    try {
      const patientId = req.params.patientId || req.params.id;

      const patient = await prisma.patient.findFirst({
        where: {
          OR: [
            { id: patientId },
            { patientIdentifier: patientId },
            { hospitalUhid: patientId },
            { abhaId: patientId },
            { phone: patientId },
          ],
        },
        include: {
          encounters: {
            include: {
              attendingDoctor: true,
              hospital: true,
              department: true,
              clinicalSessions: {
                include: { documents: true },
              },
            },
          },
          clinicalSessions: {
            include: { documents: true },
          },
        },
      });

      if (!patient) {
        throw new AppError(404, 'Patient not found', 'PATIENT_NOT_FOUND');
      }

      const allDocs = [];
      const seenIds = new Set();

      const processDoc = (doc, enc = null) => {
        if (!doc || seenIds.has(doc.id)) return;
        seenIds.add(doc.id);

        const docDate = doc.extractedData?.documentDate
          ? new Date(doc.extractedData.documentDate)
          : new Date(doc.createdAt);

        const highlights = [];
        if (doc.extractedData && typeof doc.extractedData === 'object') {
          if (Array.isArray(doc.extractedData.medications)) {
            highlights.push(
              ...doc.extractedData.medications
                .map((m) => (typeof m === 'string' ? m : `${m.name || m.drug || 'Medication'} ${m.dosage || ''}`))
                .slice(0, 3)
            );
          }
          if (Array.isArray(doc.extractedData.investigations)) {
            highlights.push(
              ...doc.extractedData.investigations.map((inv) => `${inv.test || 'Test'}: ${inv.result || ''}`).slice(0, 3)
            );
          }
        }
        if (highlights.length === 0 && doc.ocrText) {
          const preview = doc.ocrText.split('\n').filter((l) => l.trim().length > 3).slice(0, 2);
          highlights.push(...preview);
        }

        allDocs.push({
          id: doc.id,
          documentId: doc.id,
          title: doc.fileName || 'Diagnostic Medical Document',
          type:
            doc.documentType === 'LAB_REPORT'
              ? 'Lab Report'
              : doc.documentType === 'PRESCRIPTION'
              ? 'Prescription'
              : doc.documentType === 'DISCHARGE'
              ? 'Discharge Summary'
              : 'Medical Report',
          documentType: doc.documentType,
          date: docDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          year: doc.extractedData?.documentYear || docDate.getFullYear().toString(),
          issuer: enc?.attendingDoctor?.name
            ? `${enc.attendingDoctor.name} (${enc.hospital?.name || 'AIIA'})`
            : enc?.hospital?.name || 'Diagnostic Laboratory',
          size: doc.fileSizeBytes ? `${(doc.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB` : '1.2 MB',
          fileSizeBytes: doc.fileSizeBytes,
          processingStatus: doc.processingStatus,
          ocrConfidence: doc.confidence ? `${Math.round(doc.confidence * 100)}%` : '95%',
          highlights: highlights.length > 0 ? highlights : ['OCR Processed', 'Original File Available'],
          ocrText: doc.ocrText,
          extractedData: doc.extractedData,
          source: doc.extractedData?.source || 'PATIENT_UPLOAD',
          encounterId: enc?.id || null,
          sessionId: doc.sessionId,
          viewUrl: `/api/documents/${doc.id}/file`,
          downloadUrl: `/api/documents/${doc.id}/download`,
        });
      };

      // 1. Traverse encounters
      for (const enc of patient.encounters || []) {
        for (const sess of enc.clinicalSessions || []) {
          for (const doc of sess.documents || []) {
            processDoc(doc, enc);
          }
        }
      }

      // 2. Traverse unlinked patient clinical sessions
      for (const sess of patient.clinicalSessions || []) {
        for (const doc of sess.documents || []) {
          processDoc(doc, null);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          patientId: patient.id,
          documents: allDocs,
          total: allDocs.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/documents/:documentId
   * Retrieves single document metadata and OCR data.
   */
  async getDocumentById(req, res, next) {
    try {
      const { documentId } = req.params;

      const doc = await prisma.medicalDocument.findUnique({
        where: { id: documentId },
        include: {
          session: {
            include: {
              patient: true,
              encounter: {
                include: { attendingDoctor: true, hospital: true, department: true },
              },
            },
          },
        },
      });

      if (!doc) {
        throw new AppError(404, 'Medical document not found', 'DOCUMENT_NOT_FOUND');
      }

      res.status(200).json({
        success: true,
        data: {
          ...doc,
          viewUrl: `/api/documents/${doc.id}/file`,
          downloadUrl: `/api/documents/${doc.id}/download`,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/documents/:documentId/file
   * Safely serves the original physical file (PDF or Image) inline.
   */
  async serveDocumentFile(req, res, next) {
    try {
      const { documentId } = req.params;

      const doc = await prisma.medicalDocument.findUnique({
        where: { id: documentId },
        include: { session: true },
      });

      if (!doc) {
        throw new AppError(404, 'Medical document not found', 'DOCUMENT_NOT_FOUND');
      }

      const patientId = doc.extractedData?.patientId || doc.session?.patientId || 'session-uploads';
      const fileInfo = await storageService.getDocumentFile(patientId, documentId);

      if (!fileInfo) {
        // Fallback: If physical file was uploaded during older session without disk write, return 404 with clear message
        throw new AppError(404, 'Original physical file not found on server storage', 'FILE_NOT_FOUND');
      }

      res.setHeader('Content-Type', fileInfo.mimeType || doc.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.sendFile(fileInfo.filePath);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/documents/:documentId/download
   * Downloads original physical file with attachment header.
   */
  async downloadDocumentFile(req, res, next) {
    try {
      const { documentId } = req.params;

      const doc = await prisma.medicalDocument.findUnique({
        where: { id: documentId },
        include: { session: true },
      });

      if (!doc) {
        throw new AppError(404, 'Medical document not found', 'DOCUMENT_NOT_FOUND');
      }

      const patientId = doc.extractedData?.patientId || doc.session?.patientId || 'session-uploads';
      const fileInfo = await storageService.getDocumentFile(patientId, documentId);

      if (!fileInfo) {
        throw new AppError(404, 'Original physical file not found on server storage', 'FILE_NOT_FOUND');
      }

      res.setHeader('Content-Type', fileInfo.mimeType || doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);
      res.sendFile(fileInfo.filePath);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/clinical/sessions/:id/documents
   * Legacy session-scoped documents query.
   */
  async getSessionDocuments(req, res, next) {
    try {
      const { id: sessionId } = req.params;

      const dbSession = await prisma.clinicalSession.findUnique({
        where: { id: sessionId },
      });

      if (!dbSession) {
        throw new AppError(404, 'Clinical session not found', 'SESSION_NOT_FOUND');
      }

      const docs = await prisma.medicalDocument.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      res.status(200).json({
        success: true,
        data: docs.map((d) => ({
          ...d,
          viewUrl: `/api/documents/${d.id}/file`,
          downloadUrl: `/api/documents/${d.id}/download`,
        })),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/clinical/sessions/:id/documents/:docId or DELETE /api/documents/:docId
   * Deletes document from database and physical disk.
   */
  async deleteDocument(req, res, next) {
    try {
      const documentId = req.params.docId || req.params.documentId;
      const { id: sessionId } = req.params;

      const whereClause = { id: documentId };
      if (sessionId) whereClause.sessionId = sessionId;

      const doc = await prisma.medicalDocument.findFirst({
        where: whereClause,
        include: { session: true },
      });

      if (!doc) {
        throw new AppError(404, 'Document not found', 'DOCUMENT_NOT_FOUND');
      }

      const patientId = doc.extractedData?.patientId || doc.session?.patientId || 'session-uploads';

      // Delete from DB
      await prisma.medicalDocument.delete({
        where: { id: doc.id },
      });

      // Delete physical file from disk
      await storageService.deleteDocumentFile(patientId, doc.id);

      res.status(200).json({
        success: true,
        message: 'Document deleted from database and server storage',
      });
    } catch (error) {
      next(error);
    }
  },
};
