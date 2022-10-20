import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { SigninLocalDto, SignupLocalDto } from './dto/auth.dto';
import { Tokens } from './types/tokens.type';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  // main function
  async signupLocal(dto: SignupLocalDto): Promise<Tokens> {
    const hash = await this.hashData(dto.password);
    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        hash,
      },
    });
    const tokens = await this.getToken(newUser.id, newUser.email);
    await this.updateRefreshTokenHash(newUser.id, tokens.refresh_token);
    return tokens;
  }

  async signinLocal(dto: SigninLocalDto): Promise<Tokens> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) throw new BadRequestException('Email or Password incorrect');

    const passwordMatches = await argon2.verify(user.hash, dto.password);
    if (!passwordMatches)
      throw new BadRequestException('Email or Password incorrect');

    const tokens = await this.getToken(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: number) {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        hashed_refresh_token: {
          not: null,
        },
      },
      data: {
        hashed_refresh_token: null,
      },
    });
  }
  async refreshTokens(userId: number, rt: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user || !user.hashed_refresh_token)
      throw new BadRequestException('Access Denied');

    const refreshTokenMatches = await argon2.verify(
      user.hashed_refresh_token,
      rt,
    );
    if (!refreshTokenMatches) throw new BadRequestException('Access Denied');

    const tokens = await this.getToken(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return tokens;
  }

  async updateRefreshTokenHash(userId: number, refreshToken: string) {
    const hash = await this.hashData(refreshToken);
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        hashed_refresh_token: hash,
      },
    });
  }

  // utility function
  async hashData(data: string) {
    return await argon2.hash(data);
  }

  async getToken(userId: number, email: string): Promise<Tokens> {
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: 'this is my Acces-Token secret',
          expiresIn: 60 * 15,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: 'this is my Refresh-Token secret',
          expiresIn: 60 * 60 * 24 * 2, //2 hari dalam second
        },
      ),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
