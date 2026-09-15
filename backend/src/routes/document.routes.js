/**
 * Medical Document Routes (Phase 7 & Phase 10B)
 */

import { Router } from 'express';
import { documentController } from '../controllers/document.controller.js';

export const documentRouter = Router({ mergeParams: true });

// Standalone Document endpoints
documentRouter.get('/:documentId/file', documentController.serveDocumentFile);
documentRouter.get('/:documentId/download', documentController.downloadDocumentFile);
documentRouter.get('/:documentId', documentController.getDocumentById);
documentRouter.delete('/:documentId', documentController.deleteDocument);

// Session-scoped document endpoints (clinicalRouter.use('/sessions/:id/documents', documentRouter))
documentRouter.post('/', documentController.uploadDocument);
documentRouter.get('/', documentController.getSessionDocuments);
documentRouter.delete('/:docId', documentController.deleteDocument);
