import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/User';
import { Patient } from '../entities/Patient';
import { RefreshToken } from '../entities/RefreshToken';
import { VerificationToken } from '../entities/VerificationToken';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserRole } from '../entities/common';
import { Doctor } from '../entities/Doctor';
import { ResendOtpDto } from './dto/resend-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor) 
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(VerificationToken)
    private verificationTokenRepository: Repository<VerificationToken>,
    private jwtService: JwtService,
  ) { }

  async signup(signupDto: SignupDto) {
    const { email, role, ...userData } = signupDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    let user;
    if (role === UserRole.PATIENT) {
      user = this.patientRepository.create({
        email,
        ...userData,
        role,
        isEmailVerified: false,
      });
      await this.patientRepository.save(user);
    } else if (role === UserRole.DOCTOR) {
      user = this.doctorRepository.create({
        email,
        ...userData,
        role,
        isEmailVerified: false,
      });
      await this.doctorRepository.save(user);
    } else {
      throw new BadRequestException('Invalid role specified');
    }

    // Generate and send OTP
    await this.generateAndStoreOtp(user);

    return {
      message: 'Signup successful. Please verify your email with the OTP sent.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: false,
      },
    };
  }

  async signin(signinDto: SigninDto) {
    const { email, password } = signinDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await user.validatePassword(password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before signing in');
    }

    const tokens = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(tokens.refreshToken, user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async signout(userId: string) {
    await this.refreshTokenRepository.update(
      { user: { id: userId } },
      { isRevoked: true },
    );

    return { message: 'Successfully signed out' };
  }

  private async generateTokens(userId: string, role: UserRole) {
    const payload = { sub: userId, role };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async storeRefreshToken(token: string, user: User) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      token,
      expiresAt,
      user,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Find valid OTP
    const verificationToken = await this.verificationTokenRepository.findOne({
      where: {
        userId: user.id,
        otp,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid OTP');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Mark OTP as used
    verificationToken.isUsed = true;
    await this.verificationTokenRepository.save(verificationToken);

    // Verify user
    user.isEmailVerified = true;
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(tokens.refreshToken, user);

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: true,
      },
      ...tokens,
    };
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { email } = resendOtpDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate and send new OTP
    await this.generateAndStoreOtp(user);

    return {
      message: 'OTP resent successfully',
    };
  }

  private async generateAndStoreOtp(user: User) {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Store OTP
    const verificationToken = this.verificationTokenRepository.create({
      otp,
      expiresAt,
      user,
      userId: user.id,
    });

    await this.verificationTokenRepository.save(verificationToken);

    console.log(`OTP for ${user.email}: ${otp}`);

    return otp;
  }

  async googleLogin(googleUser: any) {
    const { email, firstName, lastName } = googleUser;

    // Check if user exists
    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Create new user as patient by default
      user = this.patientRepository.create({
        email,
        firstName,
        lastName,
        password: '', // No password for OAuth users
        role: UserRole.PATIENT,
        isEmailVerified: true, // Google accounts are pre-verified
      });
      await this.patientRepository.save(user);
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const tokens = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(tokens.refreshToken, user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }
}