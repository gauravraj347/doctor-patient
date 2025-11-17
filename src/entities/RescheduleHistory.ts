import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './common';
import { Appointment } from './Appointment';

@Entity('reschedule_history')
export class RescheduleHistory extends BaseEntity {
    @ManyToOne(() => Appointment, (appointment) => appointment.rescheduleHistory, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'appointmentId' })
    appointment: Appointment;

    @Column()
    appointmentId: string;

    @Column({ nullable: true })
    oldSlotId: string;

    @Column({ nullable: true })
    newSlotId: string;

    @Column({ type: 'time', nullable: true })
    oldTime: string;

    @Column({ type: 'time', nullable: true })
    newTime: string;

    @Column({ type: 'date', nullable: true })
    oldDate: Date;

    @Column({ type: 'date', nullable: true })
    newDate: Date;

    @Column({ type: 'text', nullable: true })
    rescheduleReason: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    rescheduledAt: Date;
}
