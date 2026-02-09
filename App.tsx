import React, { useState, useEffect } from 'react';
import { MASTER_EXERCISE_DATABASE, SCHEDULE_DAYS } from './constants';
import { Exercise, WorkoutLog } from './types';
import ExerciseCard from './components/ExerciseCard';
import { Activity, CalendarDays, Dumbbell, Repeat, CheckCircle, ChevronRight, ArrowRight, Save, Trash2 } from 'lucide-react';

// --- STORAGE KEYS ---
const STORAGE_KEYS = {
  WEEK: 'gym_planner_week',
  DAY_IDX: 'gym_planner_day_index',
  EXERCISES: 'gym_planner_exercises',
  HISTORY: 'gym_planner_history'
};

const App: React.FC = () => {
  // --- STATE WITH PERSISTENCE (LAZY INITIALIZATION) ---
  
  // 1. Current Day Index
  const [currentDayIndex, setCurrentDayIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DAY_IDX);
    return saved ? parseInt(saved, 10) : 0;
  });

  // 2. Current Week
  const [currentWeek, setCurrentWeek] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.WEEK);
    return saved ? parseInt(saved, 10) : 1;
  });

  // 3. Exercises (Stores Swaps & Default Rep Changes)
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXERCISES);
    return saved ? JSON.parse(saved) : MASTER_EXERCISE_DATABASE;
  });
  
  // 4. History (Stores Logs)
  const [history, setHistory] = useState<Record<string, WorkoutLog[]>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return saved ? JSON.parse(saved) : {};
  });

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => localStorage.setItem(STORAGE_KEYS.DAY_IDX, currentDayIndex.toString()), [currentDayIndex]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.WEEK, currentWeek.toString()), [currentWeek]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises)), [exercises]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history)), [history]);

  const currentDay = SCHEDULE_DAYS[currentDayIndex];
  // Ensure we correctly identify the last day
  const isLastDay = currentDayIndex >= SCHEDULE_DAYS.length - 1;

  // --- ALGORITHMS ---

  /**
   * PROGRESSION ALGORITHM
   */
  const calculateWeight = (exercise: Exercise): number => {
    // 1. Flatten all logs and filter by exercise NAME (handling clones/swaps)
    const allLogs = Object.values(history).flat().filter(log => {
      const logExercise = exercises.find(e => e.id === log.exerciseId);
      return logExercise?.name === exercise.name;
    });

    // 2. Filter for logs strictly from previous weeks
    const previousLogs = allLogs.filter(log => log.week < currentWeek);

    // Default Starting Weight if no history
    if (previousLogs.length === 0) {
      return exercise.default_weight || 10;
    }

    // 3. Sort by Week Descending to find the most recent week
    previousLogs.sort((a, b) => b.week - a.week);
    
    const lastLogWeek = previousLogs[0].week;
    
    // Get all logs from that last week
    const lastSessionLogs = previousLogs.filter(l => l.week === lastLogWeek);
    
    if (lastSessionLogs.length === 0) return exercise.default_weight || 10;

    // Get the weight used in that last session (assuming constant weight, take first log)
    const lastWeight = lastSessionLogs[0].weight;

    // 4. Check if last session was "Complete"
    if (lastSessionLogs.length >= exercise.default_sets) {
       // Logic: IF (last_week_complete == true) THEN suggest (last_weight + 2.5kg)
       return lastWeight + 2.5;
    }

    // If incomplete session, maintain weight
    return lastWeight;
  };

  /**
   * SWAP LOGIC
   */
  const handleSwap = (currentId: string, targetId: string) => {
    const currentEx = exercises.find(e => e.id === currentId);
    const targetEx = exercises.find(e => e.id === targetId);
    
    if (!currentEx || !targetEx) return;

    // Case 1: Target is in Bench -> Standard Swap
    if (targetEx.status === "Bench") {
      setExercises(prev => prev.map(ex => {
        if (ex.id === currentId) return { ...ex, status: "Bench" };
        if (ex.id === targetId) return { ...ex, status: "Active", day_assignment: currentEx.day_assignment, circuit_id: currentEx.circuit_id };
        return ex;
      }));
    } 
    // Case 2: Target is Active on another day -> Clone it
    else {
      const clonedEx: Exercise = {
        ...targetEx,
        id: `${targetEx.id}_copy_${Date.now()}`,
        status: "Active",
        day_assignment: currentEx.day_assignment,
        circuit_id: currentEx.circuit_id
      };
      setExercises(prev => {
        const updatedList = prev.map(ex => ex.id === currentId ? { ...ex, status: "Bench" as const } : ex);
        return [...updatedList, clonedEx];
      });
    }
  };

  const getSwappableOptions = (currentEx: Exercise) => {
    return exercises.filter(candidate => {
      const hasTag = candidate.tags.some(tag => currentEx.tags.includes(tag));
      if (!hasTag) return false;
      if (candidate.id === currentEx.id) return false;
      if (candidate.status === "Active" && candidate.day_assignment === currentDay.type) return false;
      return true;
    });
  };

  /**
   * LOGGING LOGIC
   */
  const handleLog = (id: string, weight: number, reps: number) => {
    // Check if this is the first set for this exercise in the current week
    // We check the history BEFORE updating it with the new log
    const currentWeekLogs = (history[id] || []).filter(l => l.week === currentWeek);
    const isFirstSet = currentWeekLogs.length === 0;

    const newLog: WorkoutLog = {
      exerciseId: id,
      weight,
      reps,
      completed: true,
      date: new Date().toISOString(),
      week: currentWeek
    };
    
    setHistory(prev => ({
      ...prev,
      [id]: [...(prev[id] || []), newLog]
    }));

    // Save user's rep preference as the new default for this exercise
    // And if it's the first set, save the weight as default
    setExercises(prev => prev.map(ex => {
      if (ex.id === id) {
        const updatedEx = { ...ex, default_reps: reps };
        if (isFirstSet) {
          updatedEx.default_weight = weight;
        }
        return updatedEx;
      }
      return ex;
    }));
  };

  /**
   * UPDATE LOG LOGIC
   */
  const handleUpdateLog = (id: string, currentSessionSetIndex: number, weight: number, reps: number) => {
    setHistory(prev => {
      const allLogs = prev[id] || [];
      
      // Map session index to global history index
      const sessionIndices = allLogs
        .map((log, index) => ({ ...log, originalIndex: index }))
        .filter(log => log.week === currentWeek);

      if (!sessionIndices[currentSessionSetIndex]) return prev;

      const targetGlobalIndex = sessionIndices[currentSessionSetIndex].originalIndex;

      const newLogs = [...allLogs];
      newLogs[targetGlobalIndex] = {
        ...newLogs[targetGlobalIndex],
        weight,
        reps
      };

      return { ...prev, [id]: newLogs };
    });

    // Save user's rep preference if they edit a set
    setExercises(prev => prev.map(ex => 
      ex.id === id ? { ...ex, default_reps: reps } : ex
    ));
  };

  /**
   * RESET LOGIC
   */
  const handleReset = (id: string) => {
    setHistory(prev => {
      const allLogs = prev[id] || [];
      // Keep logs that are NOT from the current week
      const remainingLogs = allLogs.filter(log => log.week !== currentWeek);
      return { ...prev, [id]: remainingLogs };
    });
  };

  const handleHardReset = () => {
    if (window.confirm("WARNING: This will delete ALL history, week progress, and custom settings. Are you sure?")) {
      localStorage.clear();
      window.location.reload();
    }
  }

  /**
   * NAVIGATION & COMPLETION LOGIC
   */
  const handleFinishDay = () => {
    if (currentDayIndex < SCHEDULE_DAYS.length - 1) {
      setCurrentDayIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinishWeek = () => {
    setCurrentWeek(prev => prev + 1);
    setCurrentDayIndex(0); // Reset to Monday
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- DERIVED STATE ---
  const todaysExercises = exercises.filter(ex => 
    ex.day_assignment === currentDay.type && ex.status === "Active"
  );

  const circuit1 = todaysExercises.filter(ex => ex.circuit_id === '1');
  const circuit2 = todaysExercises.filter(ex => ex.circuit_id === '2');

  // Helper to get only CURRENT WEEK logs for a specific exercise
  const getCurrentWeekLogs = (exerciseId: string) => {
    const all = history[exerciseId] || [];
    return all.filter(l => l.week === currentWeek);
  };

  const renderExerciseList = (list: Exercise[]) => (
    list.map(ex => (
      <ExerciseCard
        key={ex.id}
        exercise={ex}
        recommendedWeight={calculateWeight(ex)}
        todaysLogs={getCurrentWeekLogs(ex.id)}
        onLog={(w, r) => handleLog(ex.id, w, r)}
        onUpdateLog={(idx, w, r) => handleUpdateLog(ex.id, idx, w, r)}
        onReset={() => handleReset(ex.id)}
        onSwap={handleSwap}
        swappableOptions={getSwappableOptions(ex)}
      />
    ))
  );

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-40 shadow-xl">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-lg font-bold flex items-center gap-2 text-white">
              <Activity className="text-emerald-500" />
              Gym Planner
            </h1>
            <span className="text-xs bg-indigo-900/50 text-indigo-200 px-3 py-1 rounded-full border border-indigo-500/30 font-bold font-mono shadow-[0_0_10px_rgba(99,102,241,0.2)]">
              WEEK {currentWeek}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {SCHEDULE_DAYS.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => setCurrentDayIndex(idx)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  idx === currentDayIndex 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <div className="mb-6 flex items-center gap-2 text-slate-300">
          <CalendarDays className="text-emerald-500" />
          <h2 className="font-bold text-lg">{currentDay.workoutName}</h2>
        </div>

        {todaysExercises.length === 0 ? (
          <div className="text-center p-10 bg-slate-900 rounded-xl shadow-inner border border-slate-800">
            <Dumbbell className="mx-auto text-slate-700 mb-2" size={48} />
            <p className="text-slate-500">No active exercises for this day.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg shadow-indigo-900/50">1</div>
                <div>
                  <h3 className="font-bold text-slate-200 text-lg">Circuit 1</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Repeat size={10} /> Perform 3 Rounds (No Rest Between Ex.)
                  </p>
                </div>
              </div>
              {renderExerciseList(circuit1)}
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg shadow-indigo-900/50">2</div>
                 <div>
                  <h3 className="font-bold text-slate-200 text-lg">Circuit 2</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Repeat size={10} /> Perform 3 Rounds (No Rest Between Ex.)
                  </p>
                </div>
              </div>
              {renderExerciseList(circuit2)}
            </div>
          </div>
        )}

        {/* Action Button: Finish Day or Finish Week */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          {isLastDay ? (
            <button 
              onClick={handleFinishWeek}
              className="w-full bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-100 border border-emerald-800 font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-between px-6 group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-full text-emerald-400">
                  <CheckCircle size={24} />
                </div>
                <div className="text-left">
                  <span className="block text-xs text-emerald-400/70 uppercase tracking-wider">Week Complete?</span>
                  <span className="text-lg">Finish Week {currentWeek}</span>
                </div>
              </div>
              <ChevronRight className="text-emerald-500 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button 
              onClick={handleFinishDay}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-between px-6 group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-full text-indigo-400">
                  <ArrowRight size={24} />
                </div>
                <div className="text-left">
                  <span className="block text-xs text-slate-500 uppercase tracking-wider">Workout Complete?</span>
                  <span className="text-lg">Finish Day & Go to {SCHEDULE_DAYS[currentDayIndex + 1]?.label}</span>
                </div>
              </div>
              <ChevronRight className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
          )}

          {isLastDay && (
            <p className="text-center text-xs text-slate-600 mt-4">
              Completing the week will increase weights by 2.5kg for completed exercises in the next week.
            </p>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-slate-900 text-center text-xs text-slate-600 pb-8">
           <p className="mb-4">Gym Planner • Logic-Based Progression • Machine Only</p>
           
           <button 
             onClick={handleHardReset} 
             className="text-rose-900/50 hover:text-rose-500 flex items-center gap-2 mx-auto transition-colors"
           >
             <Trash2 size={12} /> Reset All Data (Start Over)
           </button>
        </div>
      </main>
    </div>
  );
};

export default App;