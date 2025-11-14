import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Appointment, AppointmentStatus } from '../entities/Appointment';
import { Doctor } from '../entities/Doctor';
import { Patient } from '../entities/Patient';
import { TimeSlot } from '../entities/TimeSlot';
import { DoctorSchedule, ScheduleType } from '../entities/DoctorSchedule';
import { ConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';

@Injectable()
export class AppointmentsService {
    constructor(
        @InjectRepository(Appointment)
        private appointmentRepository: Repository<Appointment>,
        @InjectRepository(Doctor)
        private doctorRepository: Repository<Doctor>,
        @InjectRepository(Patient)
        private patientRepository: Repository<Patient>,
        @InjectRepository(TimeSlot)
        private timeSlotRepository: Repository<TimeSlot>,
        @InjectRepository(DoctorSchedule)
        private doctorScheduleRepository: Repository<DoctorSchedule>,
        private dataSource: DataSource,
    ) { }

    async confirmAppointment(dto: ConfirmAppointmentDto) {
        // Use transaction to ensure data consistency
        return await this.dataSource.transaction(async (manager) => {
            // 1. Validate doctor
            const doctor = await manager.findOne(Doctor, {
                where: { id: dto.doctorId, isActive: true },
                relations: ['schedule'],
            });

            if (!doctor) {
                throw new NotFoundException('Doctor not found or inactive');
            }

            if (!(doctor.schedule as any)) {
                throw new BadRequestException('Doctor has no schedule configured');
            }

            const schedule = doctor.schedule as any;

            // 2. Validate patient
            const patient = await manager.findOne(Patient, {
                where: { id: dto.patientId, isActive: true },
            });

            if (!patient) {
                throw new NotFoundException('Patient not found or inactive');
            }

            // 3. Validate date
            const appointmentDate = new Date(dto.appointmentDate);
            if (isNaN(appointmentDate.getTime())) {
                throw new BadRequestException('Invalid date format');
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (appointmentDate < today) {
                throw new BadRequestException('Cannot book appointments for past dates');
            }

            // 4. Check for existing appointment on same date
            const existingAppointment = await manager.findOne(Appointment, {
                where: {
                    patientId: dto.patientId,
                    appointmentDate: appointmentDate as any,
                    status: AppointmentStatus.SCHEDULED,
                },
            });

            if (existingAppointment) {
                throw new ConflictException(
                    'You already have an appointment on this date',
                );
            }

            // 5. Handle based on schedule type
            let appointment: Appointment;

            if (schedule.scheduleType === ScheduleType.WAVE) {
                appointment = await this.handleWaveBooking(
                    manager,
                    dto,
                    schedule,
                    appointmentDate,
                );
            } else if (schedule.scheduleType === ScheduleType.STREAM) {
                appointment = await this.handleStreamBooking(
                    manager,
                    dto,
                    schedule,
                    appointmentDate,
                );
            } else {
                throw new BadRequestException('Invalid schedule type');
            }

            // Send booking notification
            await this.sendBookingNotification(appointment);

            return {
                message: 'Appointment confirmed successfully',
                appointment: {
                    id: appointment.id,
                    doctorId: dto.doctorId,
                    patientId: appointment.patientId,
                    slotId: appointment.slotId,
                    appointmentDate: appointment.appointmentDate,
                    reportingTime: appointment.reportingTime,
                    tokenNumber: appointment.tokenNumber,
                    status: appointment.status,
                },
            };
        });
    }

    private async handleWaveBooking(
        manager: any,
        dto: ConfirmAppointmentDto,
        schedule: any,
        appointmentDate: Date,
    ): Promise<Appointment> {
        // Wave scheduling requires slotId
        if (!dto.slotId) {
            throw new BadRequestException('Slot ID is required for wave scheduling');
        }

        // Validate time slot
        const timeSlot = await manager.findOne(TimeSlot, {
            where: { id: dto.slotId, doctorId: dto.doctorId, isAvailable: true },
        });

        if (!timeSlot) {
            throw new NotFoundException('Time slot not found or unavailable');
        }

        // Check slot capacity
        const bookedCount = await manager.count(Appointment, {
            where: {
                slotId: dto.slotId,
                appointmentDate: appointmentDate as any,
                status: AppointmentStatus.SCHEDULED,
            },
        });

        const capacityPerSlot = schedule.capacityPerSlot || 1;

        if (bookedCount >= capacityPerSlot) {
            throw new ConflictException('This slot is fully booked');
        }

        // Generate token number for this slot
        const tokenNumber = bookedCount + 1;

        // Create appointment
        const appointment = manager.create(Appointment, {
            patientId: dto.patientId,
            slotId: dto.slotId,
            appointmentDate: appointmentDate as any,
            reportingTime: timeSlot.startTime,
            tokenNumber,
            status: AppointmentStatus.SCHEDULED,
        });

        return await manager.save(Appointment, appointment);
    }

    private async handleStreamBooking(
        manager: any,
        dto: ConfirmAppointmentDto,
        schedule: any,
        appointmentDate: Date,
    ): Promise<Appointment> {
        // Check total capacity for the day
        const bookedCount = await manager.count(Appointment, {
            where: {
                appointmentDate: appointmentDate as any,
                status: AppointmentStatus.SCHEDULED,
            },
            relations: ['timeSlot'],
        });

        const totalCapacity = schedule.totalCapacity || 10;

        if (bookedCount >= totalCapacity) {
            throw new ConflictException('Doctor is fully booked for this date');
        }

        // Calculate next reporting time
        const reportingTime = this.calculateNextReportingTime(
            schedule.consultingStartTime,
            schedule.consultingEndTime,
            bookedCount,
            totalCapacity,
        );

        // Generate token number
        const tokenNumber = bookedCount + 1;

        // Create appointment (no slotId for stream)
        const appointment = manager.create(Appointment, {
            patientId: dto.patientId,
            slotId: null,
            appointmentDate: appointmentDate as any,
            reportingTime,
            tokenNumber,
            status: AppointmentStatus.SCHEDULED,
        });

        return await manager.save(Appointment, appointment);
    }

    private calculateNextReportingTime(
        startTime: string,
        endTime: string,
        bookedCount: number,
        totalCapacity: number,
    ): string {
        // Parse times
        const start = this.parseTime(startTime);
        const end = this.parseTime(endTime);

        // Calculate total consulting minutes
        const totalMinutes = end - start;

        // Distribute patients evenly across the day
        const intervalMinutes = Math.floor(totalMinutes / totalCapacity);

        // Calculate reporting time for this patient
        const reportingMinutes = start + bookedCount * intervalMinutes;

        return this.formatTime(reportingMinutes);
    }

    async cancelAppointment(dto: CancelAppointmentDto, userId: string) {
        return await this.dataSource.transaction(async (manager) => {
            // 1. Find appointment
            const appointment = await manager.findOne(Appointment, {
                where: { id: dto.appointmentId },
                relations: ['patient', 'timeSlot'],
            });

            if (!appointment) {
                throw new NotFoundException('Appointment not found');
            }

            // 2. Verify ownership (patient can only cancel their own appointments)
            if (appointment.patientId !== userId) {
                throw new BadRequestException(
                    'You can only cancel your own appointments',
                );
            }

            // 3. Check if already cancelled
            if (appointment.status === AppointmentStatus.CANCELLED) {
                throw new BadRequestException('Appointment is already cancelled');
            }

            // 4. Check if appointment is in the past
            const appointmentDate = new Date(appointment.appointmentDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (appointmentDate < today) {
                throw new BadRequestException('Cannot cancel past appointments');
            }

            // 5. Update appointment status
            appointment.status = AppointmentStatus.CANCELLED;
            await manager.save(Appointment, appointment);

            // Send cancellation notification
            await this.sendCancellationNotification(appointment, dto.reason);

            return {
                message: 'Appointment cancelled successfully',
                appointment: {
                    id: appointment.id,
                    status: appointment.status,
                    reason: dto.reason,
                },
            };
        });
    }

    async getPatientAppointments(patientId: string) {
        const appointments = await this.appointmentRepository.find({
            where: { patientId },
            relations: ['timeSlot', 'timeSlot.doctor'],
            order: { appointmentDate: 'DESC', createdAt: 'DESC' },
        });

        return appointments.map((apt) => ({
            id: apt.id,
            appointmentDate: apt.appointmentDate,
            reportingTime: apt.reportingTime,
            tokenNumber: apt.tokenNumber,
            status: apt.status,
            doctor: apt.timeSlot
                ? {
                    id: (apt.timeSlot as any).doctorId,
                    name: `Dr. ${(apt.timeSlot as any).doctor?.firstName} ${(apt.timeSlot as any).doctor?.lastName}`,
                }
                : null,
            slot: apt.timeSlot
                ? {
                    startTime: (apt.timeSlot as any).startTime,
                    endTime: (apt.timeSlot as any).endTime,
                }
                : null,
        }));
    }

    async getAppointmentById(appointmentId: string, userId: string) {
        const appointment = await this.appointmentRepository.findOne({
            where: { id: appointmentId },
            relations: ['patient', 'timeSlot', 'timeSlot.doctor', 'timeSlot.doctor.schedule'],
        });

        if (!appointment) {
            return null;
        }

        // Verify ownership
        if (appointment.patientId !== userId) {
            return null;
        }

        const doctor = (appointment.timeSlot as any)?.doctor;
        const schedule = doctor?.schedule;

        return {
            appointmentId: appointment.id,
            doctor: doctor
                ? {
                    id: doctor.id,
                    name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
                    specialization: doctor.specialization || 'General',
                    phone: doctor.phone || '',
                    email: doctor.email,
                }
                : null,
            patient: {
                id: appointment.patient.id,
                name: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                email: appointment.patient.email,
                phone: appointment.patient.phone || '',
            },
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.timeSlot
                ? (appointment.timeSlot as any).startTime
                : schedule?.consultingStartTime || null,
            endTime: appointment.timeSlot
                ? (appointment.timeSlot as any).endTime
                : schedule?.consultingEndTime || null,
            status: appointment.status,
            reportingTime: appointment.reportingTime,
            tokenNumber: appointment.tokenNumber,
            scheduleType: schedule?.scheduleType || null,
            createdAt: appointment.createdAt,
        };
    }

    async getPatientAppointmentsWithFilters(
        patientId: string,
        filters: any,
    ) {
        const queryBuilder = this.appointmentRepository
            .createQueryBuilder('appointment')
            .leftJoinAndSelect('appointment.timeSlot', 'timeSlot')
            .leftJoinAndSelect('timeSlot.doctor', 'doctor')
            .where('appointment.patientId = :patientId', { patientId });

        // Filter by status
        if (filters.status) {
            queryBuilder.andWhere('appointment.status = :status', {
                status: filters.status,
            });
        }

        // Filter by date range
        if (filters.from) {
            queryBuilder.andWhere('appointment.appointmentDate >= :from', {
                from: filters.from,
            });
        }

        if (filters.to) {
            queryBuilder.andWhere('appointment.appointmentDate <= :to', {
                to: filters.to,
            });
        }

        const appointments = await queryBuilder
            .orderBy('appointment.appointmentDate', 'DESC')
            .addOrderBy('appointment.createdAt', 'DESC')
            .getMany();

        return appointments.map((apt) => {
            const doctor = (apt.timeSlot as any)?.doctor;
            return {
                appointmentId: apt.id,
                doctorName: doctor
                    ? `Dr. ${doctor.firstName} ${doctor.lastName}`
                    : 'Unknown',
                doctorSpecialization: doctor?.specialization || 'General',
                appointmentDate: apt.appointmentDate,
                reportingTime: apt.reportingTime,
                tokenNumber: apt.tokenNumber,
                status: apt.status,
                slot: apt.timeSlot
                    ? {
                        startTime: (apt.timeSlot as any).startTime,
                        endTime: (apt.timeSlot as any).endTime,
                    }
                    : null,
            };
        });
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

    private async sendBookingNotification(appointment: any) {
        // TODO: Implement actual notification service
        // For now, just log the notification
        console.log('='.repeat(60));
        console.log('[BOOKING NOTIFICATION]');
        console.log(`Patient: ${appointment.patientId}`);
        console.log(`Date: ${appointment.appointmentDate}`);
        console.log(`Time: ${appointment.reportingTime}`);
        console.log(`Token: ${appointment.tokenNumber}`);
        console.log('='.repeat(60));

        // In production, this would:
        // - Send email notification
        // - Send SMS notification
        // - Create in-app notification
        // - Schedule reminder notifications
    }

    private async sendCancellationNotification(
        appointment: any,
        reason?: string,
    ) {
        // TODO: Implement actual notification service
        console.log('='.repeat(60));
        console.log('[CANCELLATION NOTIFICATION]');
        console.log(`Appointment ID: ${appointment.id}`);
        console.log(`Patient: ${appointment.patientId}`);
        console.log(`Date: ${appointment.appointmentDate}`);
        console.log(`Reason: ${reason || 'Not specified'}`);
        console.log('='.repeat(60));

        // In production, this would:
        // - Send cancellation email
        // - Send SMS notification
        // - Update in-app notifications
        // - Cancel scheduled reminders
    }
}
