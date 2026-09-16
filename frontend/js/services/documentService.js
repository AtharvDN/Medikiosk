/**
 * Medical Document Intake Service (Phase 7 Section 6, 7, 8, 9)
 * Integrates OCR layout analysis, zero-hallucination entity extraction,
 * and Supabase persistence scoped to the current patient session.
 */

import { api } from '../api.js';
import { appState } from '../state.js';

class DocumentService {
  async processDocument(fileInfo, onProgress = () => {}) {
    // Stage 1: Reading document
    onProgress('readingDoc');

    if (appState.backendSessionId) {
      try {
        onProgress('extractingDoc');

        const uploadRes = await api.uploadDocument(appState.backendSessionId, {
          fileBase64: fileInfo.base64 || '',
          fileName: fileInfo.name || 'document.jpg',
          mimeType: fileInfo.mimeType || (fileInfo.type === 'image' ? 'image/jpeg' : 'application/pdf'),
          fileSizeBytes: fileInfo.size || 1048576,
          documentType: fileInfo.type || 'PRESCRIPTION',
          ocrMode: fileInfo.ocrMode || 'ANALYZE',
        });

        onProgress('organizingDoc');

        if (uploadRes?.success && uploadRes.data) {
          const d = uploadRes.data;
          return {
            id: d.id,
            name: d.fileName,
            type: d.documentType,
            fileSizeBytes: d.fileSizeBytes,
            mimeType: d.mimeType,
            ocrText: d.ocrText,
            extractedData: d.extractedData,
            confidence: d.confidence,
            ocrMode: fileInfo.ocrMode || 'ANALYZE',
            processingStatus: d.processingStatus || (fileInfo.ocrMode === 'ORIGINAL_ONLY' ? 'BYPASSED' : 'PROCESSED'),
            isDemoData: false,
          };
        } else if (uploadRes && !uploadRes.success) {
          const errCode = typeof uploadRes.error === 'object' ? (uploadRes.error.code || 'UNREADABLE_DOCUMENT') : (uploadRes.error || 'UNREADABLE_DOCUMENT');
          const errMsg = uploadRes.message || (typeof uploadRes.error === 'object' ? uploadRes.error.message : '') || "कागद स्कॅन करता आला नाही. कृपया पुन्हा प्रयत्न करा.";
          return {
            success: false,
            error: errCode,
            message: errMsg,
            isFailed: true,
          };
        }
      } catch (err) {
        console.warn('[DocumentService] Backend OCR call failed:', err);
        return {
          success: false,
          error: 'OCR_SERVICE_ERROR',
          message: "कागद स्कॅन करताना तांत्रिक अडचण आली. कृपया पुन्हा प्रयत्न करा.",
          isFailed: true,
        };
      }
    }

    // Offline test-only fallback (only when no backend session exists)
    onProgress('extractingDoc');
    onProgress('organizingDoc');

    return {
      id: `doc-${Date.now()}`,
      name: fileInfo.name || 'document.txt',
      type: fileInfo.type || 'PRESCRIPTION',
      fileSizeBytes: fileInfo.size || 1024,
      mimeType: fileInfo.type === 'image' ? 'image/jpeg' : 'text/plain',
      ocrText: fileInfo.ocrMode === 'ORIGINAL_ONLY' ? null : (fileInfo.base64 ? Buffer.from(fileInfo.base64, 'base64').toString('utf8') : ''),
      extractedData: {
        documentType: fileInfo.type || 'OTHER',
        medications: [],
        diagnoses: [],
        labResults: [],
      },
      confidence: 0.0,
      ocrMode: fileInfo.ocrMode || 'ANALYZE',
      processingStatus: fileInfo.ocrMode === 'ORIGINAL_ONLY' ? 'BYPASSED' : 'PROCESSED',
      isDemoData: true,
    };
  }
}

export const documentService = new DocumentService();

