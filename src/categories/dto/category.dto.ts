import {
  IsString,
  IsBoolean,
  IsOptional,
  IsUUID,
  Length,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';


export class CreateCategoryDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @ValidateIf((o) => o.parentId !== null && o.parentId !== undefined)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  active?: boolean = true;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @ValidateIf((o) => o.parentId !== null && o.parentId !== undefined)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  active?: boolean;
}

export class CategoryQueryDto {
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

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeChildren?: boolean; // Si es true, incluye todas las categorías (padres e hijas)
}

export class CategoryDto {
  id: string;
  name: string;
  active: boolean;
  parentId: string | null;
  children?: CategoryDto[];
  createdAt: Date;
  updatedAt: Date;
}
