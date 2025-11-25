import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { CategoryRepository } from './repositories/category.repository';
import { CreateCategoryDto, UpdateCategoryDto, CategoryDto } from './dto/category.dto';
import { Category } from './entities/category.entity';
import { CategoryFilters } from './repositories/category.repository.entity';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async findAll(filters: CategoryFilters) {
    const result = await this.categoryRepository.findWithFilters(filters);
    
    const categoriesWithDto = result.data.map(category => this.mapToDto(category));

    return {
      ...result,
      data: categoriesWithDto,
    };
  }

  async findOne(id: string): Promise<CategoryDto | null> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    return category ? this.mapToDto(category) : null;
  }

  async findByIds(ids: string[]): Promise<Category[]> {
    return await this.categoryRepository.findByIds(ids);
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryDto> {
    // Check if name already exists
    const existingCategory = await this.categoryRepository.findOne({ 
      where: { name: createCategoryDto.name } 
    });
    
    if (existingCategory) {
      throw new BadRequestException(`Category with name "${createCategoryDto.name}" already exists`);
    }

    // If setting as default, ensure only one default exists
    if (createCategoryDto.default) {
      await this.ensureOnlyOneDefault(createCategoryDto.default);
    }

    const category = this.categoryRepository.create(createCategoryDto);
    const savedCategory = await this.categoryRepository.save(category);
    
    return this.mapToDto(savedCategory);
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryDto | null> {
    const existingCategory = await this.categoryRepository.findOne({ where: { id } });
    if (!existingCategory) {
      throw new NotFoundException('Category not found');
    }

    // Check if new name already exists (if name is being updated)
    if (updateCategoryDto.name && updateCategoryDto.name !== existingCategory.name) {
      const nameExists = await this.categoryRepository.findOne({ 
        where: { name: updateCategoryDto.name } 
      });
      
      if (nameExists) {
        throw new BadRequestException(`Category with name "${updateCategoryDto.name}" already exists`);
      }
    }

    // If setting as default, ensure only one default exists
    if (updateCategoryDto.default === true) {
      await this.ensureOnlyOneDefault(true, id);
    }

    await this.categoryRepository.update(id, updateCategoryDto);
    const updatedCategory = await this.categoryRepository.findOne({ where: { id } });
    
    return updatedCategory ? this.mapToDto(updatedCategory) : null;
  }

  async remove(id: string): Promise<boolean> {
    const category = await this.categoryRepository.findOne({ 
      where: { id },
      relations: ['products']
    });
    
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category is being used by products
    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it is being used by ${category.products.length} product(s). ` +
        'Please remove this category from all products before deleting.'
      );
    }

    // Check if this is the default category
    if (category.default) {
      const totalCategories = await this.categoryRepository.count({ active: true });
      if (totalCategories <= 1) {
        throw new BadRequestException(
          'Cannot delete the default category when it is the only active category. ' +
          'Please create another category and set it as default first.'
        );
      }
    }

    const result = await this.categoryRepository.delete(id);
    return result.affected > 0;
  }

  async getDefaultCategory(): Promise<CategoryDto | null> {
    const defaultCategory = await this.categoryRepository.findDefaultCategory();
    return defaultCategory ? this.mapToDto(defaultCategory) : null;
  }

  async ensureDefaultCategoryExists(): Promise<void> {
    const defaultCategory = await this.categoryRepository.findDefaultCategory();
    
    if (!defaultCategory) {
      // Create a default category if none exists
      const defaultCategoryData = {
        name: 'General',
        default: true,
        active: true,
      };
      
      const category = this.categoryRepository.create(defaultCategoryData);
      await this.categoryRepository.save(category);
      
      this.logger.log('✅ Created default category: General');
    }
  }

  private async ensureOnlyOneDefault(isDefault: boolean, excludeId?: string): Promise<void> {
    if (isDefault) {
      // Remove default flag from all other categories
      const queryBuilder = this.categoryRepository['repository']
        .createQueryBuilder()
        .update(Category)
        .set({ default: false })
        .where('default = :default', { default: true });
      
      if (excludeId) {
        queryBuilder.andWhere('id != :excludeId', { excludeId });
      }
      
      await queryBuilder.execute();
    }
  }

  private mapToDto(category: Category): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      default: category.default,
      active: category.active,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}