'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Instruction {
  id: string;
  content: string;
  active: boolean;
  createdAt: string;
}

interface InstructionsPanelProps {
  token: string;
}

export function InstructionsPanel({ token }: InstructionsPanelProps) {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [newInstruction, setNewInstruction] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInstructions = async () => {
    try {
      const data = await api.getInstructions(token, showInactive);
      setInstructions(data.instructions);
      setError(null);
    } catch (err) {
      setError('Failed to load instructions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstructions();
  }, [token, showInactive]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstruction.trim() || adding) return;

    setAdding(true);
    try {
      const data = await api.addInstruction(token, newInstruction.trim());
      setInstructions([data.instruction, ...instructions]);
      setNewInstruction('');
      setError(null);
    } catch (err) {
      setError('Failed to add instruction');
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (instruction: Instruction) => {
    try {
      if (instruction.active) {
        await api.deactivateInstruction(token, instruction.id);
      } else {
        await api.reactivateInstruction(token, instruction.id);
      }
      await loadInstructions();
    } catch (err) {
      setError('Failed to update instruction');
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this instruction?')) return;

    try {
      await api.deleteInstruction(token, id);
      setInstructions(instructions.filter((i) => i.id !== id));
    } catch (err) {
      setError('Failed to delete instruction');
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-xl">📋</span>
          Ongoing Instructions
        </h3>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show inactive
        </label>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Instructions the AI follows automatically when events happen (new emails, calendar updates, etc.)
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add new instruction */}
      <form onSubmit={handleAdd} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newInstruction}
            onChange={(e) => setNewInstruction(e.target.value)}
            placeholder="e.g., Always respond to emails from @priority.com within 2 hours"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={adding || !newInstruction.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>

      {/* Instructions list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-gray-400">Loading...</div>
        ) : instructions.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            No instructions yet. Add one above or ask the AI to &quot;always&quot; do something.
          </div>
        ) : (
          instructions.map((instruction) => (
            <div
              key={instruction.id}
              className={`p-3 rounded-lg border ${
                instruction.active
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-gray-100 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      instruction.active ? 'text-gray-900' : 'text-gray-500 line-through'
                    }`}
                  >
                    {instruction.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Added {new Date(instruction.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(instruction)}
                    className={`px-2 py-1 text-xs rounded font-medium ${
                      instruction.active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {instruction.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleDelete(instruction.id)}
                    className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
