export class SessionOverrideResponseDto {
  id: string;
  doctorId: string;
  overrideDate: string;
  originalStartTime: string;
  originalEndTime: string;
  newStartTime: string;
  newEndTime: string;
  originalSlotDuration?: number;
  newSlotDuration?: number;
  originalCapacityPerSlot?: number;
  newCapacityPerSlot?: number;
  originalTotalCapacity?: number;
  newTotalCapacity?: number;
  reason?: string;
  isActive: boolean;
  createdAt: Date;
}

export class ExpandSessionResultDto {
  success: boolean;
  message: string;
  override: SessionOverrideResponseDto;
  newSlotsAdded?: number;
  additionalCapacity?: number;
  affectedAppointments: number;
  oldCapacity?: number;
  newCapacity?: number;
}

export interface SlotDefinition {
  id?: string;
  startTime: string;
  endTime: string;
  capacity: number;
}
