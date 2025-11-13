import { IsUUID, IsString, IsOptional } from 'class-validator';

export class CancelAppointmentDto {
    @IsUUID()
    appointmentId: string;

    @IsOptional()
    @IsString()
    reason?: string;
}
