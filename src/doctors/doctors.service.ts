import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../entities/Doctor';
import { TimeSlot } from '../entities/TimeSlot';
import { DoctorSchedule } from '../entities/DoctorSchedule';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { DoctorResponseDto } from './dto/doctor-response.dto';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(DoctorSchedule)
    private doctorScheduleRepository: Repository<DoctorSchedule>,
  ) {}

  async findAll(query: DoctorQueryDto): Promise<DoctorResponseDto[]> {
    const queryBuilder = this.doctorRepository
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.schedule', 'schedule')
      .leftJoinAndSelect('doctor.timeSlots', 'timeSlots')
      .where('doctor.isActive = :isActive', { isActive: true })
      .andWhere('doctor.isEmailVerified = :isVerified', { isVerified: true });

    // Filter by specialization
    if (query.specialization) {
      queryBuilder.andWhere('LOWER(doctor.specialization) LIKE LOWER(:specialization)', {
        specialization: `%${query.specialization}%`,
      });
    }

    // Filter by location (using address field for now)
    if (query.location) {
      queryBuilder.andWhere('LOWER(doctor.address) LIKE LOWER(:location)', {
        location: `%${query.location}%`,
      });
    }

    // Filter by availability
    if (query.available === true) {
      queryBuilder.andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('ts.doctorId')
          .from(TimeSlot, 'ts')
          .where('ts.isAvailable = :available', { available: true })
          .getQuery();
        return `doctor.id IN ${subQuery}`;
      });
    }

    const doctors = await queryBuilder.getMany();

    // Map to response DTOs
    const doctorResponses: DoctorResponseDto[] = doctors.map((doctor) => {
      const hasAvailableSlots = doctor.timeSlots?.some((slot: any) => slot.isAvailable) || false;

      return {
        id: doctor.id,
        email: doctor.email,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        phone: doctor.phone || '',
        specialization: doctor.specialization || '',
        licenseNumber: doctor.licenseNumber || '',
        location: doctor.address || '',
        averageRating: this.calculateAverageRating(doctor),
        isAvailable: hasAvailableSlots,
        scheduleType: (doctor.schedule as any)?.scheduleType || undefined,
        consultingHours: (doctor.schedule as any)
          ? {
              start: (doctor.schedule as any).consultingStartTime,
              end: (doctor.schedule as any).consultingEndTime,
            }
          : undefined,
      };
    });

    // Filter by rating if specified
    let filteredDoctors = doctorResponses;
    if (query.rating !== undefined) {
      filteredDoctors = doctorResponses.filter(
        (doctor) => doctor.averageRating && doctor.averageRating >= query.rating!,
      );
    }

    return filteredDoctors;
  }

  async findOne(id: string): Promise<DoctorResponseDto | null> {
    const doctor = await this.doctorRepository.findOne({
      where: { id, isActive: true },
      relations: ['schedule', 'timeSlots'],
    });

    if (!doctor) {
      return null;
    }

    const hasAvailableSlots = doctor.timeSlots?.some((slot: any) => slot.isAvailable) || false;

    return {
      id: doctor.id,
      email: doctor.email,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      phone: doctor.phone || '',
      specialization: doctor.specialization || '',
      licenseNumber: doctor.licenseNumber || '',
      location: doctor.address || '',
      averageRating: this.calculateAverageRating(doctor),
      isAvailable: hasAvailableSlots,
      scheduleType: (doctor.schedule as any)?.scheduleType || undefined,
      consultingHours: (doctor.schedule as any)
        ? {
            start: (doctor.schedule as any).consultingStartTime,
            end: (doctor.schedule as any).consultingEndTime,
          }
        : undefined,
    };
  }

  private calculateAverageRating(doctor: Doctor): number {
    // TODO: Implement actual rating calculation from appointments/reviews
    // For now, return a mock rating between 3.5 and 5.0
    return parseFloat((Math.random() * 1.5 + 3.5).toFixed(1));
  }
}
