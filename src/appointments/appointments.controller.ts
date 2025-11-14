import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Request,
    Param,
    Query,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { ConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
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
            throw new BadRequestException(
                'You can only book appointments for yourself',
            );
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

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getAppointmentById(@Param('id') id: string, @Request() req: any) {
        const appointment = await this.appointmentsService.getAppointmentById(
            id,
            req.user.userId,
        );

        if (!appointment) {
            throw new NotFoundException('Appointment not found');
        }

        return appointment;
    }
}

@Controller('patients')
export class PatientsController {
    constructor(private readonly appointmentsService: AppointmentsService) { }

    @Get(':id/appointments')
    @UseGuards(JwtAuthGuard)
    async getPatientAppointments(
        @Param('id') patientId: string,
        @Query() query: AppointmentQueryDto,
        @Request() req: any,
    ) {
        // Ensure user can only view their own appointments
        if (patientId !== req.user.userId) {
            throw new BadRequestException(
                'You can only view your own appointments',
            );
        }

        return this.appointmentsService.getPatientAppointmentsWithFilters(
            patientId,
            query,
        );
    }
}
