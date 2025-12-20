import { PrismaClient, Instruction } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Add a new instruction
 */
export async function addInstruction(
  userId: string,
  content: string
): Promise<Instruction> {
  const instruction = await prisma.instruction.create({
    data: {
      userId,
      content: content.trim(),
      active: true,
    },
  });

  console.log(`[Instructions] Added: "${content.substring(0, 50)}..."`);
  return instruction;
}

/**
 * Get all active instructions for a user
 */
export async function getActiveInstructions(userId: string): Promise<Instruction[]> {
  return prisma.instruction.findMany({
    where: {
      userId,
      active: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get all instructions for a user (including inactive)
 */
export async function getAllInstructions(userId: string): Promise<Instruction[]> {
  return prisma.instruction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Deactivate an instruction
 */
export async function deactivateInstruction(instructionId: string): Promise<Instruction> {
  return prisma.instruction.update({
    where: { id: instructionId },
    data: { active: false },
  });
}

/**
 * Reactivate an instruction
 */
export async function reactivateInstruction(instructionId: string): Promise<Instruction> {
  return prisma.instruction.update({
    where: { id: instructionId },
    data: { active: true },
  });
}

/**
 * Delete an instruction permanently
 */
export async function deleteInstruction(instructionId: string): Promise<void> {
  await prisma.instruction.delete({
    where: { id: instructionId },
  });
}

/**
 * Format instructions for agent prompt
 */
export function formatInstructionsForPrompt(instructions: Instruction[]): string {
  if (instructions.length === 0) {
    return 'No active instructions.';
  }

  return instructions
    .map((inst, i) => `${i + 1}. ${inst.content}`)
    .join('\n');
}

