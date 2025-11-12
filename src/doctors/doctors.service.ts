import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../entities/Doctor';
import { TimeSlot } from '../entities/TimeSlot';
import { DoctorSchedule, ScheduleType } from '../entities/DoctorSchedule';
import { Appointment } from '../entities/Appointment';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { DoctorResponseDto } from './dto/doctor-response.dto';
import {
  AvailableSlotsResponseDto,
  SlotDto,
} from './dto/available-slots-response.dto';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(DoctorSchedule)
    private doctorScheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
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
      queryBuilder.andWhere(
        'LOWER(doctor.specialization) LIKE LOWER(:specialization)',
        {
          specialization: `%${query.specialization}%`,
        },
      );
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
      const hasAvailableSlots =
        doctor.timeSlots?.some((slot: any) => slot.isAvailable) || false;

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

    const hasAvailableSlots =
      doctor.timeSlots?.some((slot: any) => slot.isAvailable) || false;

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

  async getAvailableSlots(
    doctorId: string,
    dateString: string,
  ): Promise<AvailableSlotsResponseDto | null> {
    // Validate date format
    const requestedDate = new Date(dateString);
    if (isNaN(requestedDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      throw new BadRequestException('Cannot book appointments for past dates');
    }

    // Fetch doctor with schedule
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId, isActive: true },
      relations: ['schedule'],
    });

    if (!doctor || !(doctor.schedule as any)) {
      return null;
    }

    const schedule = doctor.schedule as any;

    // Get day of week from date
    const dayOfWeek = this.getDayOfWeek(requestedDate);

    // Fetch existing appointments for this date
    const existingAppointments = await this.appointmentRepository.find({
      where: {
        appointmentDate: requestedDate as any,
        status: 'Scheduled' as any,
      },
      relations: ['timeSlot'],
    });

    let slots: SlotDto[] = [];

    if (schedule.scheduleType === ScheduleType.WAVE) {
      // Wave scheduling logic
      slots = await this.generateWaveSlots(
        doctorId,
        schedule,
        dayOfWeek,
        existingAppointments,
      );
    } else if (schedule.scheduleType === ScheduleType.STREAM) {
      // Stream scheduling logic
      slots = this.generateStreamSlots(schedule, existingAppointments);
    }

    const availableSlots = slots.filter((slot) => !slot.isFull);

    return {
      doctorId: doctor.id,
      doctorName: `${doctor.firstName} ${doctor.lastName}`,
      date: dateString,
      scheduleType: schedule.scheduleType,
      consultingHours: {
        start: schedule.consultingStartTime,
        end: schedule.consultingEndTime,
      },
      slots: availableSlots,
      totalAvailableSlots: availableSlots.length,
      message:
        availableSlots.length === 0
          ? 'No available slots for this date'
          : undefined,
    };
  }

  private async generateWaveSlots(
    doctorId: string,
    schedule: any,
    dayOfWeek: string,
    existingAppointments: Appointment[],
  ): Promise<SlotDto[]> {
    const slots: SlotDto[] = [];

    // Fetch time slots for this doctor and day of week
    const timeSlots = await this.timeSlotRepository.find({
      where: {
        doctorId: doctorId,
        weekday: dayOfWeek as any,
        isAvailable: true,
      },
      order: {
        startTime: 'ASC',
      },
    });

    // If no predefined time slots, generate them dynamically
    if (timeSlots.length === 0) {
      return this.generateDynamicWaveSlots(schedule, existingAppointments);
    }

    // Use predefined time slots
    for (const timeSlot of timeSlots) {
      const bookedCount = existingAppointments.filter(
        (apt) => apt.slotId === timeSlot.id,
      ).length;

      const availableCapacity = Math.max(
        0,
        (schedule.capacityPerSlot || 1) - bookedCount,
      );

      slots.push({
        slotId: timeSlot.id,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
        availableCapacity,
        totalCapacity: schedule.capacityPerSlot || 1,
        isFull: availableCapacity === 0,
      });
    }

    return slots;
  }

  private generateDynamicWaveSlots(
    schedule: any,
    existingAppointments: Appointment[],
  ): SlotDto[] {
    const slots: SlotDto[] = [];
    const slotDuration = schedule.slotDuration || 30; // Default 30 minutes
    const capacityPerSlot = schedule.capacityPerSlot || 1;

    const startTime = this.parseTime(schedule.consultingStartTime);
    const endTime = this.parseTime(schedule.consultingEndTime);

    let currentTime = startTime;

    while (currentTime < endTime) {
      const slotStart = this.formatTime(currentTime);
      const slotEnd = this.formatTime(currentTime + slotDuration);

      // Count appointments in this time range
      const bookedCount = existingAppointments.filter((apt) => {
        const reportingTime = this.parseTime(apt.reportingTime);
        return reportingTime >= currentTime && reportingTime < currentTime + slotDuration;
      }).length;

      const availableCapacity = Math.max(0, capacityPerSlot - bookedCount);

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        availableCapacity,
        totalCapacity: capacityPerSlot,
        isFull: availableCapacity === 0,
      });

      currentTime += slotDuration;
    }

    return slots;
  }

  private generateStreamSlots(
    schedule: any,
    existingAppointments: Appointment[],
  ): SlotDto[] {
    const totalCapacity = schedule.totalCapacity || 10;
    const bookedCount = existingAppointments.length;
    const availableCapacity = Math.max(0, totalCapacity - bookedCount);

    // For stream scheduling, return a single "slot" representing the entire day
    return [
      {
        startTime: schedule.consultingStartTime,
        endTime: schedule.consultingEndTime,
        availableCapacity,
        totalCapacity,
        isFull: availableCapacity === 0,
      },
    ];
  }

  private getDayOfWeek(date: Date): string {
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[date.getDay()];
  }

  private parseTime(timeString: string): number {
    // Parse HH:MM:SS or HH:MM to minutes since midnight
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    // Convert minutes since midnight to HH:MM:SS format
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
  }

  private calculateAverageRating(doctor: Doctor): number {
    // For now, return a mock rating between 3.5 and 5.0
    return parseFloat((Math.random() * 1.5 + 3.5).toFixed(1));
  }
}
