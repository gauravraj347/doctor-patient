import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AppointmentStatus } from '../../entities/Appointment';

export class AppointmentQueryDto {
    @IsOptional()
    @IsEnum(AppointmentStatus)
    status?: AppointmentStatus;

    @IsOptional()
    @IsDateString()
    from?: string; // YYYY-MM-DD

    @IsOptional()
    @IsDateString()
    to?: string; // YYYY-MM-DD
}
