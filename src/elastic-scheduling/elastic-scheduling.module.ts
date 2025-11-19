import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticSchedulingController } from './elastic-scheduling.controller';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import { SessionOverride } from '../entities/SessionOverride';
import { AppointmentAdjustmentLog } from '../entities/AppointmentAdjustmentLog';
import { Doctor } from '../entities/Doctor';
import { DoctorSchedule } from '../entities/DoctorSchedule';
import { TimeSlot } from '../entities/TimeSlot';
import { Appointment } from '../entities/Appointment';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SessionOverride,
      AppointmentAdjustmentLog,
      Doctor,
      DoctorSchedule,
      TimeSlot,
      Appointment,
    ]),
  ],
  controllers: [ElasticSchedulingController],
  providers: [ElasticSchedulingService],
  exports: [ElasticSchedulingService],
})
export class ElasticSchedulingModule {}
