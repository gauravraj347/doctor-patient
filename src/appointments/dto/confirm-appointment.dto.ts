import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class ConfirmAppointmentDto {
    @IsUUID()
    doctorId: string;

    @IsUUID()
    patientId: string;

    @IsOptional()
    @IsUUID()
    slotId?: string; // Required for wave, optional for stream

    @IsDateString()
    appointmentDate: string; // Format: YYYY-MM-DD
}
