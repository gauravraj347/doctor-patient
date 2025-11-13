import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { ConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('appointments')
export class AppointmentsController {
    constructor(private readonly appointmentsService: AppointmentsService) { }

    @Post('confirm')
    @UseGuards(JwtAuthGuard)
    async confirmAppointment(
        @Body() confirmDto: ConfirmAppointmentDto,
        @Request() req: any,
    ) {
        // Ensure the patient is booking for themselves
        if (confirmDto.patientId !== req.user.userId) {
            throw new Error('You can only book appointments for yourself');
        }

        return this.appointmentsService.confirmAppointment(confirmDto);
    }

    @Post('cancel')
    @UseGuards(JwtAuthGuard)
    async cancelAppointment(
        @Body() cancelDto: CancelAppointmentDto,
        @Request() req: any,
    ) {
        return this.appointmentsService.cancelAppointment(
            cancelDto,
            req.user.userId,
        );
    }

    @Get('my-appointments')
    @UseGuards(JwtAuthGuard)
    async getMyAppointments(@Request() req: any) {
        return this.appointmentsService.getPatientAppointments(req.user.userId);
    }
}
