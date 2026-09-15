import { Router } from 'express';
import { encounterController } from '../controllers/encounter.controller.js';

export const encounterRouter = Router();

encounterRouter.post('/', encounterController.createEncounter);
encounterRouter.get('/:id', encounterController.getEncounter);
encounterRouter.post('/:id/cancel', encounterController.cancelEncounter);
