export class SlotDto {
  slotId?: string; // For wave scheduling (references TimeSlot)
  startTime: string;
  endTime: string;
  availableCapacity: number;
  totalCapacity: number;
  isFull: boolean;
}

export class AvailableSlotsResponseDto {
  doctorId: string;
  doctorName: string;
  date: string;
  scheduleType: 'wave' | 'stream';
  consultingHours: {
    start: string;
    end: string;
  };
  slots: SlotDto[];
  totalAvailableSlots: number;
  message?: string;
}
