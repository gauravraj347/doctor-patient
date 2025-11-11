import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { Doctor } from '../entities/Doctor';
import { TimeSlot } from '../entities/TimeSlot';
import { DoctorSchedule } from '../entities/DoctorSchedule';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor, TimeSlot, DoctorSchedule])],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
