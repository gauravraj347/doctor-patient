import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SessionOverride } from '../entities/SessionOverride';
import { AppointmentAdjustmentLog } from '../entities/AppointmentAdjustmentLog';
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
    @InjectRepository(AppointmentAdjustmentLog)
    private appointmentAdjustmentLogRepository: Repository<AppointmentAdjustmentLog>,
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

  // ==================== SHRINK START TIME (WAVE) ====================
  async shrinkStartTimeWave(
    doctorId: string,
    date: string,
    newStartTime: string,
    strategy: string = 'AUTO',
    reason?: string,
  ): Promise<any> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get doctor schedule and existing appointments
      const schedule = await this.getDoctorSchedule(manager, doctorId);

      if (schedule.scheduleType !== ScheduleType.WAVE) {
        throw new BadRequestException(
          'This operation is only for wave scheduling',
        );
      }

      const appointments = await this.getAppointmentsForDate(
        manager,
        doctorId,
        date,
      );

      // 2. Identify affected appointments (those before newStartTime)
      const affectedAppointments = appointments.filter((apt) => {
        const reportingTime = this.parseTime(apt.reportingTime);
        const newStart = this.parseTime(newStartTime);
        return reportingTime < newStart;
      });

      if (affectedAppointments.length === 0) {
        throw new BadRequestException('No appointments affected by this change');
      }

      // 3. Get available slots in new time range
      const availableSlots = await this.getAvailableSlotsInRange(
        manager,
        doctorId,
        date,
        newStartTime,
        schedule.consultingEndTime,
      );

      // 4. Attempt redistribution based on strategy
      const redistributionResult = await this.attemptAutoRedistribution(
        manager,
        affectedAppointments,
        availableSlots,
        schedule,
        appointments,
      );

      // 5. Create session override
      const override = manager.create(SessionOverride, {
        doctorId,
        overrideDate: new Date(date),
        originalStartTime: schedule.consultingStartTime,
        originalEndTime: schedule.consultingEndTime,
        newStartTime,
        newEndTime: schedule.consultingEndTime,
        originalSlotDuration: schedule.slotDuration,
        newSlotDuration:
          redistributionResult.newSlotDuration || schedule.slotDuration,
        originalCapacityPerSlot: schedule.capacityPerSlot,
        newCapacityPerSlot:
          redistributionResult.newCapacityPerSlot || schedule.capacityPerSlot,
        reason,
        isActive: true,
      });

      await manager.save(SessionOverride, override);

      // 6. Apply appointment changes
      await this.applyAppointmentChanges(
        manager,
        redistributionResult.changes,
        override.id,
      );

      // 7. Notify affected patients (placeholder for now)
      await this.notifyAffectedPatients(redistributionResult.changes);

      return {
        success: true,
        message: 'Session shrunk successfully',
        override: this.mapToResponseDto(override),
        totalAffected: affectedAppointments.length,
        redistributed: redistributionResult.redistributed,
        needsReschedule: redistributionResult.remaining.length,
        strategyUsed: redistributionResult.strategyUsed,
        changes: redistributionResult.changes,
      };
    });
  }
  
  // ==================== REDISTRIBUTION STRATEGIES ====================

  private async attemptAutoRedistribution(
    manager: any,
    affectedAppointments: any[],
    availableSlots: any[],
    schedule: any,
    allAppointments: any[],
  ): Promise<any> {
    // STRATEGY 1: Move to Adjacent Slots
    let result = await this.tryMoveToAdjacentSlots(
      manager,
      affectedAppointments,
      availableSlots,
      schedule,
    );

    if (result.allFitted) {
      return {
        ...result,
        strategyUsed: 'MOVE_TO_ADJACENT_SLOT',
      };
    }

    // Reduce Consultation Time
    // Increase Capacity Per Slot
    // Mark Remaining as Needs Reschedule
    const finalChanges = [
      ...result.changes,
      ...result.remaining.map((apt) => ({
        appointmentId: apt.id,
        action: 'NEEDS_RESCHEDULE' as const,
        oldReportingTime: apt.reportingTime,
        newReportingTime: null,
        oldSlotId: apt.slotId,
        newSlotId: null,
        reason: 'Unable to fit in adjusted session time',
      })),
    ];

    return {
      allFitted: false,
      redistributed: result.redistributed,
      remaining: result.remaining,
      changes: finalChanges,
      strategyUsed: 'PARTIAL_WITH_RESCHEDULE',
    };
  }

  private async tryMoveToAdjacentSlots(
    manager: any,
    affectedAppointments: any[],
    availableSlots: any[],
    schedule: any,
  ): Promise<any> {
    const changes: any[] = [];
    const remaining: any[] = [];

    // Sort appointments by original time
    const sortedAppointments = affectedAppointments.sort(
      (a, b) => this.parseTime(a.reportingTime) - this.parseTime(b.reportingTime),
    );

    // Calculate current capacity for each slot
    const slotCapacity = new Map<string, number>();
    for (const slot of availableSlots) {
      const currentCount = await this.getSlotBookingCount(manager, slot.id);
      slotCapacity.set(slot.id, schedule.capacityPerSlot - currentCount);
    }

    // Try to fit each appointment
    for (const appointment of sortedAppointments) {
      let fitted = false;

      // Try each available slot in order
      for (const slot of availableSlots) {
        const availableCapacity = slotCapacity.get(slot.id) || 0;

        if (availableCapacity > 0) {
          // Move appointment to this slot
          changes.push({
            appointmentId: appointment.id,
            action: 'MOVED',
            oldReportingTime: appointment.reportingTime,
            newReportingTime: slot.startTime,
            oldSlotId: appointment.slotId,
            newSlotId: slot.id,
            reason: 'Moved due to session shrink',
          });

          // Update capacity
          slotCapacity.set(slot.id, availableCapacity - 1);
          fitted = true;
          break;
        }
      }

      if (!fitted) {
        remaining.push(appointment);
      }
    }

    return {
      allFitted: remaining.length === 0,
      redistributed: changes.length,
      remaining,
      changes,
    };
  }

  private async getAppointmentsForDate(
    manager: any,
    doctorId: string,
    date: string,
  ): Promise<any[]> {
    return await manager.find(Appointment, {
      where: {
        appointmentDate: new Date(date),
        status: 'Scheduled',
      },
      relations: ['timeSlot', 'patient'],
    });
  }

  private async getAvailableSlotsInRange(
    manager: any,
    doctorId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<any[]> {
    const dayOfWeek = this.getDayOfWeek(new Date(date));

    return await manager
      .createQueryBuilder(TimeSlot, 'slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.weekday = :weekday', { weekday: dayOfWeek })
      .andWhere('slot.startTime >= :startTime', { startTime })
      .andWhere('slot.startTime < :endTime', { endTime })
      .andWhere('slot.isAvailable = :isAvailable', { isAvailable: true })
      .orderBy('slot.startTime', 'ASC')
      .getMany();
  }

  private async getSlotBookingCount(
    manager: any,
    slotId: string,
  ): Promise<number> {
    return await manager.count(Appointment, {
      where: {
        slotId,
        status: 'Scheduled',
      },
    });
  }

  private async applyAppointmentChanges(
    manager: any,
    changes: any[],
    overrideId: string,
  ): Promise<void> {
    for (const change of changes) {
      const appointment = await manager.findOne(Appointment, {
        where: { id: change.appointmentId },
      });

      if (!appointment) continue;

      // Store original values if not already stored
      if (!appointment.originalReportingTime) {
        appointment.originalReportingTime = appointment.reportingTime;
      }
      if (!appointment.originalSlotId) {
        appointment.originalSlotId = appointment.slotId;
      }

      // Update appointment
      if (change.action === 'MOVED' || change.action === 'REDISTRIBUTED') {
        appointment.reportingTime = change.newReportingTime;
        appointment.slotId = change.newSlotId;
        appointment.wasAffectedByElasticScheduling = true;
        appointment.elasticSchedulingNote = change.reason;
      } else if (change.action === 'NEEDS_RESCHEDULE') {
        appointment.status = 'NeedsReschedule' as any;
        appointment.wasAffectedByElasticScheduling = true;
        appointment.elasticSchedulingNote = change.reason;
      }

      await manager.save(Appointment, appointment);

      // Create adjustment log
      const log = manager.create(AppointmentAdjustmentLog, {
        appointmentId: change.appointmentId,
        sessionOverrideId: overrideId,
        adjustmentType: change.action,
        oldReportingTime: change.oldReportingTime,
        newReportingTime: change.newReportingTime,
        oldSlotId: change.oldSlotId,
        newSlotId: change.newSlotId,
        notes: change.reason,
        patientNotified: false,
      });

      await manager.save(AppointmentAdjustmentLog, log);
    }
  }

  private async notifyAffectedPatients(changes: any[]): Promise<void> {
    // TODO: Implement actual notification service
    for (const change of changes) {
      console.log('='.repeat(60));
      console.log('[ELASTIC SCHEDULING NOTIFICATION]');
      console.log(`Appointment ID: ${change.appointmentId}`);
      console.log(`Action: ${change.action}`);
      console.log(`Old Time: ${change.oldReportingTime}`);
      console.log(`New Time: ${change.newReportingTime || 'NEEDS RESCHEDULE'}`);
      console.log(`Reason: ${change.reason}`);
      console.log('='.repeat(60));
    }
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
