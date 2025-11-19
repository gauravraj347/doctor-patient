import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SessionOverride } from '../entities/SessionOverride';
import { Doctor } from '../entities/Doctor';
import { DoctorSchedule, ScheduleType } from '../entities/DoctorSchedule';
import { TimeSlot, Weekday } from '../entities/TimeSlot';
import { Appointment } from '../entities/Appointment';
import {
  ExpandSessionResultDto,
  SlotDefinition,
} from './dto/session-override-response.dto';

@Injectable()
export class ElasticSchedulingService {
  constructor(
    @InjectRepository(SessionOverride)
    private sessionOverrideRepository: Repository<SessionOverride>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(DoctorSchedule)
    private doctorScheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private dataSource: DataSource,
  ) {}

  // ==================== EXPAND START TIME (WAVE) ====================
  async expandStartTimeWave(
    doctorId: string,
    date: string,
    newStartTime: string,
    reason?: string,
  ): Promise<ExpandSessionResultDto> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get doctor schedule
      const schedule = await this.getDoctorSchedule(manager, doctorId);

      if (schedule.scheduleType !== ScheduleType.WAVE) {
        throw new BadRequestException(
          'This operation is only for wave scheduling',
        );
      }

      // 2. Validate expansion
      const originalStart = this.parseTime(schedule.consultingStartTime);
      const newStart = this.parseTime(newStartTime);

      if (newStart >= originalStart) {
        throw new BadRequestException(
          'New start time must be earlier than original',
        );
      }

      // 3. Check for existing override
      await this.checkExistingOverride(manager, doctorId, date);

      // 4. Create session override
      const override = manager.create(SessionOverride, {
        doctorId,
        overrideDate: new Date(date),
        originalStartTime: schedule.consultingStartTime,
        originalEndTime: schedule.consultingEndTime,
        newStartTime,
        newEndTime: schedule.consultingEndTime,
        originalSlotDuration: schedule.slotDuration,
        newSlotDuration: schedule.slotDuration,
        originalCapacityPerSlot: schedule.capacityPerSlot,
        newCapacityPerSlot: schedule.capacityPerSlot,
        reason,
        isActive: true,
      });

      await manager.save(SessionOverride, override);

      // 5. Generate new wave slots for expanded time
      const newSlots = this.generateWaveSlotsForTimeRange(
        newStartTime,
        schedule.consultingStartTime,
        schedule.slotDuration,
        schedule.capacityPerSlot,
      );

      // 6. Create TimeSlot records for this specific date
      const dayOfWeek = this.getDayOfWeek(new Date(date));
      for (const slot of newSlots) {
        const timeSlot = manager.create(TimeSlot, {
          doctorId,
          weekday: dayOfWeek as Weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAvailable: true,
          isOverride: true,
          overrideDate: new Date(date),
        });

        await manager.save(TimeSlot, timeSlot);
      }

      return {
        success: true,
        message: 'Session expanded successfully',
        override: this.mapToResponseDto(override),
        newSlotsAdded: newSlots.length,
        affectedAppointments: 0,
      };
    });
  }

  // ==================== EXPAND END TIME (WAVE) ====================
  async expandEndTimeWave(
    doctorId: string,
    date: string,
    newEndTime: string,
    reason?: string,
  ): Promise<ExpandSessionResultDto> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get doctor schedule
      const schedule = await this.getDoctorSchedule(manager, doctorId);

      if (schedule.scheduleType !== ScheduleType.WAVE) {
        throw new BadRequestException(
          'This operation is only for wave scheduling',
        );
      }

      // 2. Validate expansion
      const originalEnd = this.parseTime(schedule.consultingEndTime);
      const newEnd = this.parseTime(newEndTime);

      if (newEnd <= originalEnd) {
        throw new BadRequestException(
          'New end time must be later than original',
        );
      }

      // 3. Check for existing override
      await this.checkExistingOverride(manager, doctorId, date);

      // 4. Create session override
      const override = manager.create(SessionOverride, {
        doctorId,
        overrideDate: new Date(date),
        originalStartTime: schedule.consultingStartTime,
        originalEndTime: schedule.consultingEndTime,
        newStartTime: schedule.consultingStartTime,
        newEndTime,
        originalSlotDuration: schedule.slotDuration,
        newSlotDuration: schedule.slotDuration,
        originalCapacityPerSlot: schedule.capacityPerSlot,
        newCapacityPerSlot: schedule.capacityPerSlot,
        reason,
        isActive: true,
      });

      await manager.save(SessionOverride, override);

      // 5. Generate new wave slots for expanded time
      const newSlots = this.generateWaveSlotsForTimeRange(
        schedule.consultingEndTime,
        newEndTime,
        schedule.slotDuration,
        schedule.capacityPerSlot,
      );

      // 6. Create TimeSlot records
      const dayOfWeek = this.getDayOfWeek(new Date(date));
      for (const slot of newSlots) {
        const timeSlot = manager.create(TimeSlot, {
          doctorId,
          weekday: dayOfWeek as Weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAvailable: true,
          isOverride: true,
          overrideDate: new Date(date),
        });

        await manager.save(TimeSlot, timeSlot);
      }

      return {
        success: true,
        message: 'Session expanded successfully',
        override: this.mapToResponseDto(override),
        newSlotsAdded: newSlots.length,
        affectedAppointments: 0,
      };
    });
  }

  // ==================== EXPAND START TIME (STREAM) ====================
  async expandStartTimeStream(
    doctorId: string,
    date: string,
    newStartTime: string,
    reason?: string,
  ): Promise<ExpandSessionResultDto> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get doctor schedule
      const schedule = await this.getDoctorSchedule(manager, doctorId);

      if (schedule.scheduleType !== ScheduleType.STREAM) {
        throw new BadRequestException(
          'This operation is only for stream scheduling',
        );
      }

      // 2. Calculate new capacity
      const originalMinutes =
        this.parseTime(schedule.consultingEndTime) -
        this.parseTime(schedule.consultingStartTime);
      const newMinutes =
        this.parseTime(schedule.consultingEndTime) - this.parseTime(newStartTime);

      const capacityRatio = newMinutes / originalMinutes;
      const newTotalCapacity = Math.floor(schedule.totalCapacity * capacityRatio);

      // 3. Check for existing override
      await this.checkExistingOverride(manager, doctorId, date);

      // 4. Create session override
      const override = manager.create(SessionOverride, {
        doctorId,
        overrideDate: new Date(date),
        originalStartTime: schedule.consultingStartTime,
        originalEndTime: schedule.consultingEndTime,
        newStartTime,
        newEndTime: schedule.consultingEndTime,
        originalTotalCapacity: schedule.totalCapacity,
        newTotalCapacity,
        reason,
        isActive: true,
      });

      await manager.save(SessionOverride, override);

      return {
        success: true,
        message: 'Session expanded successfully',
        override: this.mapToResponseDto(override),
        oldCapacity: schedule.totalCapacity,
        newCapacity: newTotalCapacity,
        additionalCapacity: newTotalCapacity - schedule.totalCapacity,
        affectedAppointments: 0,
      };
    });
  }

  // ==================== EXPAND END TIME (STREAM) ====================
  async expandEndTimeStream(
    doctorId: string,
    date: string,
    newEndTime: string,
    reason?: string,
  ): Promise<ExpandSessionResultDto> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get doctor schedule
      const schedule = await this.getDoctorSchedule(manager, doctorId);

      if (schedule.scheduleType !== ScheduleType.STREAM) {
        throw new BadRequestException(
          'This operation is only for stream scheduling',
        );
      }

      // 2. Calculate new capacity
      const originalMinutes =
        this.parseTime(schedule.consultingEndTime) -
        this.parseTime(schedule.consultingStartTime);
      const newMinutes =
        this.parseTime(newEndTime) - this.parseTime(schedule.consultingStartTime);

      const capacityRatio = newMinutes / originalMinutes;
      const newTotalCapacity = Math.floor(schedule.totalCapacity * capacityRatio);

      // 3. Check for existing override
      await this.checkExistingOverride(manager, doctorId, date);

      // 4. Create session override
      const override = manager.create(SessionOverride, {
        doctorId,
        overrideDate: new Date(date),
        originalStartTime: schedule.consultingStartTime,
        originalEndTime: schedule.consultingEndTime,
        newStartTime: schedule.consultingStartTime,
        newEndTime,
        originalTotalCapacity: schedule.totalCapacity,
        newTotalCapacity,
        reason,
        isActive: true,
      });

      await manager.save(SessionOverride, override);

      return {
        success: true,
        message: 'Session expanded successfully',
        override: this.mapToResponseDto(override),
        oldCapacity: schedule.totalCapacity,
        newCapacity: newTotalCapacity,
        additionalCapacity: newTotalCapacity - schedule.totalCapacity,
        affectedAppointments: 0,
      };
    });
  }

  // ==================== HELPER METHODS ====================

  private async getDoctorSchedule(
    manager: any,
    doctorId: string,
  ): Promise<DoctorSchedule> {
    const doctor = await manager.findOne(Doctor, {
      where: { id: doctorId, isActive: true },
      relations: ['schedule'],
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found or inactive');
    }

    const schedule = doctor.schedule as any;

    if (!schedule) {
      throw new BadRequestException('Doctor has no schedule configured');
    }

    return schedule;
  }

  private async checkExistingOverride(
    manager: any,
    doctorId: string,
    date: string,
  ): Promise<void> {
    const existingOverride = await manager.findOne(SessionOverride, {
      where: {
        doctorId,
        overrideDate: new Date(date),
        isActive: true,
      },
    });

    if (existingOverride) {
      throw new BadRequestException(
        'An active session override already exists for this date',
      );
    }
  }

  private generateWaveSlotsForTimeRange(
    startTime: string,
    endTime: string,
    slotDuration: number,
    capacityPerSlot: number,
  ): SlotDefinition[] {
    const slots: SlotDefinition[] = [];
    const startMinutes = this.parseTime(startTime);
    const endMinutes = this.parseTime(endTime);

    let currentTime = startMinutes;

    while (currentTime < endMinutes) {
      const slotStart = this.formatTime(currentTime);
      const slotEnd = this.formatTime(currentTime + slotDuration);

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        capacity: capacityPerSlot,
      });

      currentTime += slotDuration;
    }

    return slots;
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
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
  }

  private mapToResponseDto(override: SessionOverride): any {
    return {
      id: override.id,
      doctorId: override.doctorId,
      overrideDate: override.overrideDate.toISOString().split('T')[0],
      originalStartTime: override.originalStartTime,
      originalEndTime: override.originalEndTime,
      newStartTime: override.newStartTime,
      newEndTime: override.newEndTime,
      originalSlotDuration: override.originalSlotDuration,
      newSlotDuration: override.newSlotDuration,
      originalCapacityPerSlot: override.originalCapacityPerSlot,
      newCapacityPerSlot: override.newCapacityPerSlot,
      originalTotalCapacity: override.originalTotalCapacity,
      newTotalCapacity: override.newTotalCapacity,
      reason: override.reason,
      isActive: override.isActive,
      createdAt: override.createdAt,
    };
  }
}
