import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as instructions from '../services/instructions';

const router = Router();
const prisma = new PrismaClient();

// Get all instructions (active only by default)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const includeInactive = req.query.all === 'true';
    
    const list = includeInactive
      ? await instructions.getAllInstructions(req.user!.id)
      : await instructions.getActiveInstructions(req.user!.id);

    res.json({
      success: true,
      instructions: list.map((inst) => ({
        id: inst.id,
        content: inst.content,
        active: inst.active,
        createdAt: inst.createdAt.toISOString(),
      })),
      total: list.length,
    });
  } catch (error) {
    console.error('Error fetching instructions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch instructions',
    });
  }
});

// Add a new instruction
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Instruction content is required',
      });
    }

    const instruction = await instructions.addInstruction(req.user!.id, content);

    res.json({
      success: true,
      instruction: {
        id: instruction.id,
        content: instruction.content,
        active: instruction.active,
        createdAt: instruction.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error adding instruction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add instruction',
    });
  }
});

// Deactivate an instruction
router.patch('/:id/deactivate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.instruction.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Instruction not found',
      });
    }

    const instruction = await instructions.deactivateInstruction(id);

    res.json({
      success: true,
      instruction: {
        id: instruction.id,
        content: instruction.content,
        active: instruction.active,
      },
    });
  } catch (error) {
    console.error('Error deactivating instruction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate instruction',
    });
  }
});

// Reactivate an instruction
router.patch('/:id/reactivate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.instruction.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Instruction not found',
      });
    }

    const instruction = await instructions.reactivateInstruction(id);

    res.json({
      success: true,
      instruction: {
        id: instruction.id,
        content: instruction.content,
        active: instruction.active,
      },
    });
  } catch (error) {
    console.error('Error reactivating instruction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate instruction',
    });
  }
});

// Delete an instruction permanently
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.instruction.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Instruction not found',
      });
    }

    await instructions.deleteInstruction(id);

    res.json({
      success: true,
      message: 'Instruction deleted',
    });
  } catch (error) {
    console.error('Error deleting instruction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete instruction',
    });
  }
});

export default router;

