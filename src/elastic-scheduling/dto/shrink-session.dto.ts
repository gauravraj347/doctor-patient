import { IsString, IsOptional, Matches, IsEnum } from 'class-validator';

export enum RedistributionStrategy {
  AUTO = 'AUTO',
  MOVE_TO_ADJACENT_SLOT = 'MOVE_TO_ADJACENT_SLOT',
  REDUCE_CONSULTATION_TIME = 'REDUCE_CONSULTATION_TIME',
  INCREASE_CAPACITY_PER_SLOT = 'INCREASE_CAPACITY_PER_SLOT',
  MARK_NEEDS_RESCHEDULE = 'MARK_NEEDS_RESCHEDULE',
}

export class ShrinkSessionDto {
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'newStartTime must be in HH:MM:SS format',
  })
  newStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'newEndTime must be in HH:MM:SS format',
  })
  newEndTime?: string;

  @IsOptional()
  @IsEnum(RedistributionStrategy)
  strategy?: RedistributionStrategy;

  @IsOptional()
  @IsString()
  reason?: string;
}

export interface AppointmentChange {
  appointmentId: string;
  action: 'MOVED' | 'REDISTRIBUTED' | 'NEEDS_RESCHEDULE' | 'REASSIGNED';
  oldReportingTime: string;
  newReportingTime: string | null;
  oldSlotId?: string;
  newSlotId?: string | null;
  oldTokenNumber?: number;
  newTokenNumber?: number | null;
  timeDifference?: number;
  reason: string;
  patientName?: string;
  patientPhone?: string;
}

export interface ShrinkSessionResultDto {
  success: boolean;
  message: string;
  override: any;
  totalAffected: number;
  redistributed: number;
  needsReschedule: number;
  strategyUsed: string;
  changes: AppointmentChange[];
}

export interface RedistributionResult {
  allFitted: boolean;
  redistributed: number;
  remaining: any[];
  changes: AppointmentChange[];
  newSlotDuration?: number;
  newCapacityPerSlot?: number;
  strategyUsed: string;
}
