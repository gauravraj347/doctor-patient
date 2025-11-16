import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
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
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { UpdateTimeSlotDto } from './dto/update-time-slot.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
    // TODO: Implement actual rating calculation from appointments/reviews
    // For now, return a mock rating between 3.5 and 5.0
    return parseFloat((Math.random() * 1.5 + 3.5).toFixed(1));
  }

  // ==================== DOCTOR PROFILE MANAGEMENT ====================

  async updateProfile(doctorId: string, updateDto: UpdateProfileDto): Promise<Doctor> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Update fields
    if (updateDto.firstName) doctor.firstName = updateDto.firstName;
    if (updateDto.lastName) doctor.lastName = updateDto.lastName;
    if (updateDto.phone) doctor.phone = updateDto.phone;
    if (updateDto.specialization) doctor.specialization = updateDto.specialization;
    if (updateDto.licenseNumber) doctor.licenseNumber = updateDto.licenseNumber;
    if (updateDto.address) doctor.address = updateDto.address;

    return await this.doctorRepository.save(doctor);
  }

  async getProfile(doctorId: string): Promise<Doctor> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      relations: ['schedule', 'timeSlots'],
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  // ==================== SCHEDULE MANAGEMENT ====================

  async createSchedule(doctorId: string, createDto: CreateScheduleDto): Promise<DoctorSchedule> {
    // Check if doctor exists
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      relations: ['schedule'],
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Check if schedule already exists
    if (doctor.schedule) {
      throw new ConflictException('Doctor already has a schedule. Use update endpoint to modify it.');
    }

    // Validate schedule type specific fields
    if (createDto.scheduleType === ScheduleType.WAVE) {
      if (!createDto.slotDuration || !createDto.capacityPerSlot) {
        throw new BadRequestException('Wave scheduling requires slotDuration and capacityPerSlot');
      }
    } else if (createDto.scheduleType === ScheduleType.STREAM) {
      if (!createDto.totalCapacity) {
        throw new BadRequestException('Stream scheduling requires totalCapacity');
      }
    }

    // Validate time format
    this.validateTimeFormat(createDto.consultingStartTime);
    this.validateTimeFormat(createDto.consultingEndTime);

    // Create schedule
    const schedule = this.doctorScheduleRepository.create({
      doctorId,
      scheduleType: createDto.scheduleType,
      consultingStartTime: createDto.consultingStartTime,
      consultingEndTime: createDto.consultingEndTime,
      slotDuration: createDto.slotDuration,
      capacityPerSlot: createDto.capacityPerSlot,
      totalCapacity: createDto.totalCapacity,
    });

    return await this.doctorScheduleRepository.save(schedule);
  }

  async updateSchedule(doctorId: string, updateDto: UpdateScheduleDto): Promise<DoctorSchedule> {
    const schedule = await this.doctorScheduleRepository.findOne({
      where: { doctorId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found. Create one first.');
    }

    // Update fields
    if (updateDto.scheduleType) schedule.scheduleType = updateDto.scheduleType;
    if (updateDto.consultingStartTime) {
      this.validateTimeFormat(updateDto.consultingStartTime);
      schedule.consultingStartTime = updateDto.consultingStartTime;
    }
    if (updateDto.consultingEndTime) {
      this.validateTimeFormat(updateDto.consultingEndTime);
      schedule.consultingEndTime = updateDto.consultingEndTime;
    }
    if (updateDto.slotDuration !== undefined) schedule.slotDuration = updateDto.slotDuration;
    if (updateDto.capacityPerSlot !== undefined) schedule.capacityPerSlot = updateDto.capacityPerSlot;
    if (updateDto.totalCapacity !== undefined) schedule.totalCapacity = updateDto.totalCapacity;

    return await this.doctorScheduleRepository.save(schedule);
  }

  async getSchedule(doctorId: string): Promise<DoctorSchedule> {
    const schedule = await this.doctorScheduleRepository.findOne({
      where: { doctorId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async deleteSchedule(doctorId: string): Promise<void> {
    const schedule = await this.doctorScheduleRepository.findOne({
      where: { doctorId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    await this.doctorScheduleRepository.remove(schedule);
  }

  // ==================== TIME SLOT MANAGEMENT ====================

  async createTimeSlot(doctorId: string, createDto: CreateTimeSlotDto): Promise<TimeSlot> {
    // Check if doctor exists
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Validate time format
    this.validateTimeFormat(createDto.startTime);
    this.validateTimeFormat(createDto.endTime);

    // Check for overlapping slots
    const overlapping = await this.timeSlotRepository
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.weekday = :weekday', { weekday: createDto.weekday })
      .andWhere(
        '(slot.startTime < :endTime AND slot.endTime > :startTime)',
        { startTime: createDto.startTime, endTime: createDto.endTime }
      )
      .getOne();

    if (overlapping) {
      throw new ConflictException('Time slot overlaps with existing slot');
    }

    // Create time slot
    const timeSlot = this.timeSlotRepository.create({
      doctorId,
      weekday: createDto.weekday,
      startTime: createDto.startTime,
      endTime: createDto.endTime,
      isAvailable: createDto.isAvailable !== undefined ? createDto.isAvailable : true,
    });

    return await this.timeSlotRepository.save(timeSlot);
  }

  async updateTimeSlot(slotId: string, doctorId: string, updateDto: UpdateTimeSlotDto): Promise<TimeSlot> {
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id: slotId, doctorId },
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }

    // Update fields
    if (updateDto.weekday) timeSlot.weekday = updateDto.weekday;
    if (updateDto.startTime) {
      this.validateTimeFormat(updateDto.startTime);
      timeSlot.startTime = updateDto.startTime;
    }
    if (updateDto.endTime) {
      this.validateTimeFormat(updateDto.endTime);
      timeSlot.endTime = updateDto.endTime;
    }
    if (updateDto.isAvailable !== undefined) timeSlot.isAvailable = updateDto.isAvailable;

    return await this.timeSlotRepository.save(timeSlot);
  }

  async getTimeSlots(doctorId: string): Promise<TimeSlot[]> {
    return await this.timeSlotRepository.find({
      where: { doctorId },
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
  }

  async getTimeSlot(slotId: string, doctorId: string): Promise<TimeSlot> {
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id: slotId, doctorId },
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }

    return timeSlot;
  }

  async deleteTimeSlot(slotId: string, doctorId: string): Promise<void> {
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id: slotId, doctorId },
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }

    await this.timeSlotRepository.remove(timeSlot);
  }

  async bulkCreateTimeSlots(doctorId: string, slots: CreateTimeSlotDto[]): Promise<TimeSlot[]> {
    // Check if doctor exists
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const createdSlots: TimeSlot[] = [];

    for (const slotDto of slots) {
      try {
        const slot = await this.createTimeSlot(doctorId, slotDto);
        createdSlots.push(slot);
      } catch (error) {
        // Skip overlapping slots, continue with others
        if (error instanceof ConflictException) {
          continue;
        }
        throw error;
      }
    }

    return createdSlots;
  }

  // ==================== HELPER METHODS ====================

  private validateTimeFormat(time: string): void {
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
    if (!timeRegex.test(time)) {
      throw new BadRequestException(`Invalid time format: ${time}. Use HH:MM:SS format.`);
    }
  }
}
