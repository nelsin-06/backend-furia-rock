import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  MaxLength,
  IsArray,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DesignStatus } from '../entities/design.entity';

export class CreateDesignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  designName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone: string;
}

export class UpdateDesignMetadataDto {
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateDesignStatusDto {
  @IsEnum(DesignStatus)
  status: DesignStatus;
}

export class AdminDesignQueryDto {
  @IsOptional()
  @IsEnum(DesignStatus)
  status?: DesignStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
