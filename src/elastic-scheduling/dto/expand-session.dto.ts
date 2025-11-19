import { IsString, IsOptional, Matches } from 'class-validator';

export class ExpandSessionDto {
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
  @IsString()
  reason?: string;
}
