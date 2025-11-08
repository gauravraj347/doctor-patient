import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../entities/common';

export class SelectRoleDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;

  // Optional fields for Doctor
  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  // Optional fields for Patient
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
