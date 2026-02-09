import React, { useState, useEffect } from 'react';
import { Exercise, ACLSafetyTier, WorkoutLog } from '../types';
import { AlertTriangle, ArrowRightLeft, Shield, AlertOctagon, Check, Lock, Edit2, RotateCw, Plus, Trash2, Layers } from 'lucide-react';

interface ExerciseCardProps {
  exercise: Exercise;
  recommendedWeight: number;
  todaysLogs: WorkoutLog[]; // Logs specifically for today
  onLog: (weight: number, reps: number) => void;
  onUpdateLog: (index: number, weight: number, reps: number) => void;
  onReset: () => void;
  onSwap: (originalId: string, newId: string) => void;
  swappableOptions: Exercise[];
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  recommendedWeight,
  todaysLogs,
  onLog,
  onUpdateLog,
  onReset,
  onSwap,
  swappableOptions,
}) => {
  const [isSwapMode, setIsSwapMode] = useState(false);
  
  // Input state
  const [weight, setWeight] = useState(recommendedWeight);
  const [reps, setReps] = useState(exercise.default_reps);
  
  // State for tracking which set we are editing (null means we are logging a new set)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Sync input with the set being edited, or defaults for new set
  useEffect(() => {
    if (editingIndex !== null && todaysLogs[editingIndex]) {
      setWeight(todaysLogs[editingIndex].weight);
      setReps(todaysLogs[editingIndex].reps);
    } else {
      // If we finished a set, default weight stays same, but maybe we want to keep previous weight?
      // Logic: If we have logs, default to the LAST logged weight for convenience
      if (todaysLogs.length > 0 && editingIndex === null) {
        setWeight(todaysLogs[todaysLogs.length - 1].weight);
        setReps(exercise.default_reps);
      } else if (editingIndex === null) {
        setWeight(recommendedWeight);
        setReps(exercise.default_reps);
      }
    }
  }, [editingIndex, todaysLogs.length, recommendedWeight, exercise.default_reps]);

  const currentSetNumber = editingIndex !== null ? editingIndex + 1 : todaysLogs.length + 1;
  const isComplete = todaysLogs.length >= exercise.default_sets && editingIndex === null;

  const renderTierBadge = (tier: ACLSafetyTier) => {
    switch (tier) {
      case ACLSafetyTier.TIER_1_SAFE:
        return <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-900/50 px-2 py-1 rounded"><Shield size={12}/> Tier 1</span>;
      case ACLSafetyTier.TIER_2_CAUTION:
        return <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/50 border border-amber-900/50 px-2 py-1 rounded"><AlertTriangle size={12}/> Tier 2</span>;
      case ACLSafetyTier.TIER_3_AVOID:
        return <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/50 border border-rose-900/50 px-2 py-1 rounded"><AlertOctagon size={12}/> Tier 3</span>;
    }
  };

  const handleAction = () => {
    if (editingIndex !== null) {
      onUpdateLog(editingIndex, weight, reps);
      setEditingIndex(null); // Return to "New Set" mode
    } else {
      onLog(weight, reps);
      // Stay in "New Set" mode, useEffect will update default values
    }
  };

  return (
    <div className={`rounded-xl shadow-lg border overflow-hidden mb-4 transition-all duration-300 ${isComplete ? 'bg-slate-900/40 border-emerald-900/50' : 'bg-slate-900 border-slate-800'}`}>
      <div className="p-5">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className={`text-lg font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>{exercise.name}</h3>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{exercise.machine_type}</p>
          </div>
          {renderTierBadge(exercise.acl_safety_tier)}
        </div>

        <p className="text-slate-400 text-sm mb-4 pl-1 leading-relaxed">
          {exercise.description}
        </p>

        {/* Set Tracker / History List */}
        {todaysLogs.length > 0 && (
          <div className="mb-4 space-y-2">
            {todaysLogs.map((log, idx) => (
              <div key={idx} className={`flex justify-between items-center p-2 rounded border text-sm ${editingIndex === idx ? 'bg-indigo-900/30 border-indigo-500/50 ring-1 ring-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                <div className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-emerald-900/50 text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-900">
                     <Check size={10} strokeWidth={4} />
                   </div>
                   <span className="text-slate-300 font-mono">Set {idx + 1}: <span className="text-white font-bold">{log.weight}kg</span> x {log.reps}</span>
                </div>
                <button 
                  onClick={() => setEditingIndex(idx)}
                  className="text-slate-500 hover:text-white p-1"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Active Input Zone */}
        {!isSwapMode && !isComplete && (
          <div className="p-4 rounded-xl border shadow-inner bg-slate-800 border-slate-700 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                {editingIndex !== null ? `Editing Set ${editingIndex + 1}` : `Record Set ${currentSetNumber}`}
              </span>
              {editingIndex !== null && (
                <button onClick={() => setEditingIndex(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel Edit</button>
              )}
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="text-xs text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Weight (kg)</label>
                <input 
                  type="number" 
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full text-lg font-bold text-white bg-slate-700 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors text-center placeholder-slate-400 shadow-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Reps / Set</label>
                <input 
                  type="number" 
                  value={reps}
                  onChange={(e) => setReps(Number(e.target.value))}
                  className="w-full text-lg font-bold text-white bg-slate-700 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors text-center placeholder-slate-400 shadow-sm"
                />
              </div>
            </div>
            
            <button 
              onClick={handleAction}
              className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 border shadow-lg active:scale-[0.98]
                ${editingIndex !== null 
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-indigo-900/20' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-emerald-900/20'
                }`}
            >
              {editingIndex !== null ? (
                <> <RotateCw size={16} /> UPDATE SET {editingIndex + 1} </>
              ) : (
                <> <Plus size={16} /> LOG SET </>
              )}
            </button>
          </div>
        )}

        {/* Complete State Message */}
        {isComplete && !isSwapMode && (
          <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-center">
             <p className="text-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
               <Check size={16} /> Exercise Complete
             </p>
             <button 
                onClick={() => setEditingIndex(todaysLogs.length - 1)}
                className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline"
             >
               Edit Last Set
             </button>
          </div>
        )}

        {/* Footer Actions: Swap & Reset */}
        <div className="mt-3 flex justify-between items-center">
          {!isSwapMode ? (
            <button 
              onClick={() => setIsSwapMode(true)}
              className="flex items-center gap-1 text-xs transition-colors text-slate-500 hover:text-indigo-400"
            >
              <ArrowRightLeft size={12} /> Swap Exercise
            </button>
          ) : (
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-2 w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400">Select Replacement</span>
                <button onClick={() => setIsSwapMode(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
              </div>
              {swappableOptions.length > 0 ? (
                <div className="space-y-2">
                  {swappableOptions.map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => {
                        onSwap(exercise.id, opt.id);
                        setIsSwapMode(false);
                      }}
                      className="w-full text-left p-3 bg-slate-900 border border-slate-800 rounded hover:border-indigo-500/50 hover:bg-slate-900/80 text-sm flex justify-between items-center group transition-colors"
                    >
                      <span className="text-slate-300 group-hover:text-white">{opt.name}</span>
                      {renderTierBadge(opt.acl_safety_tier)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic p-2">No alternatives available matching tags.</p>
              )}
            </div>
          )}

          {todaysLogs.length > 0 && !isSwapMode && (
             <button 
              onClick={onReset}
              className="flex items-center gap-1 text-xs transition-colors text-slate-500 hover:text-rose-400"
            >
              <Trash2 size={12} /> Reset Data
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default ExerciseCard;