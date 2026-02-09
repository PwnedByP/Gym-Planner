export type ExerciseStatus = "Active" | "Bench";

export enum ACLSafetyTier {
  TIER_1_SAFE = 1,    // Closed Chain, Hamstring focus
  TIER_2_CAUTION = 2, // Stability required
  TIER_3_AVOID = 3    // Open Chain Quads (High Shear)
}

export type DayName = "Push_A" | "Push_B" | "Pull_A" | "Pull_B" | "Legs_A" | "Legs_B";

export interface Exercise {
  id: string;
  name: string;
  target_muscle: string;
  machine_type: string;
  default_reps: number;
  default_sets: number;
  default_weight?: number; // Added for persisting user weight preference
  acl_safety_tier: ACLSafetyTier;
  status: ExerciseStatus;
  compatible_swaps: string[]; // Legacy ID matching, we will prefer tags
  tags: string[]; // New: For muscle-group based swapping
  day_assignment: DayName;
  circuit_id: "1" | "2"; 
  description: string;
}

export interface WorkoutLog {
  exerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
  date: string;
  week: number;
}