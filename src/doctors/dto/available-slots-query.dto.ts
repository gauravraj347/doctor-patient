import { IsDateString, IsNotEmpty } from 'class-validator';

export class AvailableSlotsQueryDto {
  @IsNotEmpty()
  @IsDateString()
  date: string; // Format: YYYY-MM-DD
}
