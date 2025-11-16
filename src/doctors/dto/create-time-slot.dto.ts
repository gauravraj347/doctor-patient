import { IsEnum, IsString, IsBoolean, IsOptional } from 'class-validator';
import { Weekday } from '../../entities/TimeSlot';

export class CreateTimeSlotDto {
  @IsEnum(Weekday)
  weekday: Weekday;

  @IsString()
  startTime: string; // Format: HH:MM:SS

  @IsString()
  endTime: string; // Format: HH:MM:SS

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
