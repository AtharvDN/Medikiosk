/**
 * Local Private Storage Service — MediKiosk (Phase 10B)
 * Stores and manages authentic original patient medical records, prescriptions,
 * lab reports, and imaging files on disk.
 * 
 * Directory Structure:
 * backend/uploads/patients/<patientId>/<documentId>/<cleanFileName>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root private upload directory (backend/uploads/patients)
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads/patients');

export const storageService = {
  /**
   * Resolves the storage directory for a specific patient document.
   */
  getDocumentDir(patientId, documentId) {
    const cleanPid = String(patientId).replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanDid = String(documentId).replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(UPLOADS_ROOT, cleanPid, cleanDid);
  },

  /**
   * Persists original document payload (base64 or Buffer) to local disk.
   */
  async saveDocumentFile({ patientId, documentId, fileName, fileBase64, buffer }) {
    try {
      const docDir = this.getDocumentDir(patientId, documentId);
      await fs.promises.mkdir(docDir, { recursive: true });

      // Clean file name
      const safeName = path.basename(fileName || 'document.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = path.join(docDir, safeName);

      let fileBuffer = buffer;
      if (!fileBuffer && fileBase64) {
        // Strip data URI header if present
        const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(cleanBase64, 'base64');
      }

      if (!fileBuffer) {
        throw new Error('No valid file buffer or base64 data provided');
      }

      await fs.promises.writeFile(filePath, fileBuffer);

      return {
        success: true,
        filePath,
        fileName: safeName,
        fileSizeBytes: fileBuffer.length,
        relativePath: `patients/${patientId}/${documentId}/${safeName}`,
      };
    } catch (err) {
      console.error('[StorageService] Error saving document:', err.message);
      throw err;
    }
  },

  /**
   * Finds the original physical file on disk for a given patient and documentId.
   */
  async getDocumentFile(patientId, documentId) {
    try {
      const docDir = this.getDocumentDir(patientId, documentId);
      if (!fs.existsSync(docDir)) {
        return null;
      }

      const files = await fs.promises.readdir(docDir);
      if (files.length === 0) {
        return null;
      }

      const fileName = files[0];
      const filePath = path.join(docDir, fileName);
      const stat = await fs.promises.stat(filePath);

      // Guess MIME type
      const ext = path.extname(fileName).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === '.pdf') mimeType = 'application/pdf';
      else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';

      return {
        filePath,
        fileName,
        fileSizeBytes: stat.size,
        mimeType,
      };
    } catch (err) {
      console.error('[StorageService] Error locating document:', err.message);
      return null;
    }
  },

  /**
   * Removes document directory and its file from disk.
   */
  async deleteDocumentFile(patientId, documentId) {
    try {
      const docDir = this.getDocumentDir(patientId, documentId);
      if (fs.existsSync(docDir)) {
        await fs.promises.rm(docDir, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error('[StorageService] Error deleting document file:', err.message);
      return false;
    }
  },
};
