import {
  IsString,
  IsOptional,
  IsBoolean,
  IsHexColor,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ColorQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;
}

export class ColorDto {
  id: string;
  name: string;
  hexCode: string;
  active: boolean;
  createdAt: Date;
}