import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { Appointment } from '../entities/Appointment';
import { Doctor } from '../entities/Doctor';
import { Patient } from '../entities/Patient';
import { TimeSlot } from '../entities/TimeSlot';
import { DoctorSchedule } from '../entities/DoctorSchedule';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Appointment,
            Doctor,
            Patient,
            TimeSlot,
            DoctorSchedule,
        ]),
    ],
    controllers: [AppointmentsController],
    providers: [AppointmentsService],
    exports: [AppointmentsService],
})
export class AppointmentsModule { }
