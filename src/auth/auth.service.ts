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
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { UserRole } from '../entities/common';
import { Doctor } from '../entities/Doctor';

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
      });
      await this.patientRepository.save(user);
    } else if (role === UserRole.DOCTOR) {
      user = this.doctorRepository.create({
        email,
        ...userData,
        role,
      });
      await this.doctorRepository.save(user);
    } else {
      throw new BadRequestException('Invalid role specified');
    }

    const tokens = await this.generateTokens(user.id, role);
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

  async signin(signinDto: SigninDto) {
    const { email, password } = signinDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await user.validatePassword(password))) {
      throw new UnauthorizedException('Invalid credentials');
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