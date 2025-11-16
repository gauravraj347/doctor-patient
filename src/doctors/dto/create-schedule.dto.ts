import { IsEnum, IsString, IsInt, IsOptional, Min, Max, ValidateIf } from 'class-validator';
import { ScheduleType } from '../../entities/DoctorSchedule';

export class CreateScheduleDto {
  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @IsString()
  consultingStartTime: string; // Format: HH:MM:SS

  @IsString()
  consultingEndTime: string; // Format: HH:MM:SS

  // For wave scheduling
  @ValidateIf((o) => o.scheduleType === ScheduleType.WAVE)
  @IsInt()
  @Min(5)
  @Max(120)
  slotDuration?: number; // in minutes

  @ValidateIf((o) => o.scheduleType === ScheduleType.WAVE)
  @IsInt()
  @Min(1)
  @Max(50)
  capacityPerSlot?: number;

  // For stream scheduling
  @ValidateIf((o) => o.scheduleType === ScheduleType.STREAM)
  @IsInt()
  @Min(1)
  @Max(100)
  totalCapacity?: number;
}
