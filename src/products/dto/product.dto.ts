import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsUUID,
  IsUrl,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProductVariable, CreateProductVariable } from '../entities/product.entity';
import { CategoryDto } from '../../categories/dto/category.dto';
import { QualityDto } from '../../qualities/dto/quality.dto';
import { Not } from 'typeorm';

// DTO for creating/updating product variables (only needs colorId and images)
export class CreateProductVariableDto {
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  colorId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images: string[];
}

// DTO for response (includes all color info)
export class ProductVariableDto {
  @IsUUID()
  variantId: string;

  @IsUUID()
  colorId: string;

  @IsString()
  colorHex: string;

  @IsString()
  colorName: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images: string[];
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  price: number;

  @IsNotEmpty()
  @Transform(({ value }) => {
    console.log("🚀 ~ CreateProductDto ~ value:", typeof value)
    // Handle comma-separated category IDs
    if (typeof value === 'string') {
      return value.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }
    return value;
  })
  categories?: string; // Will be transformed to string[] of category IDs

  @IsUUID()
  @IsNotEmpty()
  qualityId: string;

  // Active field removed - products start as inactive by default

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariableDto)
  variables?: CreateProductVariableDto[];
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    // Handle comma-separated category IDs
    if (typeof value === 'string') {
      return value.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }
    return value;
  })
  categories?: string; // Will be transformed to string[] of category IDs

  @IsUUID()
  @IsOptional()
  qualityId?: string;

  // Active field removed - managed automatically based on image availability

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariableDto)
  variables?: CreateProductVariableDto[];
}

export class ProductQueryDto {
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
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((cat) => cat.trim());
    }
    return value;
  })
  category?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((q) => q.trim());
    }
    return value;
  })
  quality?: string[];

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAdmin?: boolean;
}

export class ProductDto {
  id: string;
  name: string;
  price: number;
  categories: CategoryDto[];
  quality: QualityDto;
  active: boolean;
  variables: ProductVariable[] | null;
  createdAt: Date;
  updatedAt: Date;
}

