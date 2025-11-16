export class DoctorResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  specialization: string;
  licenseNumber: string;
  location?: string;
  averageRating?: number;
  isAvailable: boolean;
  scheduleType?: string;
  consultingHours?: {
    start: string;
    end: string;
  };
}
